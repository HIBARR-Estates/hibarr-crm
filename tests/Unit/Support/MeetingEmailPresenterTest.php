<?php

namespace Tests\Unit\Support;

use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\User;
use App\Support\MeetingEmailPresenter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MeetingEmailPresenterTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_builds_lead_facing_created_copy_with_agent_and_schedule(): void
    {
        $agent = User::factory()->create(['name' => 'Jane Agent']);
        $lead = Lead::factory()->create(['client_name' => 'Client Person']);

        $followUp = new DealFollowUp();
        $followUp->lead_id = $lead->id;
        $followUp->added_by = $agent->id;
        $followUp->next_follow_up_date = now()->addDay()->setTime(10, 15);
        $followUp->meeting_link = 'https://meet.example.com/abc';
        $followUp->save();

        $presenter = new MeetingEmailPresenter($followUp->fresh(['addedBy', 'lead']));

        $this->assertStringContainsString('Jane Agent', $presenter->subject(true, true));
        $this->assertStringContainsString('Jane Agent', $presenter->message(true, true));
        $this->assertSame('', $presenter->entityUrl());
        $this->assertSame('https://meet.example.com/abc', $presenter->meetingLink());
        $this->assertNotSame('', $presenter->joinMeetingHtml());
    }

    public function test_it_builds_agent_facing_created_copy_with_crm_link(): void
    {
        $lead = Lead::factory()->create(['client_name' => 'Client Person']);

        $followUp = new DealFollowUp();
        $followUp->lead_id = $lead->id;
        $followUp->next_follow_up_date = now()->addDay()->setTime(10, 15);
        $followUp->meeting_link = 'https://meet.example.com/abc';
        $followUp->save();

        $presenter = new MeetingEmailPresenter($followUp->fresh(['lead']));

        $this->assertStringContainsString('Client Person', $presenter->subject(false, true));
        $this->assertStringContainsString('Client Person', $presenter->message(false, true));
        $this->assertStringContainsString('lead-contact', $presenter->entityUrl());
        $this->assertSame(__('email.meetingCreated.viewLead'), $presenter->actionText(false));
    }

    public function test_it_builds_plunk_html_fragments_for_agent_and_lead_recipients(): void
    {
        $detailHtml = MeetingEmailPresenter::buildMeetingDetailHtml(
            'Jan 15, 2026 &ensp;&middot;&ensp; 10:15',
            "Line one\nLine two",
            'Agenda'
        );

        $this->assertStringContainsString('Jan 15, 2026', $detailHtml);
        $this->assertStringContainsString('Agenda', $detailHtml);
        $this->assertStringNotContainsString('Client Person', $detailHtml);
        $this->assertStringContainsString('Line one<br />', $detailHtml);

        $buttonHtml = MeetingEmailPresenter::buildCrmButtonHtml(
            'https://crm.example.com/deals/1',
            'View deal'
        );

        $this->assertStringContainsString('https://crm.example.com/deals/1', $buttonHtml);
        $this->assertStringContainsString('View deal', $buttonHtml);
        $this->assertSame('', MeetingEmailPresenter::buildCrmButtonHtml('', 'View deal'));
        $this->assertSame('', MeetingEmailPresenter::buildCrmButtonHtml('https://crm.example.com/deals/1', ''));
    }

    public function test_it_builds_reminder_subjects_with_countdown(): void
    {
        $agent = User::factory()->create(['name' => 'Jane Agent']);
        $lead = Lead::factory()->create(['client_name' => 'Client Person']);

        $followUp = new DealFollowUp();
        $followUp->lead_id = $lead->id;
        $followUp->added_by = $agent->id;
        $followUp->next_follow_up_date = now()->addMinutes(10);
        $followUp->save();

        $presenter = new MeetingEmailPresenter($followUp->fresh(['addedBy', 'lead']));

        $leadSubject = $presenter->subject(true, false);
        $this->assertStringContainsString('Reminder:', $leadSubject);
        $this->assertStringContainsString('Jane Agent', $leadSubject);
        $this->assertStringContainsString('in ', $leadSubject);

        $agentSubject = $presenter->subject(false, false);
        $this->assertStringContainsString('Starting soon:', $agentSubject);
        $this->assertStringContainsString('Client Person', $agentSubject);
        $this->assertStringContainsString('in ', $agentSubject);
    }

    public function test_it_builds_agent_reminder_message_with_lead_minutes_and_schedule(): void
    {
        $lead = Lead::factory()->create(['client_name' => 'Client Person']);

        $followUp = new DealFollowUp();
        $followUp->lead_id = $lead->id;
        $followUp->next_follow_up_date = now()->addMinutes(30);
        $followUp->save();

        $presenter = new MeetingEmailPresenter($followUp->fresh(['lead']));
        $message = $presenter->message(false, false);

        $this->assertStringContainsString('Client Person', $message);
        $this->assertStringContainsString('30 minutes', $message);
        $this->assertStringContainsString('scheduled', $message);
    }
}
