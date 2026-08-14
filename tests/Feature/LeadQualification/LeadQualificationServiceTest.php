<?php

namespace Tests\Feature\LeadQualification;

use App\Enums\QualificationOutcome;
use App\Enums\QualificationStatus;
use App\Models\Lead;
use App\Models\LeadQualification;
use App\Services\LeadQualificationService;
use Illuminate\Validation\ValidationException;
use Tests\LeadQualificationTestCase;

class LeadQualificationServiceTest extends LeadQualificationTestCase
{
    private LeadQualificationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAsSessionUser();
        $this->mock(\App\Services\CrmEventService::class, function ($mock) {
            $mock->shouldReceive('record')->andReturn(null);
            $mock->shouldReceive('startCorrelation')->andReturn('test-correlation');
        });
        $this->service = app(LeadQualificationService::class);
    }

    public function test_start_creates_in_progress_qualification_and_sets_qualifying_status(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);

        $qualification = $this->service->start($lead, [
            'template_id' => '3',
            'template_version' => 1,
            'template_name' => 'HIBARR Third Script',
            'agent_language' => 'en',
            'agent_id' => $this->userId,
        ]);

        $this->assertSame(QualificationStatus::InProgress, $qualification->status);
        $this->assertSame('HIBARR Third Script', $qualification->template_name);

        $statusKey = \Illuminate\Support\Facades\DB::table('lead_lifecycle_statuses')
            ->where('id', \Illuminate\Support\Facades\DB::table('leads')->where('id', $this->leadId)->value('lead_lifecycle_status_id'))
            ->value('key');
        $this->assertSame('qualifying', $statusKey);
    }

    public function test_complete_maps_book_meeting_to_qualified_status(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $qualification = $this->service->start($lead, [
            'template_id' => '3',
            'template_version' => 1,
            'agent_language' => 'en',
            'agent_id' => $this->userId,
        ]);

        $completed = $this->service->complete($qualification, [
            'outcome' => QualificationOutcome::BookMeeting->value,
            'selected_branch_keys' => ['join_the_cage'],
        ])['qualification'];

        $this->assertSame(QualificationStatus::Completed, $completed->status);
        $this->assertSame(QualificationOutcome::BookMeeting, $completed->outcome);
        $this->assertSame([QualificationOutcome::BookMeeting->value], $completed->outcomes);

        $statusKey = \Illuminate\Support\Facades\DB::table('lead_lifecycle_statuses')
            ->where('id', \Illuminate\Support\Facades\DB::table('leads')->where('id', $this->leadId)->value('lead_lifecycle_status_id'))
            ->value('key');
        $this->assertSame('qualified', $statusKey);
    }

    public function test_complete_with_multiple_outcomes_uses_priority_winner(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $qualification = $this->service->start($lead, [
            'template_id' => '3',
            'template_version' => 1,
            'agent_language' => 'en',
            'agent_id' => $this->userId,
        ]);

        $completed = $this->service->complete($qualification, [
            'outcomes' => [
                QualificationOutcome::NoFit->value,
                QualificationOutcome::InviteWebinar->value,
                QualificationOutcome::Callback->value,
            ],
            'outcome_comment' => 'Wants spouse on the call',
            'selected_branch_keys' => ['join_the_cage'],
        ])['qualification'];

        $this->assertSame(QualificationStatus::Completed, $completed->status);
        $this->assertSame(QualificationOutcome::InviteWebinar, $completed->outcome);
        $this->assertSame(
            [
                QualificationOutcome::NoFit->value,
                QualificationOutcome::InviteWebinar->value,
                QualificationOutcome::Callback->value,
            ],
            $completed->outcomes
        );
        $this->assertSame('Wants spouse on the call', $completed->outcome_comment);

        $statusKey = \Illuminate\Support\Facades\DB::table('lead_lifecycle_statuses')
            ->where('id', \Illuminate\Support\Facades\DB::table('leads')->where('id', $this->leadId)->value('lead_lifecycle_status_id'))
            ->value('key');
        $this->assertSame('nurturing', $statusKey);
    }

    public function test_complete_seeds_action_runs_from_payload(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $qualification = $this->service->start($lead, [
            'template_id' => '3',
            'template_version' => 1,
            'agent_language' => 'en',
            'agent_id' => $this->userId,
        ]);

        $completed = $this->service->complete($qualification, [
            'outcomes' => [QualificationOutcome::BookMeeting->value],
            'actions' => [
                ['type' => 'book_consultation', 'config' => ['calendlyUrl' => 'https://example.com']],
                ['type' => 'create_task'],
                ['type' => 'book_consultation'],
            ],
        ])['qualification'];

        $runs = $completed->actionRuns;
        $this->assertCount(2, $runs);
        $this->assertSame('book_consultation', $runs[0]->action_type);
        $this->assertSame(\App\Enums\QualificationActionRunStatus::Pending, $runs[0]->status);
        $this->assertSame('create_task', $runs[1]->action_type);
        $this->assertSame(\App\Enums\QualificationActionRunStatus::Unavailable, $runs[1]->status);
    }

    public function test_mark_action_executed_completes_noop(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $qualification = $this->service->start($lead, [
            'template_id' => '3',
            'template_version' => 1,
            'agent_language' => 'en',
            'agent_id' => $this->userId,
        ]);
        $completed = $this->service->complete($qualification, [
            'outcomes' => [QualificationOutcome::Callback->value],
            'actions' => [['type' => 'schedule_callback']],
        ])['qualification'];
        $run = $completed->actionRuns->first();
        $this->assertNotNull($run);

        $updated = $this->service->markActionExecuted($run, []);
        $this->assertSame(\App\Enums\QualificationActionRunStatus::Completed, $updated->status);
    }

    public function test_mark_action_executed_rejects_coming_soon(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $qualification = $this->service->start($lead, [
            'template_id' => '3',
            'template_version' => 1,
            'agent_language' => 'en',
            'agent_id' => $this->userId,
        ]);
        $completed = $this->service->complete($qualification, [
            'outcomes' => [QualificationOutcome::Callback->value],
            'actions' => [['type' => 'create_task']],
        ])['qualification'];
        $run = $completed->actionRuns->first();
        $this->assertNotNull($run);
        $this->assertSame(\App\Enums\QualificationActionRunStatus::Unavailable, $run->status);

        $this->expectException(ValidationException::class);
        $this->service->markActionExecuted($run, []);
    }

    public function test_upsert_answer_persists_value_codes(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $qualification = $this->service->start($lead, [
            'template_id' => '3',
            'template_version' => 1,
            'agent_language' => 'en',
            'agent_id' => $this->userId,
        ]);

        $answer = $this->service->upsertAnswer($qualification, [
            'segment_key' => 'hibarr_third_script_question_1',
            'answer_values' => ['join_the_cage'],
            'answer_text' => null,
        ]);

        $this->assertSame(['join_the_cage'], $answer->answer_values);
    }

    public function test_clear_branch_answers_deletes_specified_segments(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $qualification = $this->service->start($lead, [
            'template_id' => '3',
            'template_version' => 1,
            'agent_language' => 'en',
            'agent_id' => $this->userId,
        ]);

        $this->service->upsertAnswer($qualification, [
            'segment_key' => 'entry',
            'answer_values' => ['join_the_cage'],
        ]);
        $this->service->upsertAnswer($qualification, [
            'segment_key' => 'branch_question',
            'answer_values' => ['yes'],
        ]);

        $deleted = $this->service->clearBranchAnswers($qualification, ['branch_question']);

        $this->assertSame(1, $deleted);
        $this->assertDatabaseMissing('lead_qualification_answers', [
            'lead_qualification_id' => $qualification->id,
            'segment_key' => 'branch_question',
        ]);
        $this->assertDatabaseHas('lead_qualification_answers', [
            'lead_qualification_id' => $qualification->id,
            'segment_key' => 'entry',
        ]);
    }

    public function test_resolve_workspace_prefers_in_progress_over_completed(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);

        LeadQualification::create([
            'company_id' => $this->companyId,
            'lead_id' => $lead->id,
            'template_id' => '1',
            'template_version' => 1,
            'template_name' => 'Old Script',
            'agent_id' => $this->userId,
            'status' => QualificationStatus::Completed,
            'started_at' => now()->subDays(2),
            'completed_at' => now()->subDays(2),
        ]);

        $inProgress = LeadQualification::create([
            'company_id' => $this->companyId,
            'lead_id' => $lead->id,
            'template_id' => '2',
            'template_version' => 1,
            'template_name' => 'Active Script',
            'agent_id' => $this->userId,
            'status' => QualificationStatus::InProgress,
            'started_at' => now()->subDay(),
        ]);

        $workspace = $this->service->resolveWorkspaceForLead($lead);

        $this->assertSame($inProgress->id, $workspace['current']->id);
        $this->assertCount(1, $workspace['history']);
    }

    public function test_delete_removes_qualification_and_cascades_answers(): void
    {
        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $qualification = $this->service->start($lead, [
            'template_id' => '3',
            'template_version' => 1,
            'agent_language' => 'en',
            'agent_id' => $this->userId,
        ]);

        $this->service->upsertAnswer($qualification, [
            'segment_key' => 'entry',
            'answer_values' => ['join_the_cage'],
        ]);

        $qualificationId = $qualification->id;
        $this->service->delete($qualification);

        $this->assertDatabaseMissing('lead_qualifications', [
            'id' => $qualificationId,
        ]);
        $this->assertDatabaseMissing('lead_qualification_answers', [
            'lead_qualification_id' => $qualificationId,
        ]);
    }
}
