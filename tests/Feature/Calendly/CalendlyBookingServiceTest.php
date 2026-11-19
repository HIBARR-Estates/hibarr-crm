<?php

namespace Tests\Feature\Calendly;

use App\Models\CalendlyBooking;
use App\Models\DealFollowUp;
use App\Services\ApiV2\CrmWriteService;
use App\Services\CalendlyBookingService;
use App\Support\CalendlyLinkBuilder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;
use Mockery;
use Mockery\MockInterface;

class CalendlyBookingServiceTest extends CalendlyTestCase
{
    private const INVITEE = 'https://api.calendly.com/scheduled_events/EV1/invitees/INV1';

    /** @var CrmWriteService&MockInterface */
    private $crm;

    private CalendlyBookingService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->crm = Mockery::mock(CrmWriteService::class);
        $this->service = new CalendlyBookingService($this->crm);
    }

    private function followUp(int $id): DealFollowUp
    {
        $followUp = new DealFollowUp;
        $followUp->id = $id;

        return $followUp;
    }

    /** What Calendly would send back for a booking made through a link opened here. */
    private function booking(array $overrides = [], string $event = 'invitee.created', string $recordType = 'lead', int $recordId = 5): array
    {
        $link = $this->link(['meeting_type_id' => 3]);
        $url = CalendlyLinkBuilder::build($link, $recordType, $recordId, $this->lead($recordId, 'Ada Lovelace', 'ada@example.com'), 42);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $tracking);

        return [
            'event' => $event,
            'payload' => array_merge([
                'uri' => self::INVITEE,
                'event' => 'https://api.calendly.com/scheduled_events/EV1',
                'tracking' => $tracking,
                'scheduled_event' => [
                    'uri' => 'https://api.calendly.com/scheduled_events/EV1',
                    'name' => 'Intro call',
                    'start_time' => '2026-12-01T10:00:00.000000Z',
                    'end_time' => '2026-12-01T10:45:00.000000Z',
                    'location' => ['type' => 'zoom', 'join_url' => 'https://zoom.us/j/123'],
                ],
            ], $overrides),
        ];
    }

    public function test_a_booking_creates_the_meeting_on_the_lead_it_was_made_for(): void
    {
        $this->crm->shouldReceive('createMeeting')->once()->with($this->companyId, Mockery::on(function (array $data) {
            return $data['lead_id'] === 5
                && ! array_key_exists('deal_id', $data)
                && $data['scheduled_at'] === '2026-12-01T10:00:00.000000Z'
                && $data['duration'] === 45
                && $data['location'] === 'zoom'
                && $data['meeting_link'] === 'https://zoom.us/j/123'
                && $data['meeting_type_id'] === 3
                && $data['created_by_user_id'] === 42
                && str_contains($data['remark'], 'Booked through Calendly: Intro call');
        }))->andReturn($this->followUp(99));

        $this->assertSame(CalendlyBookingService::CREATED, $this->service->handle($this->companyId, $this->booking()));

        $row = CalendlyBooking::firstWhere('invitee_uri', self::INVITEE);
        $this->assertSame(99, (int) $row->follow_up_id);
        $this->assertSame('lead', $row->record_type);
        $this->assertSame(5, (int) $row->record_id);
        $this->assertSame('booked', $row->status);
    }

    public function test_a_booking_made_for_a_deal_creates_the_meeting_on_the_deal(): void
    {
        $this->crm->shouldReceive('createMeeting')->once()->with($this->companyId, Mockery::on(
            fn (array $data) => $data['deal_id'] === 9 && ! array_key_exists('lead_id', $data),
        ))->andReturn($this->followUp(100));

        $this->assertSame(
            CalendlyBookingService::CREATED,
            $this->service->handle($this->companyId, $this->booking([], 'invitee.created', 'deal', 9)),
        );
    }

    public function test_the_same_booking_delivered_twice_creates_one_meeting(): void
    {
        $this->crm->shouldReceive('createMeeting')->once()->andReturn($this->followUp(99));
        $body = $this->booking();

        $this->assertSame(CalendlyBookingService::CREATED, $this->service->handle($this->companyId, $body));
        $this->assertSame(CalendlyBookingService::DUPLICATE, $this->service->handle($this->companyId, $body));
        $this->assertSame(1, CalendlyBooking::count());
    }

    public function test_a_booking_that_did_not_come_from_a_link_made_here_is_left_alone(): void
    {
        $this->crm->shouldNotReceive('createMeeting');

        $untagged = $this->booking(['tracking' => []]);
        $tampered = $this->booking();
        $tampered['payload']['tracking']['utm_campaign'] = '6';

        $this->assertSame(CalendlyBookingService::IGNORED, $this->service->handle($this->companyId, $untagged));
        $this->assertSame(CalendlyBookingService::IGNORED, $this->service->handle($this->companyId, $tampered));
        $this->assertSame(CalendlyBookingService::IGNORED, $this->service->handle($this->companyId, ['event' => 'routing_form_submission.created', 'payload' => []]));
        $this->assertSame(0, CalendlyBooking::count());
    }

    public function test_a_booking_the_crm_refuses_is_dropped_so_it_is_not_retried_forever(): void
    {
        $this->crm->shouldReceive('createMeeting')->once()
            ->andThrow(ValidationException::withMessages(['lead_id' => ['Follow-up is disabled for this user.']]));

        $this->assertSame(CalendlyBookingService::REJECTED, $this->service->handle($this->companyId, $this->booking()));
        $this->assertSame(0, CalendlyBooking::count(), 'the claim is released, nothing looks booked');
    }

    public function test_a_temporary_failure_is_passed_on_and_leaves_room_for_the_retry(): void
    {
        $this->crm->shouldReceive('createMeeting')->once()->andThrow(new \RuntimeException('database went away'));
        $body = $this->booking();

        try {
            $this->service->handle($this->companyId, $body);
            $this->fail('the failure should reach the caller so Calendly retries');
        } catch (\RuntimeException) {
            // expected
        }

        $this->assertSame(0, CalendlyBooking::count());

        $this->crm->shouldReceive('createMeeting')->once()->andReturn($this->followUp(99));
        $this->assertSame(CalendlyBookingService::CREATED, $this->service->handle($this->companyId, $body));
    }

    public function test_a_reschedule_that_arrives_without_the_tag_stays_on_the_same_record(): void
    {
        $this->crm->shouldReceive('createMeeting')->once()->andReturn($this->followUp(99));
        $this->service->handle($this->companyId, $this->booking());

        $rescheduled = $this->booking(['uri' => self::INVITEE.'-NEW', 'tracking' => [], 'old_invitee' => self::INVITEE]);

        $this->crm->shouldReceive('createMeeting')->once()->with($this->companyId, Mockery::on(
            fn (array $data) => $data['lead_id'] === 5 && ! array_key_exists('created_by_user_id', $data),
        ))->andReturn($this->followUp(101));

        $this->assertSame(CalendlyBookingService::CREATED, $this->service->handle($this->companyId, $rescheduled));
        $this->assertSame(2, CalendlyBooking::count());
    }

    public function test_a_cancellation_cancels_the_upcoming_meeting_only(): void
    {
        // Model events (notifications, calendar sync) are the CRM's business, not this test's.
        Event::fake();

        $upcoming = DB::table('lead_follow_up')->insertGetId(['lead_id' => 5, 'status' => 'scheduled']);
        $held = DB::table('lead_follow_up')->insertGetId(['lead_id' => 5, 'status' => 'completed']);
        CalendlyBooking::create(['company_id' => $this->companyId, 'invitee_uri' => self::INVITEE, 'follow_up_id' => $upcoming]);
        CalendlyBooking::create(['company_id' => $this->companyId, 'invitee_uri' => self::INVITEE.'-HELD', 'follow_up_id' => $held]);

        $this->assertSame(CalendlyBookingService::CANCELED, $this->service->handle($this->companyId, ['event' => 'invitee.canceled', 'payload' => ['uri' => self::INVITEE]]));
        $this->assertSame(CalendlyBookingService::CANCELED, $this->service->handle($this->companyId, ['event' => 'invitee.canceled', 'payload' => ['uri' => self::INVITEE.'-HELD']]));

        $this->assertSame('cancelled', DB::table('lead_follow_up')->where('id', $upcoming)->value('status'));
        $this->assertSame('completed', DB::table('lead_follow_up')->where('id', $held)->value('status'), 'a meeting that took place stays on record');
        $this->assertSame('canceled', CalendlyBooking::firstWhere('invitee_uri', self::INVITEE)->status);
    }

    public function test_a_cancellation_for_an_unknown_booking_or_another_company_is_ignored(): void
    {
        CalendlyBooking::create(['company_id' => $this->companyId + 1, 'invitee_uri' => self::INVITEE]);

        $this->assertSame(CalendlyBookingService::IGNORED, $this->service->handle($this->companyId, ['event' => 'invitee.canceled', 'payload' => ['uri' => self::INVITEE]]));
        $this->assertSame(CalendlyBookingService::IGNORED, $this->service->handle($this->companyId, ['event' => 'invitee.canceled', 'payload' => ['uri' => 'nope']]));
    }

    public function test_calendly_location_types_map_to_the_crm_platforms(): void
    {
        $captured = [];
        $this->crm->shouldReceive('createMeeting')->times(4)->andReturnUsing(function ($companyId, array $data) use (&$captured) {
            $captured[] = [$data['location'], $data['meeting_link']];

            return $this->followUp(count($captured));
        });

        foreach ([
            ['google_conference', 'https://meet.google.com/abc'],
            ['microsoft_teams_conference', 'https://teams.microsoft.com/l/xyz'],
            ['outbound_call', null],
            ['custom', 'javascript:alert(1)'],
        ] as $i => [$type, $joinUrl]) {
            $body = $this->booking(['uri' => self::INVITEE.$i]);
            $body['payload']['scheduled_event']['location'] = ['type' => $type, 'join_url' => $joinUrl];
            $this->service->handle($this->companyId, $body);
        }

        $this->assertSame([
            ['google_meet', 'https://meet.google.com/abc'],
            ['teams', 'https://teams.microsoft.com/l/xyz'],
            ['phone', null],
            ['other', null], // only real web addresses become the meeting link
        ], $captured);
    }
}
