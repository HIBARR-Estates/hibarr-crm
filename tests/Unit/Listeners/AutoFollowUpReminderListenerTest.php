<?php

namespace Tests\Unit\Listeners;

use App\Events\AutoFollowUpReminderEvent;
use App\Listeners\AutoFollowUpReminderListener;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\User;
use App\Notifications\AutoFollowUpReminder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AutoFollowUpReminderListenerTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_does_not_notify_creator_when_they_are_a_participant_on_meeting_created(): void
    {
        Notification::fake();

        $companyId = 1;

        $creator = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'creator@hibarr.de',
            'status' => 'active',
        ]);

        $otherParticipant = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'other@hibarr.de',
            'status' => 'active',
        ]);

        $lead = Lead::factory()->create([
            'company_id' => $companyId,
            'client_email' => 'client@example.com',
        ]);

        $deal = Deal::factory()->create([
            'company_id' => $companyId,
            'lead_id' => $lead->id,
        ]);

        $followUp = new DealFollowUp();
        $followUp->deal_id = $deal->id;
        $followUp->added_by = $creator->id;
        $followUp->participants = [(string) $creator->id, (string) $otherParticipant->id];
        $followUp->next_follow_up_date = now()->addDay();
        $followUp->save();

        $listener = new AutoFollowUpReminderListener();
        $listener->handle(new AutoFollowUpReminderEvent($followUp->fresh(['deal.contact']), true));

        Notification::assertSentTo($otherParticipant, AutoFollowUpReminder::class);
        Notification::assertNotSentTo($creator, AutoFollowUpReminder::class);
    }

    public function test_it_does_not_notify_creator_when_they_are_the_deal_agent_on_meeting_created(): void
    {
        Notification::fake();

        $companyId = 1;

        $creator = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'creator@hibarr.de',
            'status' => 'active',
        ]);

        $leadAgentId = (int) \DB::table('lead_agents')->insertGetId([
            'company_id' => $companyId,
            'user_id' => $creator->id,
            'status' => 'enabled',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $lead = Lead::factory()->create([
            'company_id' => $companyId,
            'client_email' => 'client@example.com',
        ]);

        $deal = Deal::factory()->create([
            'company_id' => $companyId,
            'lead_id' => $lead->id,
            'agent_id' => $leadAgentId,
        ]);

        $followUp = new DealFollowUp();
        $followUp->deal_id = $deal->id;
        $followUp->added_by = $creator->id;
        $followUp->participants = [(string) $creator->id];
        $followUp->next_follow_up_date = now()->addDay();
        $followUp->save();

        $listener = new AutoFollowUpReminderListener();
        $listener->handle(new AutoFollowUpReminderEvent($followUp->fresh(['deal.leadAgent.user', 'deal.contact']), true));

        Notification::assertNotSentTo($creator, AutoFollowUpReminder::class);
    }

    public function test_it_notifies_deal_agent_once_when_they_are_also_a_participant(): void
    {
        Notification::fake();

        $companyId = 1;

        $dealAgent = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'deal-agent@hibarr.de',
            'status' => 'active',
        ]);

        $creator = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'creator@hibarr.de',
            'status' => 'active',
        ]);

        $leadAgentId = (int) \DB::table('lead_agents')->insertGetId([
            'company_id' => $companyId,
            'user_id' => $dealAgent->id,
            'status' => 'enabled',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $lead = Lead::factory()->create([
            'company_id' => $companyId,
            'client_email' => 'client@example.com',
        ]);

        $deal = Deal::factory()->create([
            'company_id' => $companyId,
            'lead_id' => $lead->id,
            'agent_id' => $leadAgentId,
        ]);

        $followUp = new DealFollowUp();
        $followUp->deal_id = $deal->id;
        $followUp->added_by = $creator->id;
        $followUp->participants = [(string) $dealAgent->id];
        $followUp->next_follow_up_date = now()->addDay();
        $followUp->save();

        $listener = new AutoFollowUpReminderListener();
        $listener->handle(new AutoFollowUpReminderEvent($followUp->fresh(['deal.leadAgent.user', 'deal.contact']), true));

        Notification::assertSentTo($dealAgent, AutoFollowUpReminder::class);
        Notification::assertNotSentTo($creator, AutoFollowUpReminder::class);
        Notification::assertSentTimes(AutoFollowUpReminder::class, 2);
    }
}
