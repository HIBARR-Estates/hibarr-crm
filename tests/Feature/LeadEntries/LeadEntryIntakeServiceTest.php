<?php

namespace Tests\Feature\LeadEntries;

use App\Models\DealAutomation;
use App\Models\Lead;
use App\Models\LeadEntry;
use App\Services\DealAutomationService;
use App\Services\LeadEntryContext;
use App\Services\LeadEntryIntakeService;
use Illuminate\Support\Facades\DB;
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

        $entry = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());

        // The entry was stored before routing ran, and is not marked routed.
        $this->assertNotNull($entry);
        $this->assertNull($entry->fresh()->routed_at);
        $this->assertSame(1, LeadEntry::withoutGlobalScopes()->count());
    }

    public function test_routing_that_failed_runs_again_when_the_entry_is_redelivered_and_then_never_again(): void
    {
        $this->enableRouting();
        $calls = 0;
        $engine = Mockery::mock(DealAutomationService::class);
        $engine->shouldReceive('processLead')->andReturnUsing(function () use (&$calls) {
            $calls++;
            if ($calls === 1) {
                throw new \RuntimeException('boom');
            }
        });
        $this->instance(DealAutomationService::class, $engine);

        $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());
        $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());
        $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());

        $this->assertSame(2, $calls);
        $this->assertNotNull(LeadEntry::withoutGlobalScopes()->first()->routed_at);
    }

    public function test_routing_waits_for_a_delivery_whose_deal_job_succeeded(): void
    {
        $this->enableRouting();
        $calls = 0;
        $engine = Mockery::mock(DealAutomationService::class);
        $engine->shouldReceive('processLead')->andReturnUsing(function () use (&$calls) {
            $calls++;
        });
        $this->instance(DealAutomationService::class, $engine);

        // First delivery: the deal job failed. The entry is recorded, routing is held back.
        $entry = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload(), false);
        $this->assertNotNull($entry);
        $this->assertSame(0, $calls);
        $this->assertNull($entry->fresh()->routed_at);

        // The caller retries and the deal job now succeeds: routing runs, once.
        $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload(), true);
        $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload(), true);

        $this->assertSame(1, $calls);
        $this->assertSame(1, LeadEntry::withoutGlobalScopes()->count());
        $this->assertNotNull(LeadEntry::withoutGlobalScopes()->first()->routed_at);
    }

    public function test_an_entry_for_a_lead_of_another_company_is_ignored(): void
    {
        $engine = Mockery::mock(DealAutomationService::class);
        $engine->shouldReceive('processLead')->never();
        $this->instance(DealAutomationService::class, $engine);

        $this->assertNull($this->intake()->receive($this->leadId, $this->companyId + 1, $this->entryPayload()));
        $this->assertSame(0, LeadEntry::withoutGlobalScopes()->count());
    }

    public function test_another_companys_entry_uuid_is_not_handed_back(): void
    {
        $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());
        DB::table('companies')->insert(['id' => 2, 'company_name' => 'Other', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('leads')->insert([
            'id' => 2, 'company_id' => 2, 'client_name' => 'Other lead', 'hash' => md5('o'),
            'next_follow_up' => 'yes', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->assertNull($this->intake()->receive(2, 2, $this->entryPayload()));
    }

    public function test_uuids_are_stored_lower_case_so_scope_checks_and_dedupe_agree(): void
    {
        $upper = $this->entryPayload([
            'uuid' => strtoupper('0193a1c2-0000-7000-8000-00000000000a'),
            'channel' => ['uuid' => strtoupper('0193a1c2-0000-7000-8000-0000000000c3')],
        ]);

        $entry = $this->intake()->receive($this->leadId, $this->companyId, $upper);

        $this->assertSame('0193a1c2-0000-7000-8000-00000000000a', $entry->ol_entry_uuid);
        $this->assertSame('0193a1c2-0000-7000-8000-0000000000c3', $entry->channel_uuid);
        $this->assertSame($entry->id, $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload(['uuid' => '0193A1C2-0000-7000-8000-00000000000A']))->id);
    }

    public function test_over_long_free_text_is_clipped_instead_of_costing_the_entry(): void
    {
        $entry = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload([
            'form_key' => str_repeat('f', 150),
            'language' => 'de-DE-1996-extra',
            'source' => ['label' => str_repeat('l', 400)],
            'context' => ['utm' => ['source' => str_repeat('u', 300)]],
        ]));

        $this->assertNotNull($entry);
        $this->assertSame(100, mb_strlen($entry->form_key));
        $this->assertSame(8, mb_strlen($entry->language));
        $this->assertSame(255, mb_strlen($entry->source_label));
        $this->assertSame(191, mb_strlen($entry->utm_source));
    }

    public function test_an_sla_window_that_does_not_end_after_it_starts_costs_only_the_clock(): void
    {
        foreach ([['18:00', '09:00'], ['09:00', '09:00']] as [$start, $end]) {
            $entry = $this->intake()->store($this->leadId, $this->companyId, $this->entryPayload([
                'uuid' => '0193a1c2-0000-7000-8000-0000000000'.($start === '18:00' ? '0b' : '0c'),
                'sla' => [
                    'first_contact_seconds' => 300,
                    'window' => ['timezone' => 'Europe/Berlin', 'days' => [1, 2, 3], 'start' => $start, 'end' => $end],
                ],
            ]));

            $this->assertNotNull($entry);
            $this->assertNull($entry->sla);
        }
    }

    public function test_an_sla_whose_working_hours_put_the_deadline_years_away_costs_only_the_clock(): void
    {
        $entry = $this->intake()->store($this->leadId, $this->companyId, $this->entryPayload([
            'uuid' => '0193a1c2-0000-7000-8000-0000000000d1',
            'sla' => [
                'first_contact_seconds' => 604800,
                'window' => ['timezone' => 'UTC', 'days' => [1], 'start' => '09:00', 'end' => '09:01'],
            ],
        ]));

        $this->assertNotNull($entry);
        $this->assertNull($entry->sla);
    }

    public function test_values_that_do_not_fit_a_typed_column_cost_the_field_not_the_entry(): void
    {
        $entry = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload([
            'source' => ['entity_type' => str_repeat('t', 80), 'entity_id' => -4],
            'context' => [
                'referral_agent' => ['ol_agent_id' => 'abc', 'crm_user_id' => 99999999999],
                'campaign' => ['attribution_link_uuid' => str_repeat('x', 80)],
            ],
        ]));

        $this->assertNotNull($entry);
        $this->assertSame(32, mb_strlen($entry->source_entity_type));
        $this->assertNull($entry->source_entity_id);
        $this->assertNull($entry->referral_ol_agent_id);
        $this->assertNull($entry->referral_user_id);
        $this->assertNull($entry->attribution_link_uuid);
    }

    public function test_valid_ids_and_link_uuids_are_kept(): void
    {
        $entry = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload([
            'context' => ['campaign' => ['attribution_link_uuid' => '0193A1C2-0000-7000-8000-0000000000AA']],
        ]));

        $this->assertSame(4, $entry->source_entity_id);
        $this->assertSame(57, $entry->referral_ol_agent_id);
        $this->assertSame(214, $entry->referral_user_id);
        $this->assertSame('0193a1c2-0000-7000-8000-0000000000aa', $entry->attribution_link_uuid);
    }

    public function test_a_delivery_that_arrives_while_the_entry_is_being_routed_does_not_route_it_again(): void
    {
        $this->enableRouting();
        $engine = Mockery::mock(DealAutomationService::class);
        $engine->shouldReceive('processLead')->never();
        $this->instance(DealAutomationService::class, $engine);

        $entry = $this->intake()->store($this->leadId, $this->companyId, $this->entryPayload());
        $lock = \Illuminate\Support\Facades\Cache::lock('lead_entry_routing:'.$entry->id, 60);
        $this->assertTrue($lock->get());

        // The first delivery is still running: this one stores nothing new and routes nothing.
        $again = $this->intake()->receive($this->leadId, $this->companyId, $this->entryPayload());

        $this->assertSame($entry->id, $again->id);
        $this->assertNull($entry->fresh()->routed_at);
        $lock->release();
    }
}
