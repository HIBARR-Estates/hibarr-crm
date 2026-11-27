<?php

namespace App\Services;

use App\Models\DealAutomation;
use App\Models\Lead;
use App\Models\LeadEntry;
use App\Support\BusinessHours;
use App\Support\LeadEntryRouting;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Takes the `entry` block the backend (OL) sends with a contact or deal request: stores it as a
 * LeadEntry and, once, fires the `lead_entry_received` trigger.
 *
 * Never throws. A malformed or failing entry must not fail the contact/deal request it rides on,
 * which has already done its real work by the time this runs.
 */
class LeadEntryIntakeService
{
    /** How long a routing run may hold its entry: well past the 300s request limit. */
    private const ROUTING_LOCK_SECONDS = 900;

    /**
     * Stores the entry (idempotent on its uuid), runs the lead automations it triggers, and opens its
     * contact clock. A redelivery of an entry already stored never runs routing twice, but it does
     * finish what an earlier delivery could not: routing that failed (the entry is not marked routed
     * until it succeeds) and a clock that never opened.
     *
     * @param  array<string, mixed>|null  $payload  The request's `entry` block.
     * @param  bool  $route  False when the request the entry rides on did not finish its work (the deal job
     *                       failed): the entry and its clock are still recorded, but routing stays pending
     *                       and runs when the entry is delivered again.
     */
    public function receive(int $leadId, int $companyId, ?array $payload, bool $route = true): ?LeadEntry
    {
        if (! $payload) {
            return null;
        }

        try {
            $entry = $this->store($leadId, $companyId, $payload);
        } catch (\Throwable $e) {
            Log::error('LeadEntryIntakeService: failed to store entry', [
                'lead_id' => $leadId,
                'entry_uuid' => $payload['uuid'] ?? null,
                'message' => $e->getMessage(),
            ]);

            return null;
        }
        if (! $entry) {
            return null;
        }

        if ($route) {
            $this->routeOnce($entry, $leadId);
        }

        // Independent of routing: a failing automation must not cost the lead its clock. After routing,
        // so an owner assigned by an automation starts the clock straight away. Idempotent.
        $slaService = app(LeadContactSlaService::class);
        $slaService->safely(fn () => $slaService->openForEntry($entry));

        return $entry;
    }

