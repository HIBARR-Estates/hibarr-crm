<?php

namespace Tests\Feature\FinancialAssessment;

use App\Enums\FinancialAssessmentSource;
use App\Enums\FinancialAssessmentStatus;
use App\Models\FinancialAssessment;
use App\Models\FinancialAssessmentLine;
use App\Scopes\CompanyScope;
use App\Services\FinancialAssessment\AssessmentFieldRegistry;
use App\Services\FinancialAssessment\FinancialAssessmentDefaults;
use App\Services\FinancialAssessment\FinancialAssessmentSettingsService;
use App\Services\LeadFieldCatalog;
use App\Services\LeadFieldWriter;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\SetsFeatureFlags;
use Tests\FinancialAssessmentTestCase;

class AssessmentFieldCatalogTest extends FinancialAssessmentTestCase
{
    use SetsFeatureFlags;

    private function on(): void
    {
        $this->setFeatureFlag('crm.lead-financial-assessments', true);
    }

    private function keys(array $fields): array
    {
        return array_column($fields, 'key');
    }

    public function test_nothing_is_offered_while_the_feature_flag_is_off(): void
    {
        $this->setFeatureFlag('crm.lead-financial-assessments', false);

        $this->assertSame([], app(AssessmentFieldRegistry::class)->fields($this->companyId));

        $result = app(LeadFieldWriter::class)->apply($this->makeLead(), ['assessment.bank' => 100]);
        $this->assertSame(['assessment.bank' => 'not_available'], $result['skipped']);
        $this->assertSame([], $result['assessment']);
    }

    public function test_line_fields_follow_the_active_types_and_carry_their_defaults(): void
    {
        $this->on();
        DB::table('financial_assessment_line_types')->where('key', 'rent')->update(['is_active' => false]);

        $fields = collect(app(AssessmentFieldRegistry::class)->fields($this->companyId))->keyBy('key');

        $salary = $fields['assessment.salary'];
        $this->assertSame('number', $salary['type']);
        $this->assertSame('financial_assessment', $salary['group']);
        $this->assertTrue($salary['writable']);
        $this->assertSame(['fill', 'overwrite', 'append'], $salary['write_modes']);
        $this->assertSame(['currency', 'frequency', 'certainty', 'available_from', 'note'], $salary['accepts']);
        $this->assertSame(['frequency' => 'monthly', 'certainty' => 'confirmed'], $salary['defaults']);
        $this->assertSame('income', $salary['kind']);
        $this->assertSame('income', $salary['role']);
        $this->assertSame('Financial · Salary', $salary['label']);
        $this->assertArrayNotHasKey('assessment.rent', $fields->all());
        $this->assertArrayNotHasKey('assessment.metric.total.rent', $fields->all());
    }

    public function test_metrics_are_listed_but_read_only(): void
    {
        $this->on();

        $fields = collect(app(AssessmentFieldRegistry::class)->fields($this->companyId))->keyBy('key');

        foreach (['available_now', 'income_monthly', 'disposable_monthly', 'verified', 'age_days', 'has_draft'] as $name) {
            $field = $fields['assessment.metric.'.$name];
            $this->assertFalse($field['writable'], $name);
            $this->assertSame([], $field['write_modes'], $name);
        }
        $this->assertSame('boolean', $fields['assessment.metric.verified']['type']);
        $this->assertSame('integer', $fields['assessment.metric.age_days']['type']);
        $this->assertSame('number', $fields['assessment.metric.total.crypto']['type']);
    }

    public function test_a_type_an_admin_adds_later_appears_without_any_code_change(): void
    {
        $this->on();
        $settings = app(FinancialAssessmentSettingsService::class);
        $kind = $settings->createKind($this->companyId, 'Insurance payouts', 'funding');
        $settings->createType($this->companyId, $kind['id'], 'Life insurance', 'once', 'likely');

        $keys = $this->keys(app(AssessmentFieldRegistry::class)->fields($this->companyId));

        $this->assertContains('assessment.life_insurance', $keys);
        $this->assertContains('assessment.metric.total.life_insurance', $keys);
    }

    public function test_the_company_catalog_adds_assessment_fields_after_the_column_fields_and_is_per_company(): void
    {
        $this->on();
        DB::table('companies')->insert(['id' => 2, 'company_name' => 'Other', 'currency_id' => 1]);
        FinancialAssessmentDefaults::seedForCompany(2);
        app(FinancialAssessmentSettingsService::class)->createKind(2, 'Only company two', 'income');
        $kindTwo = DB::table('financial_assessment_kinds')->where('company_id', 2)->where('key', 'only_company_two')->value('id');
        app(FinancialAssessmentSettingsService::class)->createType(2, (int) $kindTwo, 'Secret stream', null, null);

        $one = $this->keys(app(LeadFieldCatalog::class)->allForCompany($this->companyId));
        $two = $this->keys(app(LeadFieldCatalog::class)->allForCompany(2));

        $this->assertContains('client_name', $one);
        $this->assertContains('assessment.salary', $one);
        $this->assertNotContains('assessment.secret_stream', $one);
        $this->assertContains('assessment.secret_stream', $two);
        // Column fields come first and are untouched by the company-specific part.
        $this->assertLessThan(array_search('assessment.salary', $one, true), array_search('client_name', $one, true));
        $this->assertSame(app(LeadFieldCatalog::class)->all(), array_slice(app(LeadFieldCatalog::class)->allForCompany($this->companyId), 0, count(app(LeadFieldCatalog::class)->all())));
    }

