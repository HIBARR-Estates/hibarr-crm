<?php

namespace Tests\Unit\Support;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\User;
use App\Support\MeetingAttendeeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MeetingAttendeeResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_resolves_participant_emails_and_lead_email(): void
    {
        $companyId = 1;

        $participant = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'agent@hibarr.de',
            'status' => 'active',
        ]);

        $lead = Lead::factory()->create([
            'company_id' => $companyId,
            'client_email' => 'client@example.com',
            'client_name' => 'Client Name',
        ]);

        $deal = Deal::factory()->create([
            'company_id' => $companyId,
            'lead_id' => $lead->id,
        ]);

        $followUp = new DealFollowUp;
        $followUp->deal_id = $deal->id;
        $followUp->participants = [(string) $participant->id];
        $followUp->save();

        $emails = MeetingAttendeeResolver::resolveAttendeeEmails($followUp->fresh(['deal.contact', 'lead']));

        $this->assertContains('agent@hibarr.de', $emails);
        $this->assertContains('client@example.com', $emails);
    }

    public function test_it_normalizes_string_participant_ids(): void
    {
        $participant = User::factory()->create([
            'email' => 'teammate@hibarr.de',
            'status' => 'active',
        ]);

        $followUp = new DealFollowUp;
        $followUp->participants = [(string) $participant->id];
        $followUp->save();

        $ids = MeetingAttendeeResolver::resolveParticipantUserIds($followUp);

        $this->assertSame([$participant->id], $ids);
    }

    public function test_it_resolves_lead_email_from_deal_when_follow_up_has_no_lead_id(): void
    {
        $companyId = 1;

        $lead = Lead::factory()->create([
            'company_id' => $companyId,
            'client_email' => 'client@example.com',
            'client_name' => 'Client Name',
        ]);

        $deal = Deal::factory()->create([
            'company_id' => $companyId,
            'lead_id' => $lead->id,
            'client_email' => 'client@example.com',
            'client_name' => 'Client Name',
        ]);

        $followUp = new DealFollowUp;
        $followUp->deal_id = $deal->id;
        $followUp->participants = [];
        $followUp->save();

        $emails = MeetingAttendeeResolver::resolveAttendeeEmails($followUp->fresh());

        $this->assertContains('client@example.com', $emails);
    }

    public function test_it_includes_deal_agent_email_without_being_a_participant(): void
    {
        $companyId = 1;

        $creator = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'creator@hibarr.de',
            'status' => 'active',
        ]);

        $dealAgentUser = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'deal-agent@hibarr.de',
            'status' => 'active',
        ]);

        $watcher = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'watcher@hibarr.de',
            'status' => 'active',
        ]);

        $participant = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'participant@hibarr.de',
            'status' => 'active',
        ]);

        $leadAgentId = (int) \DB::table('lead_agents')->insertGetId([
            'company_id' => $companyId,
            'user_id' => $dealAgentUser->id,
            'status' => 'enabled',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $lead = Lead::factory()->create([
            'company_id' => $companyId,
            'client_email' => 'client@example.com',
            'client_name' => 'Client Name',
        ]);

        $deal = Deal::factory()->create([
            'company_id' => $companyId,
            'lead_id' => $lead->id,
            'agent_id' => $leadAgentId,
        ]);

        $deal->dealWatchers()->sync([$watcher->id]);

        $followUp = new DealFollowUp;
        $followUp->deal_id = $deal->id;
        $followUp->added_by = $creator->id;
        $followUp->participants = [(string) $participant->id];
        $followUp->save();

        $emails = MeetingAttendeeResolver::resolveAttendeeEmails($followUp->fresh());

        $this->assertContains('participant@hibarr.de', $emails);
        $this->assertContains('deal-agent@hibarr.de', $emails);
        $this->assertContains('client@example.com', $emails);
        $this->assertNotContains('creator@hibarr.de', $emails);
        $this->assertNotContains('watcher@hibarr.de', $emails);
    }

    public function test_it_includes_watcher_email_only_when_they_are_a_participant(): void
    {
        $companyId = 1;

        $watcher = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'watcher@hibarr.de',
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

        $deal->dealWatchers()->sync([$watcher->id]);

        $followUp = new DealFollowUp;
        $followUp->deal_id = $deal->id;
        $followUp->participants = [(string) $watcher->id];
        $followUp->save();

        $emails = MeetingAttendeeResolver::resolveAttendeeEmails($followUp->fresh());

        $this->assertContains('watcher@hibarr.de', $emails);
    }

    public function test_it_excludes_creator_from_zoho_attendee_emails_when_they_are_a_participant(): void
    {
        $companyId = 1;

        $creator = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'creator@hibarr.de',
            'status' => 'active',
        ]);

        $lead = Lead::factory()->create([
            'company_id' => $companyId,
            'client_email' => 'client@example.com',
        ]);

        $followUp = new DealFollowUp;
        $followUp->lead_id = $lead->id;
        $followUp->added_by = $creator->id;
        $followUp->participants = [(string) $creator->id];
        $followUp->save();

        $emails = MeetingAttendeeResolver::resolveAttendeeEmails($followUp->fresh(['lead']));

        $this->assertContains('client@example.com', $emails);
        $this->assertNotContains('creator@hibarr.de', $emails);
    }

    public function test_it_excludes_creator_from_zoho_attendee_emails_when_they_are_the_deal_agent(): void
    {
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

        $followUp = new DealFollowUp;
        $followUp->deal_id = $deal->id;
        $followUp->added_by = $creator->id;
        $followUp->participants = [];
        $followUp->save();

        $emails = MeetingAttendeeResolver::resolveAttendeeEmails($followUp->fresh());

        $this->assertContains('client@example.com', $emails);
        $this->assertNotContains('creator@hibarr.de', $emails);
    }

    public function test_it_excludes_the_host_not_the_creator_from_zoho_attendee_emails(): void
    {
        $companyId = 1;

        $creator = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'creator@hibarr.de',
            'status' => 'active',
        ]);

        $host = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'host@hibarr.de',
            'status' => 'active',
        ]);

        $lead = Lead::factory()->create([
            'company_id' => $companyId,
            'client_email' => 'client@example.com',
        ]);

        $followUp = new DealFollowUp;
        $followUp->lead_id = $lead->id;
        $followUp->added_by = $creator->id;
        $followUp->host_id = $host->id;
        // Creator is not the host here — they're a regular attendee now,
        // not the organizer, so they must stay on the invite.
        $followUp->participants = [(string) $creator->id];
        $followUp->save();

        $emails = MeetingAttendeeResolver::resolveAttendeeEmails($followUp->fresh(['lead']));

        $this->assertContains('creator@hibarr.de', $emails);
        $this->assertNotContains('host@hibarr.de', $emails);
    }

    public function test_it_includes_deal_agent_email_once_when_they_are_also_a_participant(): void
    {
        $companyId = 1;

        $dealAgentUser = User::factory()->create([
            'company_id' => $companyId,
            'email' => 'deal-agent@hibarr.de',
            'status' => 'active',
        ]);

        $leadAgentId = (int) \DB::table('lead_agents')->insertGetId([
            'company_id' => $companyId,
            'user_id' => $dealAgentUser->id,
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

        $followUp = new DealFollowUp;
        $followUp->deal_id = $deal->id;
        $followUp->participants = [(string) $dealAgentUser->id];
        $followUp->save();

        $emails = MeetingAttendeeResolver::resolveAttendeeEmails($followUp->fresh());

        $this->assertSame(
            1,
            count(array_filter($emails, fn (string $email) => $email === 'deal-agent@hibarr.de'))
        );
    }
}