    /**
     * Routes the entry unless it already was, one run per entry at a time: a second delivery arriving while
     * the first is still running skips it (and, if the first fails, a later delivery retries). The lock
     * expires on its own should the process die mid-run; it lasts three times the request limit (PHP
     * max_execution_time and the nginx FastCGI timeout are both 300s in docker/), so a run cannot outlive it.
     *
     * Never throws: a broken cache must not fail the request the entry rides on, or cost the lead its clock.
     */
    private function routeOnce(LeadEntry $entry, int $leadId): void
    {
        try {
            $lock = Cache::lock('lead_entry_routing:'.$entry->id, self::ROUTING_LOCK_SECONDS);
            if (! $lock->get()) {
                return;
            }
        } catch (\Throwable $e) {
            Log::warning('LeadEntryIntakeService: could not take the routing lock; routing is left for a later delivery', [
                'lead_id' => $leadId,
                'entry_uuid' => $entry->ol_entry_uuid,
                'message' => $e->getMessage(),
            ]);

            return;
        }

        try {
            // A delivery that held the lock before us may have finished the run.
            $entry->refresh();
            if ($entry->routed_at === null && $this->route($entry)) {
                $entry->forceFill(['routed_at' => now()])->saveQuietly();
            }
        } catch (\Throwable $e) {
            Log::error('LeadEntryIntakeService: routing failed; it is retried if the entry is delivered again', [
                'lead_id' => $leadId,
                'entry_uuid' => $entry->ol_entry_uuid,
                'message' => $e->getMessage(),
            ]);
        } finally {
            try {
                $lock->release();
            } catch (\Throwable $e) {
                Log::warning('LeadEntryIntakeService: could not release the routing lock; it expires on its own', [
                    'message' => $e->getMessage(),
                ]);
            }
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

        // An entry can only be filed against a lead of the company the request came in for.
        $leadInCompany = Lead::withoutGlobalScopes()->where('company_id', $companyId)->whereKey($leadId)->exists();
        if (! $leadInCompany) {
            Log::warning('LeadEntryIntakeService: ignoring an entry for a lead outside the company', [
                'lead_id' => $leadId,
                'company_id' => $companyId,
            ]);

            return null;
        }

        // UUIDs are case-insensitive; one spelling is stored so scope checks and dedupe agree.
        $payload['uuid'] = strtolower($payload['uuid']);
        $payload['channel']['uuid'] = strtolower($payload['channel']['uuid']);
        $payload['channel']['ancestor_uuids'] = array_map('strtolower', array_values($payload['channel']['ancestor_uuids'] ?? []));

        $existing = LeadEntry::withoutGlobalScopes()->where('ol_entry_uuid', $payload['uuid'])->first();
        if ($existing) {
            return (int) $existing->company_id === $companyId ? $existing : null;
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
                'channel_ancestor_uuids' => $channel['ancestor_uuids'],
                'channel_tags' => array_values($channel['tags'] ?? []),
                'sla' => $this->validSla($payload['sla'] ?? null, $leadId),
                'source_entity_type' => $this->clip($source['entity_type'] ?? null, 32),
                'source_entity_id' => $this->unsignedInt($source['entity_id'] ?? null),
                'source_entity_key' => $this->clip($source['entity_key'] ?? null, 191),
                'source_label' => $this->clip($source['label'] ?? null, 255),
                'is_new_lead' => (bool) ($payload['is_new_lead'] ?? false),
                'resolved_by' => $this->clip($payload['resolved_by'] ?? 'type_default', 16),
                'occurred_at' => $payload['occurred_at'],
                'referral_ol_agent_id' => $this->unsignedInt($context['referral_agent']['ol_agent_id'] ?? null),
                'referral_user_id' => $this->unsignedInt($context['referral_agent']['crm_user_id'] ?? null),
                'partner_ol_agent_id' => $this->unsignedInt($context['partner']['ol_agent_id'] ?? null),
                'partner_user_id' => $this->unsignedInt($context['partner']['crm_user_id'] ?? null),
                'campaign_key' => $this->clip($campaign['key'] ?? null, 255),
                'campaign_matched_by' => $this->clip($campaign['matched_by'] ?? null, 24),
                'campaign_value' => $this->clip($campaign['value'] ?? null, 255),
                'campaign_label' => $this->clip($campaign['label'] ?? null, 255),
                'attribution_link_uuid' => $this->uuidOrNull($campaign['attribution_link_uuid'] ?? null),
                'utm_source' => $this->clip($utm['source'] ?? $utm['utmSource'] ?? null, 191),
                'utm_medium' => $this->clip($utm['medium'] ?? $utm['utmMedium'] ?? null, 191),
                'utm_campaign' => $this->clip($utm['campaign'] ?? $utm['utmCampaign'] ?? null, 191),
                'form_key' => $this->clip($payload['form_key'] ?? null, 100),
                'language' => $this->clip($payload['language'] ?? null, 8),
                'payload' => $payload,
            ]);
        } catch (QueryException $e) {
            // Two deliveries of one entry racing: the other request's row wins.
            $winner = LeadEntry::withoutGlobalScopes()->where('ol_entry_uuid', $payload['uuid'])->first();
            if ($winner) {
                // Another company's entry that won the race for a reused uuid is not ours to route.
                return (int) $winner->company_id === $companyId ? $winner : null;
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

        // A working window is one day's hours: it has to start before it ends (no overnight, no empty).
        if (is_array($sla['window'] ?? null) && ($sla['window']['start'] ?? '') >= ($sla['window']['end'] ?? '')) {
            Log::warning('LeadEntryIntakeService: ignoring an SLA whose window does not end after it starts', [
                'lead_id' => $leadId,
                'window' => $sla['window'],
            ]);

            return null;
        }

        // The deadline has to be reachable and storable: a window of a few minutes a week would put it
        // decades out, past what a timestamp column holds.
        if (is_array($sla['window'] ?? null)) {
            $reach = BusinessHours::addWorkingSeconds(new \DateTimeImmutable('now'), (int) $sla['first_contact_seconds'], $sla['window']);
            if ($reach > new \DateTimeImmutable('+1 year')) {
                Log::warning('LeadEntryIntakeService: ignoring an SLA whose working hours put its deadline over a year away', [
                    'lead_id' => $leadId,
                    'window' => $sla['window'],
                ]);

                return null;
            }
        }

        return [
            'first_contact_seconds' => (int) $sla['first_contact_seconds'],
            'recommended_method' => $sla['recommended_method'] ?? null,
            'window' => $sla['window'] ?? null,
        ];
    }

    /** A whole number that fits an unsigned INT column, else null: a bad id costs the field, not the entry. */
    private function unsignedInt(mixed $value): ?int
    {
        if (is_int($value) || (is_string($value) && ctype_digit($value))) {
            $int = (int) $value;

            return $int >= 0 && $int <= 4294967295 ? $int : null;
        }

        return null;
    }

    private function uuidOrNull(mixed $value): ?string
    {
        return is_string($value) && Str::isUuid($value) ? strtolower($value) : null;
    }

    /** Free text from OL is trimmed to its column rather than costing the whole entry. */
    private function clip(mixed $value, int $max): ?string
    {
        if ($value === null || (! is_scalar($value))) {
            return null;
        }

        return mb_substr((string) $value, 0, $max);
    }

    /**
     * Runs the lead automations an entry triggers. After lead_created_api / lead_updated_api, so an
     * automation listening to those sees the same state it did before entries existed.
     *
     * @return bool Whether routing is done with this entry: it ran, or there is nothing to run (the
     *              feature is off, or the lead is gone). Throws if an automation failed.
     */
    private function route(LeadEntry $entry): bool
    {
        if (! LeadEntryRouting::enabled()) {
            return false;
        }

        $lead = Lead::withoutGlobalScopes()->find($entry->lead_id);
        if (! $lead) {
            return false;
        }

        LeadEntryContext::run($entry, function () use ($lead, $entry) {
            app(DealAutomationService::class)->processLead(
                $lead,
                DealAutomation::TRIGGER_LEAD_ENTRY_RECEIVED,
                ['entry' => $entry]
            );
        });

        return true;
    }
}