    public function test_apply_validates_assessment_fields_and_queues_them_without_touching_the_lead(): void
    {
        $this->on();
        $lead = $this->makeLead();

        $result = app(LeadFieldWriter::class)->apply($lead, [
            'assessment.bank' => 35000,
            'assessment.crypto' => ['value' => '0.4', 'mode' => 'overwrite', 'currency' => 'BTC', 'certainty' => 'confirmed', 'ignored' => 'x'],
            'assessment.salary' => ['value' => -5],
            'assessment.rent' => ['value' => 'abc'],
            'assessment.mortgage' => ['value' => 1000, 'mode' => 'teleport'],
            'assessment.metric.available_now' => 99999,
            'assessment.nonsense' => 1,
            'assessment.pension' => '',
        ]);

        $this->assertFalse($result['changed']);
        $this->assertSame([
            'assessment.salary' => 'invalid_value',
            'assessment.rent' => 'invalid_value',
            'assessment.mortgage' => 'mode_not_supported',
            'assessment.metric.available_now' => 'mode_not_supported',
            'assessment.nonsense' => 'not_available',
        ], $result['skipped']);
        $this->assertSame(['assessment.bank', 'assessment.crypto'], array_keys($result['assessment']));
        $this->assertSame(['type_key' => 'bank', 'value' => 35000.0, 'mode' => 'fill', 'companions' => []], $result['assessment']['assessment.bank']);
        $this->assertSame(['currency' => 'BTC', 'certainty' => 'confirmed'], $result['assessment']['assessment.crypto']['companions']);
        $this->assertSame(0, FinancialAssessment::withoutGlobalScope(CompanyScope::class)->count());
    }

    public function test_applying_queued_writes_fills_the_drafts_lines_by_mode_and_never_finalises(): void
    {
        $this->on();
        $lead = $this->makeLead();
        $writer = app(LeadFieldWriter::class);

        $writes = $writer->apply($lead, [
            'assessment.bank' => ['value' => 35000, 'certainty' => 'likely'],
            'assessment.salary' => ['value' => 6500, 'currency' => 'EUR', 'frequency' => 'yearly', 'note' => 'from the form'],
        ])['assessment'];
        $skipped = $writer->applyAssessment($lead, $writes);

        $this->assertSame([], $skipped);
        $draft = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('lead_id', $lead->id)->first();
        $this->assertSame(FinancialAssessmentStatus::Draft, $draft->status);
        $this->assertSame(FinancialAssessmentSource::Api, $draft->source);
        $lines = FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->get()->keyBy(fn ($l) => $l->type->key);
        $this->assertEquals(35000, $lines['bank']->amount);
        $this->assertSame('likely', $lines['bank']->certainty->value);
        $this->assertSame('yearly', $lines['salary']->frequency->value);
        $this->assertSame('from the form', $lines['salary']->note);

        // A second request: fill leaves the existing line alone, overwrite replaces it, append adds one.
        $again = $writer->apply($lead, [
            'assessment.bank' => 1,
            'assessment.salary' => ['value' => 7000, 'mode' => 'overwrite'],
            'assessment.crypto' => ['value' => 0.5, 'mode' => 'append', 'currency' => 'BTC'],
        ])['assessment'];
        $writer->applyAssessment($lead, $again);

        $this->assertSame(1, FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('lead_id', $lead->id)->count());
        $lines = FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->get()->keyBy(fn ($l) => $l->type->key);
        $this->assertEquals(35000, $lines['bank']->amount);
        $this->assertEquals(7000, $lines['salary']->amount);
        $this->assertCount(3, $lines);
        $this->assertSame(0, FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('status', 'final')->count());
    }

    public function test_a_field_that_cannot_be_stored_is_reported_and_does_not_block_the_others(): void
    {
        $this->on();
        $lead = $this->makeLead();
        $writer = app(LeadFieldWriter::class);
        $writes = $writer->apply($lead, [
            'assessment.bank' => ['value' => 100, 'currency' => 'NOT-A-CURRENCY'],
            'assessment.salary' => 6500,
            'assessment.rent' => 900,
        ])['assessment'];

        // The type is switched off between validation and storage.
        DB::table('financial_assessment_line_types')->where('key', 'rent')->update(['is_active' => false]);
        $skipped = $writer->applyAssessment($lead, $writes);

        $this->assertSame(['assessment.bank' => 'invalid_value', 'assessment.rent' => 'not_available'], $skipped);
        $draft = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('lead_id', $lead->id)->first();
        $this->assertSame(1, FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->count());
    }

    public function test_the_writer_still_builds_without_the_registry_argument(): void
    {
        $this->on();

        $result = (new LeadFieldWriter(app(LeadFieldCatalog::class)))->apply($this->makeLead(), ['assessment.bank' => 5]);

        $this->assertArrayHasKey('assessment.bank', $result['assessment']);
    }
}
