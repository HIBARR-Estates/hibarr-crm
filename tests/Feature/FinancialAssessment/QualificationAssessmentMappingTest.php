<?php

namespace Tests\Feature\FinancialAssessment;

use App\Enums\FinancialAssessmentSource;
use App\Enums\FinancialAssessmentStatus;
use App\Models\FinancialAssessment;
use App\Models\FinancialAssessmentLine;
use App\Models\Lead;
use App\Models\LeadQualification;
use App\Models\LeadQualificationAnswer;
use App\Models\QualificationFieldMapping;
use App\Models\QualificationScriptSetting;
use App\Scopes\CompanyScope;
use App\Services\FinancialAssessment\AssessmentService;
use App\Services\Qualification\LeadFieldCatalog;
use App\Services\Qualification\QualificationLeadFieldWriter;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\FinancialAssessmentTestCase;

class QualificationAssessmentMappingTest extends FinancialAssessmentTestCase
{
    use SetsFeatureFlags;

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
            $table->string('type')->nullable();
            $table->text('values')->nullable();
        });
        Schema::create('lead_category', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('category_name')->nullable();
        });
        Schema::create('qualification_script_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('template_id');
            $table->string('template_name')->nullable();
            $table->boolean('auto_write')->default(true);
            $table->string('webinar_id')->nullable();
            $table->timestamps();
        });
        Schema::create('qualification_field_mappings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('script_setting_id');
            $table->string('segment_key');
            $table->string('lead_field');
            $table->string('write_mode')->default('fill_empty');
            $table->json('option_map')->nullable();
            $table->json('target_options')->nullable();
            $table->timestamps();
        });
        Schema::create('lead_qualifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('lead_id');
            $table->string('template_id');
            $table->unsignedInteger('template_version')->default(1);
            $table->string('template_name')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->string('status')->default('completed');
            $table->json('selected_branch_keys')->nullable();
            $table->string('outcome')->nullable();
            $table->json('outcomes')->nullable();
            $table->text('outcome_comment')->nullable();
            $table->timestamp('outcome_triggered_at')->nullable();
            $table->string('agent_language')->nullable();
            $table->string('current_segment_key')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
        Schema::create('lead_qualification_answers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_qualification_id');
            $table->string('segment_key');
            $table->string('question_label')->nullable();
            $table->json('answer_values')->nullable();
            $table->json('answer_labels')->nullable();
            $table->text('answer_text')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        foreach (['lead_qualification_answers', 'lead_qualifications', 'qualification_field_mappings', 'qualification_script_settings', 'lead_category', 'custom_fields', 'custom_field_groups'] as $table) {
            Schema::dropIfExists($table);
        }
        parent::tearDown();
    }

    /** @param array<string, array{mode?: string, options?: array<string, string>, target?: array<string, string>, text?: string, values?: list<string>}> $questions segment => ... keyed by lead field */
    private function runMapping(Lead $lead, array $questions): array
    {
        // One script setting per template, as in the app: replace the mapping between runs.
        QualificationFieldMapping::query()->delete();
        QualificationScriptSetting::withoutGlobalScopes()->delete();
        $setting = QualificationScriptSetting::create(['company_id' => $this->companyId, 'template_id' => 't1', 'auto_write' => true]);
        $qualification = LeadQualification::create([
            'company_id' => $this->companyId, 'lead_id' => $lead->id, 'template_id' => 't1', 'agent_id' => $this->userId,
            'status' => 'completed', 'started_at' => now(),
        ]);

        foreach ($questions as $field => $q) {
            $segment = 'seg_'.str_replace('.', '_', $field);
            QualificationFieldMapping::create([
                'script_setting_id' => $setting->id, 'segment_key' => $segment, 'lead_field' => $field,
                'write_mode' => $q['mode'] ?? 'fill_empty', 'option_map' => $q['options'] ?? [], 'target_options' => $q['target'] ?? null,
            ]);
            LeadQualificationAnswer::create([
                'lead_qualification_id' => $qualification->id, 'segment_key' => $segment,
                'answer_text' => $q['text'] ?? null, 'answer_values' => $q['values'] ?? [],
            ]);
        }

        return app(QualificationLeadFieldWriter::class)->apply($qualification->fresh('answers'), $lead);
    }

    private function draftLines(Lead $lead): Collection
    {
        $draft = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('lead_id', $lead->id)->where('status', 'draft')->first();

        return $draft
            ? FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->get()->keyBy(fn ($l) => $l->type->key)
            : collect();
    }

    public function test_the_mapping_catalog_offers_assessment_types_as_amount_targets(): void
    {
        $fields = collect(app(LeadFieldCatalog::class)->fields($this->companyId))->keyBy('value');

        $salary = $fields['assessment.salary'];
        $this->assertSame('Financial assessment', $salary['group']);
        $this->assertSame('Salary', $salary['label']);
        $this->assertTrue($salary['amount']);
        $this->assertSame([], $salary['values']);
        $this->assertSame(['frequency' => 'monthly', 'certainty' => 'confirmed'], $salary['defaults']);
        $this->assertArrayNotHasKey('assessment.metric.available_now', $fields->all());
    }

    public function test_a_typed_amount_is_written_into_a_call_draft_with_the_mapped_companions(): void
    {
        $lead = $this->makeLead();

        $written = $this->runMapping($lead, [
            'assessment.salary' => ['text' => '€ 6.500,50', 'target' => ['frequency' => 'yearly', 'certainty' => 'likely', 'currency' => 'EUR']],
        ]);

        $this->assertSame(['assessment.salary'], $written);
        $line = $this->draftLines($lead)['salary'];
        $this->assertEquals(6500.5, $line->amount);
        $this->assertSame('yearly', $line->frequency->value);
        $this->assertSame('likely', $line->certainty->value);
        $draft = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('lead_id', $lead->id)->first();
        $this->assertSame(FinancialAssessmentSource::Call, $draft->source);
        $this->assertSame($this->userId, (int) $draft->prepared_by_user_id);
        $this->assertSame(FinancialAssessmentStatus::Draft, $draft->status);
    }

    public function test_a_choice_answer_is_read_through_the_option_map_as_an_amount(): void
    {
        $lead = $this->makeLead();

        $written = $this->runMapping($lead, [
            'assessment.bank' => ['values' => ['opt_5_10k'], 'options' => ['opt_5_10k' => '7500', 'opt_10_20k' => '15000']],
        ]);

        $this->assertSame(['assessment.bank'], $written);
        $this->assertEquals(7500, $this->draftLines($lead)['bank']->amount);
    }

    public function test_only_if_empty_leaves_a_known_type_alone_but_overwrite_replaces_it(): void
    {
        $lead = $this->makeLead();
        $service = app(AssessmentService::class);
        $first = $service->startDraft($lead);
        $service->addLine($first, 'bank', ['amount' => 38000]);
        $service->finalise($first, $this->userId);

        $skipped = $this->runMapping($lead, ['assessment.bank' => ['text' => '42000']]);
        $this->assertSame([], $skipped);
        $this->assertEquals(38000, $this->draftLines($lead)['bank']->amount, 'the copied line was left alone');

        $written = $this->runMapping($lead, ['assessment.bank' => ['text' => '42000', 'mode' => 'overwrite']]);
        $this->assertSame(['assessment.bank'], $written);
        $this->assertEquals(42000, $this->draftLines($lead)['bank']->amount);
        $this->assertSame(1, FinancialAssessment::withoutGlobalScope(CompanyScope::class)->where('status', 'final')->count(), 'the call never finalises');
    }

    public function test_an_answer_that_is_not_an_amount_writes_nothing_and_starts_no_draft(): void
    {
        $lead = $this->makeLead();

        $written = $this->runMapping($lead, ['assessment.salary' => ['text' => 'prefers not to say']]);

        $this->assertSame([], $written);
        $this->assertSame(0, FinancialAssessment::withoutGlobalScope(CompanyScope::class)->count());
    }

    public function test_one_refused_field_does_not_stop_the_others(): void
    {
        $lead = $this->makeLead();

        $written = $this->runMapping($lead, [
            'assessment.salary' => ['text' => '6500'],
            'assessment.bank' => ['text' => '1000', 'target' => ['currency' => 'NOT-A-CURRENCY']],
            'assessment.rent' => ['text' => '900'],
        ]);

        $this->assertSame(['assessment.salary', 'assessment.rent'], $written);
        $this->assertEqualsCanonicalizing(['salary', 'rent'], $this->draftLines($lead)->keys()->all());
    }
}
