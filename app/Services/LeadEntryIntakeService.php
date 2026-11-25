<?php

namespace App\Services;

use App\Models\DealAutomation;
use App\Models\Lead;
use App\Models\LeadEntry;
use App\Support\LeadEntryRouting;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Takes the `entry` block the backend (OL) sends with a contact or deal request: stores it as a
 * LeadEntry and, once, fires the `lead_entry_received` trigger.
 *
 * Never throws. A malformed or failing entry must not fail the contact/deal request it rides on,
 * which has already done its real work by the time this runs.
 */
class LeadEntryIntakeService
{
    /**
     * Stores the entry (idempotent on its uuid) and runs the lead automations it triggers. A repeat
     * of an entry already stored returns it without running anything a second time.
     *
     * @param  array<string, mixed>|null  $payload  The request's `entry` block.
     */
    public function receive(int $leadId, int $companyId, ?array $payload): ?LeadEntry
    {
        if (! $payload) {
            return null;
        }

        try {
            $entry = $this->store($leadId, $companyId, $payload);
            if ($entry?->wasRecentlyCreated) {
                $this->route($entry);
                // After routing, so an owner assigned by an automation starts the clock straight away.
                app(LeadContactSlaService::class)->openForEntry($entry);
            }

            return $entry;
        } catch (\Throwable $e) {
            Log::error('LeadEntryIntakeService: failed to process entry', [
                'lead_id' => $leadId,
                'entry_uuid' => $payload['uuid'] ?? null,
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function store(int $leadId, int $companyId, array $payload): ?LeadEntry
    {
        $validator = Validator::make($payload, [
            'uuid' => 'required|uuid',
            'occurred_at' => 'required|date',
            'is_new_lead' => 'nullable|boolean',
            'resolved_by' => 'nullable|string|max:16',
            'channel' => 'required|array',
            'channel.uuid' => 'required|uuid',
            'channel.key' => 'required|string|max:100',
            'channel.name' => 'required|string|max:191',
            'channel.type' => 'required|string|max:48',
            'channel.family' => 'nullable|string|max:24',
            'channel.path' => 'required|string|max:512',
            'channel.ancestor_uuids' => 'nullable|array',
            'channel.ancestor_uuids.*' => 'uuid',
            'channel.tags' => 'nullable|array',
            'channel.tags.*' => 'string|max:64',
            'source' => 'nullable|array',
            'context' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            Log::warning('LeadEntryIntakeService: ignoring a malformed entry', [
                'lead_id' => $leadId,
                'errors' => $validator->errors()->toArray(),
            ]);

            return null;
        }

        $existing = LeadEntry::withoutGlobalScopes()->where('ol_entry_uuid', $payload['uuid'])->first();
        if ($existing) {
            return $existing;
        }

        $channel = $payload['channel'];
        $source = (array) ($payload['source'] ?? []);
        $context = (array) ($payload['context'] ?? []);
        $campaign = (array) ($context['campaign'] ?? []);
        $utm = (array) ($context['utm'] ?? []);

        try {
            return LeadEntry::withoutGlobalScopes()->create([
                'company_id' => $companyId,
                'lead_id' => $leadId,
                'ol_entry_uuid' => $payload['uuid'],
                'channel_uuid' => $channel['uuid'],
                'channel_key' => $channel['key'],
                'channel_name' => $channel['name'],
                'channel_type' => $channel['type'],
                'channel_family' => $channel['family'] ?? null,
                'channel_path' => $channel['path'],
                'channel_ancestor_uuids' => array_values($channel['ancestor_uuids'] ?? []),
                'channel_tags' => array_values($channel['tags'] ?? []),
                'sla' => $this->validSla($payload['sla'] ?? null, $leadId),
                'source_entity_type' => $source['entity_type'] ?? null,
                'source_entity_id' => $source['entity_id'] ?? null,
                'source_entity_key' => $source['entity_key'] ?? null,
                'source_label' => $source['label'] ?? null,
                'is_new_lead' => (bool) ($payload['is_new_lead'] ?? false),
                'resolved_by' => $payload['resolved_by'] ?? 'type_default',
                'occurred_at' => $payload['occurred_at'],
                'referral_ol_agent_id' => $context['referral_agent']['ol_agent_id'] ?? null,
                'referral_user_id' => $context['referral_agent']['crm_user_id'] ?? null,
                'partner_ol_agent_id' => $context['partner']['ol_agent_id'] ?? null,
                'partner_user_id' => $context['partner']['crm_user_id'] ?? null,
                'campaign_key' => $campaign['key'] ?? null,
                'campaign_matched_by' => $campaign['matched_by'] ?? null,
                'campaign_value' => $campaign['value'] ?? null,
                'campaign_label' => $campaign['label'] ?? null,
                'attribution_link_uuid' => $campaign['attribution_link_uuid'] ?? null,
                'utm_source' => $utm['source'] ?? $utm['utmSource'] ?? null,
                'utm_medium' => $utm['medium'] ?? $utm['utmMedium'] ?? null,
                'utm_campaign' => $utm['campaign'] ?? $utm['utmCampaign'] ?? null,
                'form_key' => $payload['form_key'] ?? null,
                'language' => $payload['language'] ?? null,
                'payload' => $payload,
            ]);
        } catch (QueryException $e) {
            // Two deliveries of one entry racing: the other request's row wins.
            $winner = LeadEntry::withoutGlobalScopes()->where('ol_entry_uuid', $payload['uuid'])->first();
            if ($winner) {
                return $winner;
            }

            throw $e;
        }
    }

    /**
     * The entry's first-contact SLA, or null when none was sent or it is malformed. A bad SLA costs
     * only the clock, never the entry.
     *
     * @return array{first_contact_seconds: int, recommended_method: ?string, window: ?array<string, mixed>}|null
     */
    private function validSla(mixed $sla, int $leadId): ?array
    {
        if (! is_array($sla)) {
            return null;
        }

        $validator = Validator::make($sla, [
            'first_contact_seconds' => 'required|integer|min:1|max:604800',
            'recommended_method' => 'nullable|in:call,whatsapp,email',
            'window' => 'nullable|array',
            'window.timezone' => 'required_with:window|timezone',
            'window.days' => 'required_with:window|array|min:1',
            'window.days.*' => 'integer|between:1,7',
            'window.start' => ['required_with:window', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'window.end' => ['required_with:window', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
        ]);

        if ($validator->fails()) {
            Log::warning('LeadEntryIntakeService: ignoring a malformed SLA', [
                'lead_id' => $leadId,
                'errors' => $validator->errors()->toArray(),
            ]);

            return null;
        }

        return [
            'first_contact_seconds' => (int) $sla['first_contact_seconds'],
            'recommended_method' => $sla['recommended_method'] ?? null,
            'window' => $sla['window'] ?? null,
        ];
    }

    /**
     * Runs the lead automations an entry triggers. After lead_created_api / lead_updated_api, so an
     * automation listening to those sees the same state it did before entries existed.
     */
    private function route(LeadEntry $entry): void
    {
        if (! LeadEntryRouting::enabled()) {
            return;
        }

        $lead = Lead::withoutGlobalScopes()->find($entry->lead_id);
        if (! $lead) {
            return;
        }

        LeadEntryContext::run($entry, function () use ($lead, $entry) {
            app(DealAutomationService::class)->processLead(
                $lead,
                DealAutomation::TRIGGER_LEAD_ENTRY_RECEIVED,
                ['entry' => $entry]
            );
        });
    }
}
