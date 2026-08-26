<?php

namespace Tests\Feature\LeadAutomation;

use App\Models\DealAutomationAction;
use App\Models\Lead;
use App\Models\LeadAutomation;
use App\Models\LeadAutomationAction;
use App\Models\LeadAutomationCondition;
use App\Models\LeadAutomationLog;
use App\Models\LeadNote;
use App\Models\ReminderEmailTemplate;
use App\Models\Task;
use App\Models\User;
use App\Notifications\LeadAutomationEmailNotification;
use App\Services\LeadAutomationService;
use App\Services\LeadFieldResolverService;
use App\Support\FeatureFlags;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\LeadAutomationTestCase;

class LeadAutomationEngineTest extends LeadAutomationTestCase
{
    public function test_feature_flag_is_known(): void
    {
        $this->assertContains('crm.lead-automation-engine', config('features.known_flags'));
    }

    public function test_flag_off_skips_evaluation(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', false);

        $automation = $this->makeAutomation(['trigger' => 'lead_updated', 'active' => true]);
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'create_note',
            'payload' => ['title' => 'Should not run', 'details' => 'x'],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        $this->assertSame(0, LeadNote::where('lead_id', $this->leadId)->count());
        $this->assertSame(0, LeadAutomationLog::withoutGlobalScopes()->count());
    }

    public function test_priority_order_highest_first(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);

        $low = $this->makeAutomation(['name' => 'Low', 'priority' => 1, 'trigger' => 'lead_updated']);
        $high = $this->makeAutomation(['name' => 'High', 'priority' => 100, 'trigger' => 'lead_updated']);

        LeadAutomationAction::create([
            'lead_automation_id' => $low->id,
            'action_type' => 'create_note',
            'payload' => ['title' => 'Low note', 'details' => 'low'],
            'priority' => 1,
        ]);
        LeadAutomationAction::create([
            'lead_automation_id' => $high->id,
            'action_type' => 'create_note',
            'payload' => ['title' => 'High note', 'details' => 'high'],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        $titles = LeadNote::where('lead_id', $this->leadId)->orderBy('id')->pluck('title')->all();
        $this->assertSame(['High note', 'Low note'], $titles);
    }

    public function test_execution_is_logged_with_result(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);

        $automation = $this->makeAutomation();
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'create_note',
            'payload' => ['title' => 'Logged note', 'details' => 'body'],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        $log = LeadAutomationLog::withoutGlobalScopes()->first();
        $this->assertNotNull($log);
        $this->assertSame($this->leadId, (int) $log->lead_id);
        $this->assertSame($automation->id, (int) $log->automation_id);
        $this->assertSame('create_note', $log->action);
        $this->assertSame('success', $log->result);
        $this->assertNotNull($log->executed_at);
    }

    public function test_create_note_creates_lead_note(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);

