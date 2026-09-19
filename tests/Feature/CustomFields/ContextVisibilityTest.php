<?php

namespace Tests\Feature\CustomFields;

use App\Models\Company;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use App\Models\ShowRuleSet;
use App\Services\CustomFieldVisibilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers CustomFieldVisibilityService's `pipeline` / `pipeline_stage`
 * criterion sources (see resources/js/lib/customFieldVisibility.ts for the
 * mirrored client-side implementation — the two must agree or a field
 * renders client-side but fails server-side validation, or vice versa).
 */
class ContextVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private int $companyId;

    protected function setUp(): void
    {
        parent::setUp();

        CustomFieldGroup::firstOrCreate(['name' => 'Deal'], ['model' => Deal::CUSTOM_FIELD_MODEL]);

        // No CompanyFactory exists in this codebase, and Company has no
        // $fillable (default $guarded = ['*']), so Company::create() would
        // throw a MassAssignmentException — set attributes directly instead.
        // (Matches CustomFieldsWriteOptimizationTest's setUp.)
        $company = new Company;
        $company->company_name = 'Context Visibility Co';
        $company->company_email = 'context@example.com';
        $company->company_phone = '0000000000';
        $company->address = 'Test address';
        $company->save();
        $this->companyId = $company->id;
    }

    private function makeDealField(string $label): CustomField
    {
        $group = CustomFieldGroup::firstOrCreate(
            ['model' => Deal::CUSTOM_FIELD_MODEL],
            ['name' => 'Deal']
        );

        return CustomField::create([
            'custom_field_group_id' => $group->id,
            'label' => $label,
            'name' => \Illuminate\Support\Str::slug($label, '_'),
            'type' => 'text',
            'required' => 'no',
            'export' => 0,
        ]);
    }

    private function makePipeline(string $name): LeadPipeline
    {
        $pipeline = new LeadPipeline;
        $pipeline->name = $name;
        $pipeline->company_id = $this->companyId;
        $pipeline->save();

        return $pipeline;
    }

    private function makeStage(LeadPipeline $pipeline, string $name, int $priority): PipelineStage
    {
        $stage = new PipelineStage;
        $stage->lead_pipeline_id = $pipeline->id;
        $stage->name = $name;
        $stage->type = $name;
        $stage->priority = $priority;
        $stage->company_id = $this->companyId;
        $stage->save();

        return $stage;
    }

    /** @return array<int, array{id: int, priority: int}> */
    private function stagesPayload(PipelineStage ...$stages): array
    {
        return array_map(
            fn (PipelineStage $s) => ['id' => $s->fresh()->id, 'priority' => $s->fresh()->priority],
            $stages
        );
    }

    private function ruleSetWithCriterion(CustomField $field, array $criterionData, bool $defaultVisibility = false, string $groupOperator = 'AND'): void
    {
        $ruleSet = ShowRuleSet::create([
            'field_id' => $field->id,
            'default_visibility' => $defaultVisibility,
            'enabled' => true,
            'groups_operator' => 'AND',
        ]);

        $group = $ruleSet->groups()->create([
            'group_operator' => $groupOperator,
            'enabled' => true,
            'visibility_action' => 'show',
        ]);

        foreach ($criterionData as $criterion) {
            $group->criteria()->create($criterion);
        }
    }

    public function test_pipeline_equals_matches_and_mismatches(): void
    {
        $pipelineA = $this->makePipeline('Sales');
        $pipelineB = $this->makePipeline('Lettings');
        $field = $this->makeDealField('Proof of address');

        $this->ruleSetWithCriterion($field, [[
            'reference_source' => 'pipeline',
            'operator' => 'equals',
            'reference_value' => (string) $pipelineA->id,
        ]]);

        $service = new CustomFieldVisibilityService;

        $this->assertTrue($service->evaluate($field->id, ['pipeline' => $pipelineA->id]));
        $this->assertFalse($service->evaluate($field->id, ['pipeline' => $pipelineB->id]));
    }

    public function test_record_in_matches_and_mismatches(): void
    {
        $field = $this->makeDealField('Confidentiality addendum');

        $this->ruleSetWithCriterion($field, [[
            'reference_source' => 'record',
            'operator' => 'in',
            'reference_value' => json_encode([45, 67]),
        ]]);

        $service = new CustomFieldVisibilityService;

        $this->assertTrue($service->evaluate($field->id, ['record' => 45]));
        $this->assertTrue($service->evaluate($field->id, ['record' => 67]));
        $this->assertFalse($service->evaluate($field->id, ['record' => 90]));
    }

    public function test_a_ruleset_with_no_groups_falls_back_to_default_visibility_regardless_of_context(): void
    {
        $field = $this->makeDealField('Always hidden by default');

        ShowRuleSet::create([
            'field_id' => $field->id,
            'default_visibility' => false,
            'enabled' => true,
            'groups_operator' => 'AND',
        ]);

        $service = new CustomFieldVisibilityService;

        // No context at all — not even a 'pipeline' key — still resolves
        // through default_visibility rather than erroring or defaulting true.
        $this->assertFalse($service->evaluate($field->id, []));
    }

    public function test_pipeline_stage_gte_resolves_by_priority_and_survives_reorder(): void
    {
        $pipeline = $this->makePipeline('Sales');
        $stageA = $this->makeStage($pipeline, 'Prospect', 1);
        $stageB = $this->makeStage($pipeline, 'Contract', 2);
        $stageC = $this->makeStage($pipeline, 'Closed', 3);

        $field = $this->makeDealField('Signed contract');

        $this->ruleSetWithCriterion($field, [[
            'reference_source' => 'pipeline_stage',
            'operator' => '>=',
            'reference_value' => (string) $stageB->id,
        ]]);

        $service = new CustomFieldVisibilityService;
        $stages = $this->stagesPayload($stageA, $stageB, $stageC);

        $this->assertTrue($service->evaluate($field->id, ['pipeline_stage' => $stageC->id], $stages));
        $this->assertTrue($service->evaluate($field->id, ['pipeline_stage' => $stageB->id], $stages));
        $this->assertFalse($service->evaluate($field->id, ['pipeline_stage' => $stageA->id], $stages));

        // Reorder: Prospect now comes after Contract/Closed (stage ids are
        // unchanged — only priority moves), so the ">= Contract" comparison
        // must flip based on the new priorities, not the original ones.
        $stageA->priority = 10;
        $stageA->save();
        $reorderedStages = $this->stagesPayload($stageA, $stageB, $stageC);

        $this->assertTrue($service->evaluate($field->id, ['pipeline_stage' => $stageA->id], $reorderedStages));
    }

    public function test_mixed_group_combining_pipeline_and_field_value_and_or(): void
    {
        $pipeline = $this->makePipeline('Sales');
        $otherPipeline = $this->makePipeline('Lettings');
        $flagField = $this->makeDealField('Ready for signature');
        $field = $this->makeDealField('Signature upload');

        // AND: both the pipeline and the flag field must match.
        $this->ruleSetWithCriterion($field, [
            [
                'reference_source' => 'pipeline',
                'operator' => 'equals',
                'reference_value' => (string) $pipeline->id,
            ],
            [
                'reference_source' => 'custom_field',
                'reference_field_id' => $flagField->id,
                'operator' => 'equals',
                'reference_value' => 'Yes',
            ],
        ], false, 'AND');

        $service = new CustomFieldVisibilityService;

        $this->assertTrue($service->evaluate($field->id, [
            'pipeline' => $pipeline->id,
            'field_'.$flagField->id => 'Yes',
        ]));

        $this->assertFalse($service->evaluate($field->id, [
            'pipeline' => $otherPipeline->id,
            'field_'.$flagField->id => 'Yes',
        ]));

        // OR: either the pipeline or the flag field matching is enough.
        $orField = $this->makeDealField('Signature upload (OR)');
        $this->ruleSetWithCriterion($orField, [
            [
                'reference_source' => 'pipeline',
                'operator' => 'equals',
                'reference_value' => (string) $pipeline->id,
            ],
            [
                'reference_source' => 'custom_field',
                'reference_field_id' => $flagField->id,
                'operator' => 'equals',
                'reference_value' => 'Yes',
            ],
        ], false, 'OR');

        $this->assertTrue($service->evaluate($orField->id, [
            'pipeline' => $otherPipeline->id,
            'field_'.$flagField->id => 'Yes',
        ]));

        $this->assertFalse($service->evaluate($orField->id, [
            'pipeline' => $otherPipeline->id,
            'field_'.$flagField->id => 'No',
        ]));
    }
}
