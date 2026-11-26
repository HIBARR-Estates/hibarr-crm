<?php

namespace Tests\Feature\FinancialAssessment;

use App\Models\FinancialAssessment;
use App\Models\FinancialAssessmentLine;
use App\Models\Lead;
use App\Scopes\CompanyScope;
use App\Services\CustomFieldMapping\CustomFieldMappingService;
use App\Services\CustomFieldMapping\InvalidMappingException;
use App\Services\FinancialAssessment\AssessmentFieldRegistry;
use App\Services\FinancialAssessment\AssessmentService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\FinancialAssessmentTestCase;

class CustomFieldAssessmentMappingTest extends FinancialAssessmentTestCase
{
    use SetsFeatureFlags;

    private int $sourceId;

    private const OPTIONS = ['currency' => 'EUR', 'frequency' => 'monthly', 'certainty' => 'likely'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->setFeatureFlag('crm.lead-financial-assessments', true);

        Schema::create('custom_field_groups', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('model')->nullable();
        });
        Schema::create('custom_fields', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('custom_field_group_id')->nullable();
            $table->string('label')->nullable();
            $table->string('name')->nullable();
            $table->string('type')->nullable();
            $table->text('values')->nullable();
            $table->unsignedInteger('linked_field_id')->nullable();
        });
        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('custom_field_id');
            $table->string('model');
            $table->unsignedInteger('model_id');
            $table->text('value')->nullable();
        });

        DB::table('custom_field_groups')->insert(['id' => 1, 'company_id' => $this->companyId, 'name' => 'Lead', 'model' => Lead::CUSTOM_FIELD_MODEL]);
        $this->sourceId = DB::table('custom_fields')->insertGetId([
            'company_id' => $this->companyId, 'custom_field_group_id' => 1, 'label' => 'Monthly income', 'name' => 'monthly_income', 'type' => 'text',
        ]);
    }

    protected function tearDown(): void
    {
        foreach (['custom_fields_data', 'custom_fields', 'custom_field_groups'] as $table) {
            Schema::dropIfExists($table);
        }
        parent::tearDown();
    }

    private function value(Lead|int $lead, string $value): void
    {
        DB::table('custom_fields_data')->insert([
            'custom_field_id' => $this->sourceId, 'model' => Lead::CUSTOM_FIELD_MODEL,
            'model_id' => $lead instanceof Lead ? $lead->id : $lead, 'value' => $value,
        ]);
    }

    private function request(array $overrides = []): array
    {
        return array_merge([
            'source_id' => $this->sourceId, 'target_type' => 'defined', 'target_key' => 'assessment.salary',
            'conflict' => 'skip', 'assessment' => self::OPTIONS,
        ], $overrides);
    }

    private function mapping(): CustomFieldMappingService
    {
        return app(CustomFieldMappingService::class);
    }

    private function lines(Lead $lead): Collection
    {
        $draft = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('lead_id', $lead->id)->where('status', 'draft')->first();

        return $draft
            ? FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->get()->keyBy(fn ($l) => $l->type->key)
            : collect();
    }

    public function test_the_dialog_is_offered_one_target_per_active_type(): void
    {
        $targets = collect(app(AssessmentFieldRegistry::class)->mappingTargets($this->companyId))->keyBy('key');

        $this->assertSame('Financial · Salary', $targets['assessment.salary']['label']);
        $this->assertSame('amount', $targets['assessment.salary']['kind']);
        $this->assertSame(Lead::CUSTOM_FIELD_MODEL, $targets['assessment.salary']['model']);
        $this->assertSame(['frequency' => 'monthly', 'certainty' => 'confirmed'], $targets['assessment.salary']['defaults']);
        $this->assertArrayNotHasKey('assessment.metric.available_now', $targets->all());

        $options = app(AssessmentFieldRegistry::class)->mappingOptions($this->companyId);
        $this->assertContains('EUR', $options['currencies']);
        $this->assertContains('BTC', $options['currencies']);
        $this->assertSame(['once', 'monthly', 'yearly'], $options['frequencies']);
        $this->assertSame('EUR', $options['reporting_currency']);
    }

    public function test_a_dry_run_reports_exactly_what_apply_does_and_writes_nothing(): void
    {
        [$a, $b, $c] = [$this->makeLead('A'), $this->makeLead('B'), $this->makeLead('C')];
        $this->value($a, '6.500,50');
        $this->value($b, 'prefers not to say');
        $this->value($c, '€ 7 000');

        $preview = $this->mapping()->run($this->request(), true);

        $this->assertSame(0, FinancialAssessment::withoutGlobalScope(CompanyScope::class)->count(), 'a dry run writes nothing');

        $applied = $this->mapping()->run($this->request(), false);

        foreach (['source_total', 'mapped', 'unchanged', 'skipped_conflict', 'skipped_incompatible', 'no_target_record'] as $key) {
            $this->assertSame($preview[$key], $applied[$key], $key);
        }
        $this->assertSame(3, $applied['source_total']);
        $this->assertSame(2, $applied['mapped']);
        $this->assertSame(1, $applied['skipped_incompatible']);
        $this->assertSame('not an amount', $applied['incompatible_samples'][0]['reason']);
    }

    public function test_amounts_land_in_import_drafts_with_the_chosen_companions_and_never_finalise(): void
    {
        $lead = $this->makeLead();
        $this->value($lead, '6500');

        $this->mapping()->run($this->request(['assessment' => ['currency' => 'EUR', 'frequency' => 'yearly', 'certainty' => 'confirmed']]), false);

        $draft = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('lead_id', $lead->id)->first();
        $this->assertSame('draft', $draft->status->value);
        $this->assertSame('import', $draft->source->value);
        $line = $this->lines($lead)['salary'];
        $this->assertEquals(6500, $line->amount);
        $this->assertSame('yearly', $line->frequency->value);
        $this->assertSame('confirmed', $line->certainty->value);
        $this->assertSame(0, FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('status', 'final')->count());
    }

    public function test_running_it_again_changes_nothing_and_conflicts_follow_the_chosen_rule(): void
    {
        $lead = $this->makeLead();
        $this->value($lead, '6500');
        $this->mapping()->run($this->request(), false);

        $again = $this->mapping()->run($this->request(), false);
        $this->assertSame(1, $again['unchanged']);
        $this->assertSame(0, $again['mapped']);

        // Different companions: "keep" leaves the line, "overwrite" replaces it.
        $changed = ['assessment' => ['currency' => 'EUR', 'frequency' => 'yearly', 'certainty' => 'likely']];
        $kept = $this->mapping()->run($this->request($changed), false);
        $this->assertSame(1, $kept['skipped_conflict']);
        $this->assertSame('monthly', $this->lines($lead)['salary']->frequency->value);

        $replaced = $this->mapping()->run($this->request($changed + ['conflict' => 'overwrite']), false);
        $this->assertSame(1, $replaced['mapped']);
        $this->assertSame('yearly', $this->lines($lead)['salary']->frequency->value);
        $this->assertSame(1, FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->count());
    }

    public function test_a_line_in_the_current_final_assessment_is_respected(): void
    {
        $lead = $this->makeLead();
        $service = app(AssessmentService::class);
        $draft = $service->startDraft($lead);
        $service->addLine($draft, 'salary', ['amount' => 5000, 'frequency' => 'monthly', 'certainty' => 'confirmed']);
        $service->finalise($draft, $this->userId);
        $this->value($lead, '9000');

        $preview = $this->mapping()->run($this->request(), true);
        $this->assertSame(1, $preview['skipped_conflict']);

        $applied = $this->mapping()->run($this->request(['conflict' => 'overwrite']), false);
        $this->assertSame(1, $applied['mapped']);
        $this->assertEquals(9000, $this->lines($lead)['salary']->amount);
        $final = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('status', 'final')->first();
        $this->assertEquals(5000, $final->lines->first()->amount, 'the finalised assessment is never touched');
    }

    public function test_a_value_for_a_lead_that_no_longer_exists_is_reported_not_written(): void
    {
        $this->value(9999, '1000');

        $report = $this->mapping()->run($this->request(), false);

        $this->assertSame(1, $report['no_target_record']);
        $this->assertSame(0, $report['mapped']);
    }

    public function test_the_target_needs_its_companions_and_the_feature(): void
    {
        foreach ([
            ['assessment' => []],
            ['assessment' => ['currency' => 'EUR', 'frequency' => 'monthly']],
            ['assessment' => ['currency' => 'EUR', 'frequency' => 'weekly', 'certainty' => 'likely']],
            ['assessment' => ['currency' => 'WHAT-EVER', 'frequency' => 'monthly', 'certainty' => 'likely']],
        ] as $bad) {
            try {
                $this->mapping()->run($this->request($bad), true);
                $this->fail('Expected the request to be refused: '.json_encode($bad));
            } catch (InvalidMappingException $e) {
                $this->assertStringContainsString('Choose the currency, frequency and certainty', $e->getMessage());
            }
        }

        try {
            $this->mapping()->run($this->request(['target_key' => 'assessment.metric.available_now']), true);
            $this->fail('A read-only metric is not a target');
        } catch (InvalidMappingException) {
            $this->addToAssertionCount(1);
        }

        $this->setFeatureFlag('crm.lead-financial-assessments', false);
        $this->expectException(InvalidMappingException::class);
        $this->mapping()->run($this->request(), true);
    }

    public function test_a_crypto_ticker_is_a_valid_currency_for_the_amounts(): void
    {
        $lead = $this->makeLead();
        $this->value($lead, '0.4');

        $this->mapping()->run($this->request(['assessment' => ['currency' => 'btc', 'frequency' => 'once', 'certainty' => 'likely']]), false);

        $this->assertSame('BTC', $this->lines($lead)['salary']->currency);
    }
}