        $automation = $this->makeAutomation();
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'create_note',
            'payload' => ['title' => 'Auto note', 'details' => 'From automation'],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        $note = LeadNote::where('lead_id', $this->leadId)->first();
        $this->assertNotNull($note);
        $this->assertSame('Auto note', $note->title);
    }

    public function test_create_task_attaches_via_taskable(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);
        $this->setFeatureFlag('crm.task-lifecycle-notifications', false);
        $this->setFeatureFlag('crm.entity-reminders', false);

        $this->mock(\App\Services\CrmEventService::class, function ($mock) {
            $mock->shouldReceive('record')->andReturn(null);
            $mock->shouldReceive('startCorrelation')->andReturn('test-correlation');
        });

        $automation = $this->makeAutomation();
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'create_task',
            'payload' => ['heading' => 'Follow up call'],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $company = \App\Models\Company::withoutGlobalScopes()->find($this->companyId);
        session(['company' => $company]);

        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        $taskId = DB::table('tasks')->where('heading', 'Follow up call')->value('id');
        $this->assertNotNull($taskId);

        $attached = DB::table('taskables')
            ->where('task_id', $taskId)
            ->where('taskable_type', Lead::class)
            ->where('taskable_id', $this->leadId)
            ->exists();
        $this->assertTrue($attached);

        $log = LeadAutomationLog::withoutGlobalScopes()->where('action', 'create_task')->first();
        $this->assertSame('success', $log->result);
    }

    public function test_create_task_fails_without_heading(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);

        $automation = $this->makeAutomation();
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'create_task',
            'payload' => [],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        $log = LeadAutomationLog::withoutGlobalScopes()->where('action', 'create_task')->first();
        $this->assertSame('failed', $log->result);
        $this->assertSame(0, Task::withoutGlobalScopes()->count());
    }

    public function test_create_meeting_sets_lead_id_not_deal_id(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);
        $this->setFeatureFlag('integrations.zoho-calendar-sync', false);
        $this->setFeatureFlag('crm.entity-reminders', false);

        $automation = $this->makeAutomation();
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'create_meeting',
            'payload' => [
                'scheduled_at' => now()->addDay()->toIso8601String(),
                'remark' => 'Strategy call',
                'duration' => 30,
            ],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        $meeting = DB::table('lead_follow_up')->first();
        $this->assertNotNull($meeting);
        $this->assertSame($this->leadId, (int) $meeting->lead_id);
        $this->assertNull($meeting->deal_id);

        $log = LeadAutomationLog::withoutGlobalScopes()->where('action', 'create_meeting')->first();
        $this->assertSame('success', $log->result);
    }

    public function test_send_email_uses_reminder_template_and_multi_recipients(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);
        Notification::fake();

        ReminderEmailTemplate::withoutGlobalScopes()->create([
            'company_id' => $this->companyId,
            'entity_type' => 'lead',
            'plunk_template_id' => 'plunk-lead-template-1',
        ]);

        DB::table('users')->insert([
            'id' => 2,
            'company_id' => $this->companyId,
            'name' => 'Extra',
            'email' => 'extra@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $automation = $this->makeAutomation();
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'send_email',
            'payload' => [
                'recipients' => ['client', 'owner'],
                'user_ids' => [2],
            ],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        Notification::assertSentOnDemand(LeadAutomationEmailNotification::class);
        Notification::assertSentTo(
            User::withoutGlobalScopes()->find($this->userId),
            LeadAutomationEmailNotification::class
        );
        Notification::assertSentTo(
            User::withoutGlobalScopes()->find(2),
            LeadAutomationEmailNotification::class
        );

        $log = LeadAutomationLog::withoutGlobalScopes()->where('action', 'send_email')->first();
        $this->assertSame('success', $log->result);
        $this->assertSame('plunk-lead-template-1', $log->details['template_id']);
    }

    public function test_send_email_fails_when_template_missing(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);
        Notification::fake();

        $automation = $this->makeAutomation();
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'send_email',
            'payload' => ['recipients' => ['client']],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        Notification::assertNothingSent();
        $log = LeadAutomationLog::withoutGlobalScopes()->where('action', 'send_email')->first();
        $this->assertSame('failed', $log->result);
    }

    public function test_resolve_all_is_lead_scoped_only(): void
    {
        DB::table('custom_fields_data')->insert([
            'model' => Lead::CUSTOM_FIELD_MODEL,
            'model_id' => $this->leadId,
            'custom_field_id' => 99,
            'value' => 'lead-only-value',
        ]);
        DB::table('custom_fields_data')->insert([
            'model' => 'App\\Models\\Deal',
            'model_id' => 999,
            'custom_field_id' => 99,
            'value' => 'deal-should-not-appear',
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        $context = app(LeadFieldResolverService::class)->resolveAll($lead);

        $this->assertSame('lead-only-value', $context['custom_field_99']);
        $this->assertSame('Jane Lead', $context['client_name']);
        $this->assertNotContains('deal-should-not-appear', $context);
    }

    public function test_conditions_gate_actions(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);

        $automation = $this->makeAutomation();
        LeadAutomationCondition::create([
            'lead_automation_id' => $automation->id,
            'field' => 'client_name',
            'operator' => '=',
            'value' => 'Nobody',
        ]);
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'create_note',
            'payload' => ['title' => 'Nope', 'details' => 'x'],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        $this->assertSame(0, LeadNote::count());
    }

    public function test_deal_automation_action_payload_column_is_nullable(): void
    {
        $row = DealAutomationAction::create([
            'deal_automation_id' => 1,
            'action_type' => 'set_field_value',
            'field_name' => 'note',
            'field_value' => 'x',
            'forward_only' => false,
            'payload' => null,
        ]);

        $this->assertNull($row->fresh()->payload);
        $row->payload = ['extra' => true];
        $row->save();
        $this->assertTrue($row->fresh()->payload['extra']);
    }

    public function test_qualification_completed_trigger(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);

        $automation = $this->makeAutomation([
            'trigger' => 'qualification_completed',
        ]);
        LeadAutomationAction::create([
            'lead_automation_id' => $automation->id,
            'action_type' => 'create_note',
            'payload' => ['title' => 'Post qualify', 'details' => 'done'],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'qualification_completed');

        $this->assertSame(1, LeadNote::where('title', 'Post qualify')->count());
    }

    public function test_inactive_automations_are_skipped(): void
    {
        $this->setFeatureFlag('crm.lead-automation-engine', true);

        $this->makeAutomation(['active' => false]);
        // action on inactive — recreate properly
        $inactive = LeadAutomation::withoutGlobalScopes()->where('active', false)->first();
        LeadAutomationAction::create([
            'lead_automation_id' => $inactive->id,
            'action_type' => 'create_note',
            'payload' => ['title' => 'Inactive', 'details' => 'x'],
            'priority' => 1,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($this->leadId);
        app(LeadAutomationService::class)->process($lead, 'lead_updated');

        $this->assertSame(0, LeadNote::count());
    }
}
