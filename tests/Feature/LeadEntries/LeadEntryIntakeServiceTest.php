<?php

namespace Tests\Feature\LeadEntries;

use App\Models\DealAutomation;
use App\Models\Lead;
use App\Models\LeadEntry;
use App\Services\DealAutomationService;
use App\Services\LeadEntryContext;
use App\Services\LeadEntryIntakeService;
use Mockery;

class LeadEntryIntakeServiceTest extends LeadEntryTestCase
{
    private function intake(): LeadEntryIntakeService
    {
        return app(LeadEntryIntakeService::class);
    }

    private function enableRouting(bool $on = true): void
    {
        $this->setFeatureFlag('crm.automation-v2', $on);
        $this->setFeatureFlag('crm.lead-entry-routing', $on);
    }

    public function test_a_valid_entry_is_stored_with_its_channel_snapshot_and_context(): void
    {
        $entry = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());

        $this->assertInstanceOf(LeadEntry::class, $entry);
        $this->assertSame($this->leadId, $entry->lead_id);
        $this->assertSame('0193a1c2-0000-7000-8000-000000000001', $entry->ol_entry_uuid);
        $this->assertSame('Kickoff call (DE)', $entry->channel_name);
        $this->assertSame('consultation_booking', $entry->channel_type);
        $this->assertSame('form', $entry->channel_family);
        $this->assertSame(['market:de', 'kind:call'], $entry->channel_tags);
        $this->assertCount(2, $entry->channel_ancestor_uuids);
        $this->assertTrue($entry->is_new_lead);
        $this->assertSame('crm_meeting_type', $entry->source_entity_type);
        $this->assertSame(4, $entry->source_entity_id);
        $this->assertSame(214, $entry->referral_user_id);
        $this->assertNull($entry->partner_user_id);
        $this->assertSame('house:spring', $entry->campaign_key);
        $this->assertSame('meta', $entry->utm_source);
        $this->assertSame('consult_de', $entry->form_key);
    }

    public function test_the_lineage_is_the_channel_after_its_ancestors(): void
    {
        $entry = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());

        $this->assertSame(
            [
                '0193a1c2-0000-7000-8000-0000000000a1',
                '0193a1c2-0000-7000-8000-0000000000b2',
                '0193a1c2-0000-7000-8000-0000000000c3',
            ],
            $entry->channelLineage()
        );
    }

    public function test_a_repeated_entry_is_stored_once(): void
    {
        $first = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());
        $second = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());

        $this->assertSame($first->id, $second->id);
        $this->assertFalse($second->wasRecentlyCreated);
        $this->assertSame(1, LeadEntry::withoutGlobalScopes()->count());
    }

    public function test_a_malformed_entry_is_ignored_without_throwing(): void
    {
        foreach ([
            ['uuid' => 'not-a-uuid'],
            ['channel' => ['uuid' => null]],
            ['occurred_at' => null],
        ] as $broken) {
            $this->assertNull($this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload($broken)));
        }

        $this->assertNull($this->intake()->receive($this->leadId, $this->companyId, null));
        $this->assertSame(0, LeadEntry::withoutGlobalScopes()->count());
    }

    public function test_a_new_entry_runs_the_lead_entry_received_automations_once_with_itself_as_context(): void
    {
        $this->enableRouting();
        $seen = [];

        $engine = Mockery::mock(DealAutomationService::class);
        $engine->shouldReceive('processLead')
            ->once()
            ->andReturnUsing(function (Lead $lead, ?string $trigger, array $context) use (&$seen) {
                $seen = [
                    'lead' => $lead->id,
                    'trigger' => $trigger,
                    'entry' => $context['entry']->ol_entry_uuid,
                    // The condition resolver only sees the lead, so the entry is also parked here.
                    'parked' => LeadEntryContext::triggeringEntryFor($lead)?->ol_entry_uuid,
                ];
            });
        $this->instance(DealAutomationService::class, $engine);

        $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());
        // A retried delivery of the same entry must not run the automations a second time.
        $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());

        $this->assertSame([
            'lead' => $this->leadId,
            'trigger' => DealAutomation::TRIGGER_LEAD_ENTRY_RECEIVED,
            'entry' => '0193a1c2-0000-7000-8000-000000000001',
            'parked' => '0193a1c2-0000-7000-8000-000000000001',
        ], $seen);
        // Cleared afterwards, so one lead's entry never leaks into the next run.
        $this->assertNull(LeadEntryContext::triggeringEntryFor(Lead::withoutGlobalScopes()->find($this->leadId)));
    }

    public function test_entries_are_stored_but_nothing_runs_while_routing_is_off(): void
    {
        $this->enableRouting(false);
        $engine = Mockery::mock(DealAutomationService::class);
        $engine->shouldReceive('processLead')->never();
        $this->instance(DealAutomationService::class, $engine);

        $entry = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());

        $this->assertNotNull($entry);
        $this->assertSame(1, LeadEntry::withoutGlobalScopes()->count());
    }

    public function test_a_failing_automation_never_fails_the_request_the_entry_rides_on(): void
    {
        $this->enableRouting();
        $engine = Mockery::mock(DealAutomationService::class);
        $engine->shouldReceive('processLead')->andThrow(new \RuntimeException('boom'));
        $this->instance(DealAutomationService::class, $engine);

        $this->assertNull($this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload()));
        // The entry itself was stored before routing ran.
        $this->assertSame(1, LeadEntry::withoutGlobalScopes()->count());
    }
}
