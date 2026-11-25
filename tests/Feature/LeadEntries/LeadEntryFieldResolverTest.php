<?php

namespace Tests\Feature\LeadEntries;

use App\Models\Lead;
use App\Models\LeadEntry;
use App\Services\FieldResolverService;
use App\Services\LeadEntryContext;
use App\Services\LeadEntryFieldResolver;

class LeadEntryFieldResolverTest extends LeadEntryTestCase
{
    private function lead(): Lead
    {
        return Lead::withoutGlobalScopes()->findOrFail($this->leadId);
    }

    private function entry(string $uuidSuffix, array $overrides = [], ?string $occurredAt = null): LeadEntry
    {
        $payload = $this->entryPayload(array_merge([
            'uuid' => '0193a1c2-0000-7000-8000-0000000001'.$uuidSuffix,
            'occurred_at' => $occurredAt ?? now()->toIso8601String(),
        ], $overrides));

        return app(\App\Services\LeadEntryIntakeService::class)->store($this->leadId, $this->companyId, $payload);
    }

    private function resolve(string $field): mixed
    {
        return app(LeadEntryFieldResolver::class)->resolve($this->lead(), $field);
    }

    public function test_only_entry_fields_are_handled(): void
    {
        $resolver = app(LeadEntryFieldResolver::class);

        $this->assertTrue($resolver->handles('entry_channel'));
        $this->assertTrue($resolver->handles('first_entry_channel_type'));
        $this->assertFalse($resolver->handles('client_name'));
        $this->assertFalse($resolver->handles('lead_marketing_utm_source'));
    }

    public function test_the_field_resolver_routes_entry_fields_to_it_and_leaves_other_fields_alone(): void
    {
        $this->entry('01');

        $fields = app(FieldResolverService::class);

        $this->assertSame('consultation_booking', $fields->resolve($this->lead(), 'entry_channel_type'));
        $this->assertSame('Jane Lead', $fields->resolve($this->lead(), 'lead_field_client_name'));
    }

    public function test_the_channel_resolves_to_its_lineage_so_contains_means_in_this_channel_or_below(): void
    {
        $this->entry('01');

        $lineage = $this->resolve('entry_channel');

        $this->assertContains('0193a1c2-0000-7000-8000-0000000000a1', $lineage); // the type root
        $this->assertContains('0193a1c2-0000-7000-8000-0000000000c3', $lineage); // the channel itself
        $this->assertSame(['market:de', 'kind:call'], $this->resolve('entry_channel_tag'));
    }

    public function test_scalar_fields_read_from_the_entry(): void
    {
        $this->entry('01');

        $this->assertSame('consultation_booking', $this->resolve('entry_channel_type'));
        $this->assertSame('form', $this->resolve('entry_channel_family'));
        $this->assertSame('house:spring', $this->resolve('entry_campaign'));
        $this->assertSame(214, $this->resolve('entry_referral_agent'));
        $this->assertNull($this->resolve('entry_partner'));
        $this->assertSame('meta', $this->resolve('entry_utm_source'));
        $this->assertSame('paid_social', $this->resolve('entry_utm_medium'));
        $this->assertSame(1, $this->resolve('entry_is_new_lead'));
    }

    public function test_it_reads_the_triggering_entry_else_the_latest_and_the_first_for_first_entry_fields(): void
    {
        $first = $this->entry('01', ['channel' => ['type' => 'webinar_registration']], now()->subDays(5)->toIso8601String());
        $latest = $this->entry('02', ['channel' => ['type' => 'lead_magnet']], now()->subDay()->toIso8601String());

        // No run in progress: the latest entry answers entry_*, the earliest answers first_entry_*.
        $this->assertSame('lead_magnet', $this->resolve('entry_channel_type'));
        $this->assertSame('webinar_registration', $this->resolve('first_entry_channel_type'));

        // During a run the entry that triggered it wins, even if it is not the latest.
        $seen = LeadEntryContext::run($first, fn () => $this->resolve('entry_channel_type'));
        $this->assertSame('webinar_registration', $seen);
        $this->assertSame($latest->id, LeadEntry::withoutGlobalScopes()->orderByDesc('occurred_at')->first()->id);
    }

    public function test_a_lead_with_no_entries_resolves_nothing_and_counts_zero(): void
    {
        $this->assertNull($this->resolve('entry_channel'));
        $this->assertNull($this->resolve('first_entry_channel_type'));
        $this->assertSame(0, $this->resolve('entry_count_30d'));
    }

    public function test_the_30_day_count_ignores_older_entries(): void
    {
        $this->entry('01', [], now()->subDays(45)->toIso8601String());
        $this->entry('02', [], now()->subDays(3)->toIso8601String());
        $this->entry('03', [], now()->subDay()->toIso8601String());

        $this->assertSame(2, $this->resolve('entry_count_30d'));
    }
}
