<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\LeadEntry;

/**
 * Resolves the `entry_*` / `first_entry_*` condition fields of a lead automation (see
 * AutomationFieldCatalog::ENTRY_FIELDS). Channel and tag fields return arrays, because the condition
 * evaluator's `contains` is the operator that means "in this channel or below" / "has this tag".
 */
class LeadEntryFieldResolver
{
    public function handles(string $field): bool
    {
        return array_key_exists($field, AutomationFieldCatalog::ENTRY_FIELDS);
    }

    public function resolve(Lead $lead, string $field): mixed
    {
        if ($field === 'entry_count_30d') {
            return LeadEntry::query()
                ->where('lead_id', $lead->id)
                ->where('occurred_at', '>=', now()->subDays(30))
                ->count();
        }

        $isFirst = str_starts_with($field, 'first_entry_');
        $entry = $isFirst ? $this->firstEntry($lead) : $this->currentEntry($lead);
        if (! $entry) {
            return null;
        }

        return match ($field) {
            'entry_channel', 'first_entry_channel' => $entry->channelLineage(),
            'entry_channel_type', 'first_entry_channel_type' => $entry->channel_type,
            'entry_channel_family' => $entry->channel_family,
            'entry_channel_tag' => array_values((array) $entry->channel_tags),
            'entry_campaign' => $entry->campaign_key,
            'entry_attribution_link' => $entry->attribution_link_uuid,
            'entry_partner' => $entry->partner_user_id,
            'entry_referral_agent' => $entry->referral_user_id,
            'entry_utm_source' => $entry->utm_source,
            'entry_utm_medium' => $entry->utm_medium,
            // 0/1, so a Yes/No picker compares numerically like the marketing flags do.
            'entry_is_new_lead' => $entry->is_new_lead ? 1 : 0,
            default => null,
        };
    }

    /** The entry that triggered this run, else the lead's latest one. */
    private function currentEntry(Lead $lead): ?LeadEntry
    {
        return LeadEntryContext::triggeringEntryFor($lead)
            ?? LeadEntry::query()->where('lead_id', $lead->id)->orderByDesc('occurred_at')->orderByDesc('id')->first();
    }

    private function firstEntry(Lead $lead): ?LeadEntry
    {
        return LeadEntry::query()->where('lead_id', $lead->id)->orderBy('occurred_at')->orderBy('id')->first();
    }
}
