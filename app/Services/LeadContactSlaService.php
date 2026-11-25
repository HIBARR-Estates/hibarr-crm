<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\LeadContactSla;
use App\Models\LeadEntry;
use App\Models\User;
use App\Support\BusinessHours;
use App\Support\FeatureFlags;
use App\Traits\RecordsCrmEvents;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;

/**
 * The first-contact clock of a lead entry.
 *
 * A channel can carry an SLA: a time the assigned agent has to reach a new lead, counted in the
 * channel's working hours only. OL sends it with the entry. Here it:
 *  - opens when the entry arrives, and *starts* once the lead has an owner (until then it waits);
 *  - follows the lead if it is reassigned while running;
 *  - ends at the first outbound call, email or WhatsApp message after it opened, whoever sends it,
 *    recording who, how, how long it took, and whether that was in time;
 *  - is flagged as breached at the moment its deadline passes without contact.
 * Everything is also written to the lead's timeline.
 */
class LeadContactSlaService
{
    use RecordsCrmEvents;

    public const FLAG = 'crm.lead-contact-sla';

    /** Event slug => the contact method it counts as. Only agent-originated, outbound events. */
    public const CONTACT_EVENT_METHODS = [
        'email_sent' => 'email',
        'whatsapp_message_sent' => 'whatsapp',
        'call_started' => 'call',
        'phone_call' => 'call',
    ];

    public static function enabled(): bool
    {
        return FeatureFlags::enabled(self::FLAG);
    }

    /**
     * Opens the clock for an entry that carries an SLA. Idempotent: an entry has at most one clock.
     * Starts it right away when the lead already has an owner (routing has just run, so that is the
     * usual case), else it waits for one.
     */
    public function openForEntry(LeadEntry $entry): ?LeadContactSla
    {
        $sla = $entry->sla;
        if (! self::enabled() || ! is_array($sla) || empty($sla['first_contact_seconds'])) {
            return null;
        }

        $existing = LeadContactSla::withoutGlobalScopes()->where('lead_entry_id', $entry->id)->first();
        if ($existing) {
            return $existing;
        }

        $row = LeadContactSla::withoutGlobalScopes()->create([
            'company_id' => $entry->company_id,
            'lead_id' => $entry->lead_id,
            'lead_entry_id' => $entry->id,
            'status' => LeadContactSla::STATUS_AWAITING_OWNER,
            'first_contact_seconds' => (int) $sla['first_contact_seconds'],
            'recommended_method' => $sla['recommended_method'] ?? null,
            'window' => $sla['window'] ?? null,
        ]);

        $lead = Lead::withoutGlobalScopes()->find($entry->lead_id);
        if ($lead && $lead->lead_owner) {
            $this->start($row, (int) $lead->lead_owner, $lead);
        }

        return $row->fresh();
    }

    /**
     * The lead has (a new) owner. Clocks that were waiting for one start now; clocks already running
     * move to the new owner and keep their deadline.
     */
    public function ownerAssigned(Lead $lead): void
    {
        if (! $lead->lead_owner) {
            return;
        }

        $open = LeadContactSla::withoutGlobalScopes()
            ->where('lead_id', $lead->id)
            ->whereIn('status', [LeadContactSla::STATUS_AWAITING_OWNER, LeadContactSla::STATUS_RUNNING])
            ->get();

        foreach ($open as $row) {
            if ($row->status === LeadContactSla::STATUS_AWAITING_OWNER) {
                $this->start($row, (int) $lead->lead_owner, $lead);
            } elseif ((int) $row->owner_user_id !== (int) $lead->lead_owner) {
                $row->update(['owner_user_id' => $lead->lead_owner]);
            }
        }
    }

