<?php

namespace Tests\Feature\LeadEntries;

use App\Models\CrmEvent;
use App\Models\Lead;
use App\Models\LeadContactSla;
use App\Models\LeadEntry;
use App\Services\LeadContactSlaService;
use App\Services\LeadEntryIntakeService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/** The real service, with timeline events captured instead of written. */
class RecordingSlaService extends LeadContactSlaService
{
    /** @var array<int, array{slug: string, extra: array<string, mixed>}> */
    public array $events = [];

    protected function recordCrmEvent(string $eventTypeSlug, ?Model $model = null, array $extra = []): ?CrmEvent
    {
        $this->events[] = ['slug' => $eventTypeSlug, 'extra' => $extra];

        return null;
    }

    /** @return array<int, string> */
    public function slugs(): array
    {
        return array_column($this->events, 'slug');
    }
}

class LeadContactSlaServiceTest extends LeadEntryTestCase
{
    private RecordingSlaService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setFeatureFlag(LeadContactSlaService::FLAG, true);
        $this->service = new RecordingSlaService;
        $this->freeze('2026-11-25 10:00:00');
        // The seeded lead is owned by user 1; owner-less scenarios clear it.
        $this->makeUser(2);
        $this->makeUser(3);
    }

    protected function tearDown(): void
    {
        \Carbon\Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    /**
     * Freezes the clock for both Carbon flavours: the service reads CarbonImmutable, while Eloquent
     * stamps created_at from Carbon, and the two must agree.
     */
    private function freeze(string $time, ?string $timezone = null): void
    {
        \Carbon\Carbon::setTestNow(\Carbon\Carbon::parse($time, $timezone));
        CarbonImmutable::setTestNow(CarbonImmutable::parse($time, $timezone));
    }

    private function lead(): Lead
    {
        return Lead::withoutGlobalScopes()->findOrFail($this->leadId);
    }

    private function setOwner(?int $userId): void
    {
        $this->lead()->forceFill(['lead_owner' => $userId])->saveQuietly();
    }

    /** @param array<string, mixed> $sla */
    private function entry(array $sla = [], string $uuidSuffix = '01'): LeadEntry
    {
        $sla = array_replace(['first_contact_seconds' => 600, 'recommended_method' => 'call', 'window' => null], $sla);

        return app(LeadEntryIntakeService::class)->store($this->leadId, $this->companyId, $this->entryPayload([
            'uuid' => '0193a1c2-0000-7000-8000-0000000002'.$uuidSuffix,
            'sla' => $sla,
        ]));
    }

    private function sla(LeadEntry $entry): LeadContactSla
    {
        return LeadContactSla::withoutGlobalScopes()->where('lead_entry_id', $entry->id)->firstOrFail();
    }

    public function test_an_entry_without_an_sla_opens_no_clock(): void
    {
        $entry = app(LeadEntryIntakeService::class)->store($this->leadId, $this->companyId, $this->entryPayload());

        $this->assertNull($this->service->openForEntry($entry));
        $this->assertSame(0, LeadContactSla::withoutGlobalScopes()->count());
    }

    public function test_nothing_opens_while_the_flag_is_off(): void
    {
        $this->setFeatureFlag(LeadContactSlaService::FLAG, false);

        $this->assertNull($this->service->openForEntry($this->entry()));
    }

    public function test_the_clock_starts_at_once_when_the_lead_already_has_an_owner(): void
    {
        $this->setOwner(2);

        $row = $this->service->openForEntry($this->entry());

        $this->assertSame('running', $row->status);
        $this->assertSame(2, $row->owner_user_id);
        $this->assertSame('2026-11-25 10:00:00', $row->started_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-11-25 10:10:00', $row->due_at->format('Y-m-d H:i:s'));
        $this->assertSame('call', $row->recommended_method);
        $this->assertSame(['lead_contact_sla_started'], $this->service->slugs());
    }

    public function test_the_clock_waits_for_an_owner_and_starts_when_one_is_assigned(): void
    {
        $this->setOwner(null);
        $entry = $this->entry();

        $row = $this->service->openForEntry($entry);
        $this->assertSame('awaiting_owner', $row->status);
        $this->assertNull($row->due_at);

        $this->freeze('2026-11-25 10:30:00');
        $this->setOwner(3);
        $this->service->ownerAssigned($this->lead());

        $row = $this->sla($entry);
        $this->assertSame('running', $row->status);
        $this->assertSame(3, $row->owner_user_id);
        // Counted from when the agent became responsible, not from when the lead arrived.
        $this->assertSame('2026-11-25 10:40:00', $row->due_at->format('Y-m-d H:i:s'));
    }

    public function test_reassigning_a_running_clock_moves_it_to_the_new_owner_and_keeps_its_deadline(): void
    {
        $this->setOwner(2);
        $entry = $this->entry();
        $this->service->openForEntry($entry);
        $due = $this->sla($entry)->due_at;

        $this->freeze('2026-11-25 10:05:00');
        $this->setOwner(3);
        $this->service->ownerAssigned($this->lead());

        $row = $this->sla($entry);
        $this->assertSame(3, $row->owner_user_id);
        $this->assertTrue($row->due_at->equalTo($due));
    }

    public function test_opening_twice_makes_one_clock(): void
    {
        $this->setOwner(2);
        $entry = $this->entry();

        $first = $this->service->openForEntry($entry);
        $second = $this->service->openForEntry($entry);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, LeadContactSla::withoutGlobalScopes()->count());
    }

    public function test_the_deadline_skips_time_outside_the_working_hours(): void
    {
        $this->setOwner(2);
        // Saturday noon in Berlin; 5 minutes; Monday to Friday 09:00 to 18:00.
        $this->freeze('2026-11-28 12:00:00', 'Europe/Berlin');
        $entry = $this->entry(['first_contact_seconds' => 300, 'window' => [
            'timezone' => 'Europe/Berlin', 'days' => [1, 2, 3, 4, 5], 'start' => '09:00', 'end' => '18:00',
        ]]);

        $row = $this->service->openForEntry($entry);

        $this->assertSame('2026-11-30 09:05:00', CarbonImmutable::instance($row->due_at)->setTimezone('Europe/Berlin')->format('Y-m-d H:i:s'));
    }

    public function test_a_contact_in_time_ends_the_clock_and_records_who_how_and_how_long(): void
    {
        $this->setOwner(2);
        $entry = $this->entry();
        $this->service->openForEntry($entry);
        $this->service->events = [];

        $ended = $this->service->registerContact($this->leadId, 'call', 2, CarbonImmutable::parse('2026-11-25 10:03:12'));

        $this->assertSame(1, $ended);
        $row = $this->sla($entry);
        $this->assertSame('met', $row->status);
        $this->assertTrue($row->met_in_time);
        $this->assertSame('call', $row->contact_method);
        $this->assertSame(2, $row->contacted_by_user_id);
        $this->assertTrue($row->used_recommended_method);
        $this->assertSame(192, $row->elapsed_working_seconds);
        $this->assertNull($row->breached_at);
        $this->assertSame(['lead_contact_sla_met'], $this->service->slugs());
        $this->assertTrue($this->service->events[0]['extra']['metadata']['contacted_by_owner']);
    }

    public function test_a_late_contact_is_logged_as_missed_and_counts_as_a_breach(): void
    {
        $this->setOwner(2);
        $entry = $this->entry(['recommended_method' => 'whatsapp']);
        $this->service->openForEntry($entry);
        $this->service->events = [];

        $this->service->registerContact($this->leadId, 'email', 3, CarbonImmutable::parse('2026-11-25 10:12:03'));

        $row = $this->sla($entry);
        $this->assertFalse($row->met_in_time);
        $this->assertFalse($row->used_recommended_method);
        $this->assertSame(723, $row->elapsed_working_seconds);
        $this->assertSame('2026-11-25 10:10:00', $row->breached_at->format('Y-m-d H:i:s'));
        $this->assertSame(['lead_contact_sla_missed'], $this->service->slugs());
        $this->assertFalse($this->service->events[0]['extra']['metadata']['contacted_by_owner']);
    }

    public function test_contact_exactly_at_the_deadline_is_in_time(): void
    {
        $this->setOwner(2);
        $entry = $this->entry();
        $this->service->openForEntry($entry);

        $this->service->registerContact($this->leadId, 'call', 2, CarbonImmutable::parse('2026-11-25 10:10:00'));

        $this->assertTrue($this->sla($entry)->met_in_time);
    }

    public function test_contact_from_before_the_entry_arrived_does_not_count(): void
    {
        $this->setOwner(2);
        $entry = $this->entry();
        $this->service->openForEntry($entry);

        $ended = $this->service->registerContact($this->leadId, 'call', 2, CarbonImmutable::parse('2026-11-25 09:00:00'));

        $this->assertSame(0, $ended);
        $this->assertSame('running', $this->sla($entry)->status);
    }

    public function test_one_contact_ends_every_open_clock_of_the_lead(): void
    {
        $this->setOwner(2);
        $first = $this->entry([], '01');
        $second = $this->entry([], '02');
        $this->service->openForEntry($first);
        $this->service->openForEntry($second);

        $ended = $this->service->registerContact($this->leadId, 'call', 2, CarbonImmutable::parse('2026-11-25 10:01:00'));

        $this->assertSame(2, $ended);
        $this->assertSame('met', $this->sla($first)->status);
        $this->assertSame('met', $this->sla($second)->status);
        // An ended clock is not ended again.
        $this->assertSame(0, $this->service->registerContact($this->leadId, 'call', 2, CarbonImmutable::parse('2026-11-25 10:02:00')));
    }

    public function test_a_contact_before_anyone_owned_the_lead_cannot_have_been_late(): void
    {
        $this->setOwner(null);
        $entry = $this->entry();
        $this->service->openForEntry($entry);

        $this->service->registerContact($this->leadId, 'email', 3, CarbonImmutable::parse('2026-11-25 14:00:00'));

        $row = $this->sla($entry);
        $this->assertTrue($row->met_in_time);
        $this->assertSame(0, $row->elapsed_working_seconds);
    }

    public function test_the_breach_scan_flags_a_missed_deadline_once(): void
    {
        $this->setOwner(2);
        $entry = $this->entry();
        $this->service->openForEntry($entry);
        $this->service->events = [];

        $this->assertSame(0, $this->service->flagBreaches(CarbonImmutable::parse('2026-11-25 10:09:59')));
        $this->assertSame(1, $this->service->flagBreaches(CarbonImmutable::parse('2026-11-25 10:10:30')));
        $this->assertSame(0, $this->service->flagBreaches(CarbonImmutable::parse('2026-11-25 10:11:30')));

        $row = $this->sla($entry);
        $this->assertSame('running', $row->status);
        $this->assertSame('2026-11-25 10:10:00', $row->breached_at->format('Y-m-d H:i:s'));
        $this->assertSame(['lead_contact_sla_breached'], $this->service->slugs());
    }

    public function test_the_scan_ignores_clocks_that_ended_or_never_started(): void
    {
        $this->setOwner(null);
        $waiting = $this->entry([], '01');
        $this->service->openForEntry($waiting);
        $this->setOwner(2);
        $met = $this->entry([], '02');
        $this->service->openForEntry($met);
        $this->service->registerContact($this->leadId, 'call', 2, CarbonImmutable::parse('2026-11-25 10:01:00'));

        $this->assertSame(0, $this->service->flagBreaches(CarbonImmutable::parse('2026-11-26 10:00:00')));
    }

    public function test_only_outbound_calls_emails_and_whatsapp_messages_count_as_contact(): void
    {
        $this->assertSame('email', $this->service->contactMethodOf('email_sent', []));
        $this->assertSame('whatsapp', $this->service->contactMethodOf('whatsapp_message_sent', []));
        $this->assertSame('call', $this->service->contactMethodOf('call_started', []));
        $this->assertSame('call', $this->service->contactMethodOf('call_started', ['direction' => 'outbound']));
        $this->assertSame('call', $this->service->contactMethodOf('phone_call', []));

        $this->assertNull($this->service->contactMethodOf('call_started', ['direction' => 'inbound']));
        $this->assertNull($this->service->contactMethodOf('call_started', ['metadata' => ['direction' => 'Inbound']]));
        $this->assertNull($this->service->contactMethodOf('email_received', []));
        $this->assertNull($this->service->contactMethodOf('whatsapp_message_received', []));
        $this->assertNull($this->service->contactMethodOf('lead_note_added', []));
    }

    public function test_the_lead_page_shows_the_clock_due_first_else_the_latest_ended_one(): void
    {
        $this->setOwner(2);
        $soon = $this->entry(['first_contact_seconds' => 300], '01');
        $later = $this->entry(['first_contact_seconds' => 900], '02');
        $this->service->openForEntry($soon);
        $this->service->openForEntry($later);

        $this->assertSame($soon->id, $this->service->currentFor($this->leadId)['lead_entry_id']);

        $this->service->registerContact($this->leadId, 'call', 2, CarbonImmutable::parse('2026-11-25 10:01:00'));
        $this->assertSame('met', $this->service->currentFor($this->leadId)['status']);
        $this->assertNull($this->service->currentFor(9999));
    }

    public function test_the_presented_clock_reports_paused_overdue_and_the_servers_time(): void
    {
        $this->setOwner(2);
        $window = ['timezone' => 'Europe/Berlin', 'days' => [1, 2, 3, 4, 5], 'start' => '09:00', 'end' => '18:00'];
        // Friday 17:55 Berlin, 10 minutes: due Monday 09:05.
        $this->freeze('2026-11-27 17:55:00', 'Europe/Berlin');
        $entry = $this->entry(['first_contact_seconds' => 600, 'window' => $window]);
        $row = $this->service->openForEntry($entry);

        $atSaturday = $this->service->present($row, CarbonImmutable::parse('2026-11-28 12:00:00', 'Europe/Berlin'));
        $this->assertTrue($atSaturday['paused']);
        $this->assertFalse($atSaturday['breached']);
        $this->assertSame('2026-11-30T09:00:00+01:00', CarbonImmutable::parse($atSaturday['resumes_at'])->setTimezone('Europe/Berlin')->toIso8601String());

        $atMondayLate = $this->service->present($row, CarbonImmutable::parse('2026-11-30 09:06:00', 'Europe/Berlin'));
        $this->assertFalse($atMondayLate['paused']);
        $this->assertTrue($atMondayLate['breached']);
        $this->assertNotEmpty($atMondayLate['server_now']);
        $this->assertSame('User 2', $this->service->present($row)['owner']['name'] ?? null);
    }
}