    public function start(LeadContactSla $row, int $ownerId, ?Lead $lead = null, ?CarbonImmutable $at = null): void
    {
        $at ??= CarbonImmutable::now();
        $due = BusinessHours::addWorkingSeconds($at, (int) $row->first_contact_seconds, $row->window);

        $row->update([
            'status' => LeadContactSla::STATUS_RUNNING,
            'owner_user_id' => $ownerId,
            'started_at' => $at,
            'due_at' => CarbonImmutable::instance($due),
        ]);

        $lead ??= Lead::withoutGlobalScopes()->find($row->lead_id);
        if ($lead) {
            $this->recordCrmEvent('lead_contact_sla_started', $lead, [
                'generation_type' => 'system_generated',
                'occurred_at' => $at,
                'metadata' => [
                    'comment' => 'Contact clock started',
                    'owner_id' => $ownerId,
                    'due_at' => $row->due_at?->toIso8601String(),
                    'limit_seconds' => (int) $row->first_contact_seconds,
                    'recommended_method' => $row->recommended_method,
                ],
            ]);
        }
    }

    /**
     * A contact was made. Ends every clock still open on the lead (one contact answers them all),
     * recording who, how, how long it took in working time, and whether it was inside the limit.
     * Contact from before the entry arrived does not count.
     */
    public function registerContact(int $leadId, string $method, ?int $userId, CarbonImmutable $at): int
    {
        $open = LeadContactSla::withoutGlobalScopes()
            ->where('lead_id', $leadId)
            ->whereIn('status', [LeadContactSla::STATUS_AWAITING_OWNER, LeadContactSla::STATUS_RUNNING])
            ->get();

        $ended = 0;
        foreach ($open as $row) {
            if ($row->created_at && $at->lt(CarbonImmutable::instance($row->created_at)->subSeconds(5))) {
                continue;
            }

            $started = $row->started_at ? CarbonImmutable::instance($row->started_at) : null;
            $due = $row->due_at ? CarbonImmutable::instance($row->due_at) : null;
            // A clock that never started (nobody owned the lead) cannot have been missed.
            $inTime = $due === null || $at->lte($due);
            $elapsed = $started
                ? BusinessHours::workingSecondsBetween($started, $at->lt($started) ? $started : $at, $row->window)
                : 0;

            $row->update([
                'status' => LeadContactSla::STATUS_MET,
                'contacted_at' => $at,
                'contact_method' => $method,
                'contacted_by_user_id' => $userId,
                'used_recommended_method' => $row->recommended_method ? $row->recommended_method === $method : null,
                'elapsed_working_seconds' => $elapsed,
                'met_in_time' => $inTime,
                // A late contact is also a breach, even if the scan had not flagged it yet.
                'breached_at' => $row->breached_at ?? ($inTime ? null : $due),
            ]);

            $lead = Lead::withoutGlobalScopes()->find($leadId);
            if ($lead) {
                $this->recordCrmEvent($inTime ? 'lead_contact_sla_met' : 'lead_contact_sla_missed', $lead, [
                    'generation_type' => 'system_generated',
                    'user_id' => $userId,
                    'occurred_at' => $at,
                    'metadata' => [
                        'comment' => $inTime ? 'Contacted within the time limit' : 'Contacted after the time limit',
                        'method' => $method,
                        'recommended_method' => $row->recommended_method,
                        'limit_seconds' => (int) $row->first_contact_seconds,
                        'elapsed_working_seconds' => $elapsed,
                        'contacted_by_owner' => $userId !== null && (int) $row->owner_user_id === $userId,
                    ],
                ]);
            }
            $ended++;
        }

        return $ended;
    }

    /**
     * Flags every running clock whose deadline has passed, once. Meant for a scheduler run every
     * minute. Returns how many were flagged.
     */
    public function flagBreaches(?CarbonImmutable $now = null): int
    {
        $now ??= CarbonImmutable::now();

        $late = LeadContactSla::withoutGlobalScopes()
            ->where('status', LeadContactSla::STATUS_RUNNING)
            ->whereNull('breached_at')
            ->where('due_at', '<=', $now)
            ->get();

        foreach ($late as $row) {
            $row->update(['breached_at' => $row->due_at]);

            $lead = Lead::withoutGlobalScopes()->find($row->lead_id);
            if (! $lead) {
                continue;
            }
            $this->recordCrmEvent('lead_contact_sla_breached', $lead, [
                'generation_type' => 'system_generated',
                'occurred_at' => $row->due_at,
                'metadata' => [
                    'comment' => 'Time limit to contact the lead passed',
                    'owner_id' => $row->owner_user_id,
                    'limit_seconds' => (int) $row->first_contact_seconds,
                    'recommended_method' => $row->recommended_method,
                ],
            ]);
        }

        return $late->count();
    }

    /**
     * Maps an outbound-contact event to the method it counts as, or null when it is not one (an
     * inbound call, a note, anything else).
     *
     * @param  array<string, mixed>  $eventData
     */
    public function contactMethodOf(string $slug, array $eventData): ?string
    {
        $method = self::CONTACT_EVENT_METHODS[$slug] ?? null;
        if ($method === null) {
            return null;
        }

        $direction = strtolower((string) ($eventData['direction'] ?? ($eventData['metadata']['direction'] ?? '')));

        return $direction === 'inbound' ? null : $method;
    }

    /**
     * The clock to show on a lead: the running (or waiting) one due first, else the latest ended one.
     *
     * @return array<string, mixed>|null
     */
    public function currentFor(int $leadId): ?array
    {
        $open = LeadContactSla::withoutGlobalScopes()
            ->where('lead_id', $leadId)
            ->whereIn('status', [LeadContactSla::STATUS_AWAITING_OWNER, LeadContactSla::STATUS_RUNNING])
            ->orderByRaw('due_at IS NULL')
            ->orderBy('due_at')
            ->first();

        $row = $open ?? LeadContactSla::withoutGlobalScopes()
            ->where('lead_id', $leadId)
            ->orderByDesc('id')
            ->first();

        return $row ? $this->present($row) : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function present(LeadContactSla $row, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $running = $row->status === LeadContactSla::STATUS_RUNNING;
        $window = $row->window;
        $open = $window === null || BusinessHours::isOpen($now, $window);

        $names = User::withoutGlobalScopes()
            ->whereIn('id', array_filter([$row->owner_user_id, $row->contacted_by_user_id]))
            ->pluck('name', 'id');

        return [
            'id' => $row->id,
            'lead_entry_id' => $row->lead_entry_id,
            'status' => $row->status,
            'first_contact_seconds' => (int) $row->first_contact_seconds,
            'recommended_method' => $row->recommended_method,
            'window' => $window,
            'owner' => $row->owner_user_id ? ['id' => $row->owner_user_id, 'name' => $names[$row->owner_user_id] ?? null] : null,
            'started_at' => $row->started_at?->toIso8601String(),
            'due_at' => $row->due_at?->toIso8601String(),
            // Running outside the channel's hours: the deadline is waiting for the window to reopen.
            'paused' => $running && ! $open,
            'resumes_at' => $running && ! $open
                ? CarbonImmutable::instance(BusinessHours::nextOpening($now, $window))->toIso8601String()
                : null,
            'breached' => $row->breached_at !== null || ($running && $row->due_at !== null && $row->due_at->lte($now)),
            'breached_at' => $row->breached_at?->toIso8601String(),
            'contacted_at' => $row->contacted_at?->toIso8601String(),
            'contact_method' => $row->contact_method,
            'contacted_by' => $row->contacted_by_user_id
                ? ['id' => $row->contacted_by_user_id, 'name' => $names[$row->contacted_by_user_id] ?? null]
                : null,
            'used_recommended_method' => $row->used_recommended_method,
            'elapsed_working_seconds' => $row->elapsed_working_seconds,
            'met_in_time' => $row->met_in_time,
            // Lets the browser tick against the server's clock rather than its own.
            'server_now' => $now->toIso8601String(),
        ];
    }

    /** Logs a failure without letting a broken clock break the work it is attached to. */
    public function safely(callable $callback): mixed
    {
        try {
            return $callback();
        } catch (\Throwable $e) {
            Log::error('LeadContactSlaService: '.$e->getMessage(), ['trace' => $e->getTraceAsString()]);

            return null;
        }
    }
}
