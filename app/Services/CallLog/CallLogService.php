<?php

namespace App\Services\CallLog;

use App\Models\CallRecording;
use App\Models\CrmEvent;
use App\Models\CrmEventType;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use App\Support\CallAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The call log, read from the `call_*` events already written to the CRM
 * timeline (click-to-call, the softphone dock and the bridge poller), so every
 * call made from the CRM appears without a second source of truth.
 *
 * Used by the company-wide Calls page (call managers) and a lead's Calls tab
 * (the lead plus the deals the viewer can see). Recording links are only
 * included for rows the viewer may play (CallAccess::canPlayRecording), so a
 * recording id never reaches someone who could not play it anyway.
 */
class CallLogService
{
    public const OUTCOMES = ['started', 'ended', 'missed', 'declined', 'voicemail', 'busy', 'failed'];

    /**
     * Outcome precedence when one call has several legs (a ring group rings
     * four agents: one answers, the rest miss or pass). The lowest rank wins
     * and becomes the call's outcome: answered beats everything, and a call
     * nobody took reads as missed even when some agents passed it.
     *
     * Only call_ended means answered (the dock's answer event carries status
     * "answered", which the bridge stores as call_ended). call_started is
     * written when a call starts ringing for an agent (`incoming_call`) or is
     * dialled (click-to-call, before anyone picks up), so it ranks last: any
     * real outcome on the same call wins over it.
     */
    private const OUTCOME_RANK = [
        'call_ended' => 1,
        'call_voicemail' => 2,
        'call_missed' => 3,
        'call_busy' => 4,
        'call_declined' => 5,
        'call_failed' => 6,
        'call_started' => 7,
    ];

    /** Ranks counted as "missed" on the summary tiles. */
    private const MISSED_RANKS = [2, 3, 4, 5];

    /** How far back a legacy missed leg looks for its own ringing event. */
    private const RING_LOOKBACK_SECONDS = 300;

    /**
     * One row per call: every agent's leg of the same call is folded into
     * one entry that says who it rang, who answered and how it ended.
     *
     * @param  array{outcome?: string|null, direction?: string|null, user_id?: int|null, search?: string|null, from?: string|null, to?: string|null, has_recording?: bool|null, unlinked?: bool|null}  $filters
     * @param  array{lead_ids?: list<int>, deal_ids?: list<int>}|null  $scope  null = the whole company
     */
    public function paginate(User $viewer, int $companyId, array $filters, ?array $scope, int $perPage, int $page = 1): LengthAwarePaginator
    {
        $types = $this->callTypes($companyId);
        $query = $this->baseQuery($companyId, $types, $scope);
        $this->applyEventFilters($query, $filters);

        $key = $this->callKeyExpression($query, $types);
        $rank = $this->rankExpression($types);

        $calls = (clone $query)->toBase()
            ->selectRaw("{$key} as call_key, MIN(crm_events.occurred_at) as started_at, MAX(crm_events.id) as last_id")
            ->groupBy('call_key');
        $this->applyCallFilters($calls, $rank, $filters);

        $paginator = $calls
            ->orderByDesc('started_at')
            ->orderByDesc('last_id')
            ->paginate($perPage, ['*'], 'page', $page);

        $keys = collect($paginator->items())->pluck('call_key')->map(fn ($k) => (string) $k)->values()->all();

        $events = $keys === []
            ? new \Illuminate\Database\Eloquent\Collection
            : (clone $query)
                ->select(['crm_events.*', DB::raw("{$key} as call_key")])
                ->whereRaw("{$key} in (".implode(',', array_fill(0, count($keys), '?')).')', $keys)
                ->with(['user:id,name', 'eventType:id,slug'])
                ->orderBy('crm_events.occurred_at')
                ->orderBy('crm_events.id')
                ->get();

        $entities = $this->entityNames($events, $companyId);
        $recordings = $this->recordings($events, $companyId);
        $byKey = $events->groupBy(fn (CrmEvent $e) => (string) $e->getAttribute('call_key'));

        $rows = collect($keys)
            ->map(fn (string $k) => isset($byKey[$k]) ? $this->serializeCall($byKey[$k], $viewer, $entities, $recordings) : null)
            ->filter()
            ->values();

        $paginator->setCollection($rows);

        return $paginator;
    }

    /**
     * Counts for the summary tiles, per call (not per leg), over the same
     * scope (no filters).
     *
     * @param  array{lead_ids?: list<int>, deal_ids?: list<int>}|null  $scope
     * @return array{total: int, connected: int, connected_seconds: int, missed: int, with_recording: int, unlinked: int, last_at: string|null}
     */
    public function summary(int $companyId, ?array $scope, ?string $from = null): array
    {
        $types = $this->callTypes($companyId);
        $query = $this->baseQuery($companyId, $types, $scope);

        if ($from !== null) {
            $query->where('crm_events.occurred_at', '>=', $from);
        }

        $key = $this->callKeyExpression($query, $types);
        $rank = $this->rankExpression($types);
        $grammar = $query->getQuery()->getGrammar();
        $duration = $grammar->wrap('crm_events.metadata->duration');
        $recordingId = $grammar->wrap('crm_events.metadata->recording_id');
        $endedId = (int) ($types['call_ended'] ?? 0);
        $int = $query->getQuery()->getConnection()->getDriverName() === 'sqlite' ? 'INTEGER' : 'SIGNED';

        // SQL aggregates over one row per call, so the cost does not grow
        // with the number of legs (no events are hydrated).
        $perCall = (clone $query)->toBase()
            ->selectRaw(
                "{$key} as call_key, MIN({$rank}) as outcome_rank, "
                ."MAX(CASE WHEN crm_events.event_type_id = {$endedId} THEN CAST({$duration} AS {$int}) ELSE 0 END) as duration, "
                ."MAX(CASE WHEN {$recordingId} IS NOT NULL THEN 1 ELSE 0 END) as has_recording, "
                .'MAX(crm_events.model_id) as model_id, MAX(crm_events.occurred_at) as last_at'
            )
            ->groupBy('call_key');

        $missed = implode(',', self::MISSED_RANKS);
        $totals = DB::connection($query->getQuery()->getConnection()->getName())
            ->query()
            ->fromSub($perCall, 'calls')
            ->selectRaw(
                'COUNT(*) as total, '
                .'SUM(CASE WHEN outcome_rank = 1 THEN 1 ELSE 0 END) as connected, '
                .'SUM(CASE WHEN outcome_rank = 1 THEN duration ELSE 0 END) as connected_seconds, '
                ."SUM(CASE WHEN outcome_rank IN ({$missed}) THEN 1 ELSE 0 END) as missed, "
                .'SUM(has_recording) as with_recording, '
                .'SUM(CASE WHEN model_id IS NULL THEN 1 ELSE 0 END) as unlinked, '
                .'MAX(last_at) as last_at'
            )
            ->first();

        $lastAt = $totals->last_at ?? null;

        return [
            'total' => (int) ($totals->total ?? 0),
            'connected' => (int) ($totals->connected ?? 0),
            'connected_seconds' => (int) ($totals->connected_seconds ?? 0),
            'missed' => (int) ($totals->missed ?? 0),
            'with_recording' => (int) ($totals->with_recording ?? 0),
            'unlinked' => (int) ($totals->unlinked ?? 0),
            'last_at' => $lastAt !== null ? \Illuminate\Support\Carbon::parse($lastAt)->toIso8601String() : null,
        ];
    }

    /**
     * SQL for "which call is this event part of".
     *
     * In order:
     *
     * 1. The event's own id: the shared SIP Call-ID (`call_id`), else its
     *    `call_ref`, which the answering browser puts on both the start and
     *    the end of its call. Placeholder ids ("call-179") are reused across
     *    calls and never count.
     * 2. Older missed/declined legs logged under a per-browser id (call_id =
     *    call_ref) take the SIP Call-ID of the ringing event (`incoming_call`,
     *    stored as call_started) for the same caller number just before them,
     *    preferring the same agent's own, within five minutes, so they land in
     *    the same call as the answered and ringing legs. With no ringing event,
     *    caller number within a three-minute window.
     * 3. An outbound "started" with no id of its own (click-to-call logs it as
     *    it dials) takes the id of the next outcome the same agent logged for
     *    the same number, within two hours and before that agent dialled the
     *    number again, so "started" and "completed" are one call while
     *    back-to-back attempts stay apart.
     * 4. The bridge correlation id; else the event stands alone.
     *
     * @param  Collection<string, int>  $types
     */
    private function callKeyExpression(Builder $query, Collection $types): string
    {
        $grammar = $query->getQuery()->getGrammar();
        $callId = $grammar->wrap('crm_events.metadata->call_id');
        $callRef = $grammar->wrap('crm_events.metadata->call_ref');
        $phone = $grammar->wrap('crm_events.metadata->phone_number');
        $sqlite = $query->getQuery()->getConnection()->getDriverName() === 'sqlite';

        // An id that identifies one call, or NULL.
        $usable = fn (string $expr) => "(CASE WHEN {$expr} IS NULL OR {$expr} = '' OR {$expr} LIKE 'call-%' THEN NULL ELSE {$expr} END)";
        $ownId = fn (string $alias) => 'COALESCE('
            .$usable($grammar->wrap("{$alias}.metadata->call_id")).', '
            .$usable($grammar->wrap("{$alias}.metadata->call_ref")).')';

        $bucket = $sqlite
            ? "CAST(CAST(strftime('%s', crm_events.occurred_at) AS INTEGER) / 180 AS TEXT)"
            : 'CAST(FLOOR(UNIX_TIMESTAMP(crm_events.occurred_at) / 180) AS CHAR)';
        $id = $sqlite ? 'CAST(crm_events.id AS TEXT)' : 'CAST(crm_events.id AS CHAR)';
        $concat = fn (string ...$parts) => $sqlite
            ? '('.implode(' || ', $parts).')'
            : 'CONCAT('.implode(', ', $parts).')';

        $legacyKey = $concat("'p:'", $phone, "':'", $bucket);

        $startedId = isset($types['call_started']) ? (int) $types['call_started'] : null;
        if ($startedId !== null) {
            $ringCallId = $grammar->wrap('ring.metadata->call_id');
            $ringCallRef = $grammar->wrap('ring.metadata->call_ref');
            $ringPhone = $grammar->wrap('ring.metadata->phone_number');
            $lookback = (int) self::RING_LOOKBACK_SECONDS;
            $since = $sqlite
                ? "datetime(crm_events.occurred_at, '-{$lookback} seconds')"
                : "crm_events.occurred_at - INTERVAL {$lookback} SECOND";

            // Latest ringing event for this number just before the leg; the
            // outer row is only referenced in WHERE (SQLite rejects it in
            // ORDER BY), so "same agent first" is two lookups, not one sort.
            $ringing = fn (string $extra) => "(SELECT {$ringCallId} FROM crm_events ring"
                .' WHERE ring.company_id = crm_events.company_id'
                ." AND ring.event_type_id = {$startedId}"
                ." AND ring.direction = 'inbound'"
                ." AND {$ringPhone} = {$phone}"
                .' AND '.$usable($ringCallId).' IS NOT NULL'
                ." AND ({$ringCallRef} IS NULL OR {$ringCallId} <> {$ringCallRef})"
                ." AND ring.occurred_at BETWEEN {$since} AND crm_events.occurred_at"
                .$extra
                .' ORDER BY ring.occurred_at DESC, ring.id DESC'
                .' LIMIT 1)';

            $legacyKey = 'COALESCE('
                .$ringing(' AND ring.user_id = crm_events.user_id').', '
                .$ringing('').', '
                ."{$legacyKey})";
        }

        $fallback = 'COALESCE(crm_events.correlation_id, '.$concat("'e:'", $id).')';
        $outboundStart = null;

        if ($startedId !== null) {
            $outcomePhone = $grammar->wrap('outcome.metadata->phone_number');
            $redialPhone = $grammar->wrap('redial.metadata->phone_number');
            $window = 7200;
            $until = $sqlite
                ? "datetime(crm_events.occurred_at, '+{$window} seconds')"
                : "crm_events.occurred_at + INTERVAL {$window} SECOND";

            $nextOutcome = '(SELECT '.$ownId('outcome').' FROM crm_events outcome'
                .' WHERE outcome.company_id = crm_events.company_id'
                ." AND outcome.event_type_id <> {$startedId}"
                .' AND outcome.event_type_id IN ('.implode(',', array_map('intval', $types->values()->all())).')'
                ." AND outcome.direction = 'outbound'"
                .' AND outcome.user_id = crm_events.user_id'
                ." AND {$outcomePhone} = {$phone}"
                ." AND outcome.occurred_at BETWEEN crm_events.occurred_at AND {$until}"
                .' AND '.$ownId('outcome').' IS NOT NULL'
                .' AND NOT EXISTS (SELECT 1 FROM crm_events redial'
                .' WHERE redial.company_id = crm_events.company_id'
                ." AND redial.event_type_id = {$startedId}"
                ." AND redial.direction = 'outbound'"
                .' AND redial.user_id = crm_events.user_id'
                ." AND {$redialPhone} = {$phone}"
                .' AND redial.occurred_at > crm_events.occurred_at'
                .' AND redial.occurred_at < outcome.occurred_at)'
                .' ORDER BY outcome.occurred_at, outcome.id'
                .' LIMIT 1)';

            $outboundStart = "WHEN crm_events.direction = 'outbound' AND crm_events.event_type_id = {$startedId} AND {$phone} IS NOT NULL "
                ."THEN COALESCE({$nextOutcome}, {$fallback}) ";
        }

        return "(CASE WHEN crm_events.direction = 'inbound' AND {$callId} IS NOT NULL AND {$callId} = {$callRef} AND {$phone} IS NOT NULL "
            ."THEN {$legacyKey} "
            .'WHEN '.$ownId('crm_events').' IS NOT NULL THEN '.$ownId('crm_events').' '
            .($outboundStart ?? '')
            ."ELSE {$fallback} END)";
    }

    /** @param  Collection<string, int>  $types */
    private function rankExpression(Collection $types): string
    {
        $cases = [];
        foreach (self::OUTCOME_RANK as $slug => $rank) {
            if (isset($types[$slug])) {
                $cases[] = 'WHEN '.(int) $types[$slug].' THEN '.$rank;
            }
        }

        return $cases === [] ? '99' : '(CASE crm_events.event_type_id '.implode(' ', $cases).' ELSE 99 END)';
    }

    /**
     * The lead plus the deals of it the viewer may see.
     *
     * @return array{lead_ids: list<int>, deal_ids: list<int>, deals: array<int, string|null>}
     */
    public function leadScope(Lead $lead, User $viewer): array
    {
        $deals = Deal::withoutGlobalScopes()
            ->where('company_id', $lead->company_id)
            ->where('lead_id', $lead->id)
            // Whole rows: isVisibleToUser() reads agent_id (assigned agent).
            // leadAgent is eager-loaded so the per-deal check does not lazy-load
            // it; participant/watcher lookups only run when the agent check fails.
            ->with('leadAgent')
            ->get();

        $visible = $deals->filter(function (Deal $deal) use ($viewer) {
            $access = \App\Services\PermissionService::checkAccess($viewer, 'view_deals', $deal, [
                'added' => 'added_by',
                'owned' => fn ($user, $d) => $d->isVisibleToUser($user->id),
            ]);

            return (bool) ($access['canAccess'] ?? false);
        });

        return [
            'lead_ids' => [(int) $lead->id],
            'deal_ids' => $visible->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
            'deals' => $visible->pluck('name', 'id')->all(),
        ];
    }

    /** @return Collection<string, int> slug => id */
    private function callTypes(int $companyId): Collection
    {
        // System types are seeded with company_id NULL and shared by everyone.
        return CrmEventType::withoutGlobalScopes()
            ->where(fn ($q) => $q->whereNull('company_id')->orWhere('company_id', $companyId))
            ->whereIn('slug', array_map(fn ($o) => 'call_'.$o, self::OUTCOMES))
            ->pluck('id', 'slug');
    }

    /**
     * @param  Collection<string, int>  $types
     * @param  array{lead_ids?: list<int>, deal_ids?: list<int>}|null  $scope
     */
    private function baseQuery(int $companyId, Collection $types, ?array $scope): Builder
    {
        $query = CrmEvent::query()
            ->where('crm_events.company_id', $companyId)
            ->whereIn('crm_events.event_type_id', $types->values()->all());

        if ($scope !== null) {
            $leadIds = $scope['lead_ids'] ?? [];
            $dealIds = $scope['deal_ids'] ?? [];

            $query->where(function ($q) use ($leadIds, $dealIds) {
                $q->whereRaw('1 = 0');
                if ($leadIds !== []) {
                    $q->orWhere(fn ($w) => $w->whereIn('crm_events.model_type', $this->modelTypes(Lead::class))->whereIn('crm_events.model_id', $leadIds));
                }
                if ($dealIds !== []) {
                    $q->orWhere(fn ($w) => $w->whereIn('crm_events.model_type', $this->modelTypes(Deal::class))->whereIn('crm_events.model_id', $dealIds));
                }
            });
        }

        // Legs of one call are folded into one row by paginate() and
        // summary() (see callKeyExpression), so nothing is de-duplicated here.

        return $query;
    }

    /**
     * Model types as stored: the canonical class name and any legacy alias.
     *
     * @return list<string>
     */
    private function modelTypes(string $class): array
    {
        $short = strtolower(class_basename($class));

        return array_values(array_unique([$class, $short]));
    }

    /**
     * Filters that hold for every leg of a call (direction, dates).
     *
     * @param  array<string, mixed>  $filters
     */
    private function applyEventFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['direction'])) {
            $query->where('crm_events.direction', $filters['direction']);
        }
        if (! empty($filters['from'])) {
            $query->where('crm_events.occurred_at', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->where('crm_events.occurred_at', '<=', $filters['to'].' 23:59:59');
        }
    }

    /**
     * Filters on the call as a whole: its outcome is the best leg's, and it
     * matches an agent, number or recording when any leg does.
     *
     * @param  array<string, mixed>  $filters
     */
    private function applyCallFilters(\Illuminate\Database\Query\Builder $calls, string $rank, array $filters): void
    {
        if (! empty($filters['outcome'])) {
            $calls->havingRaw("MIN({$rank}) = ?", [self::OUTCOME_RANK['call_'.$filters['outcome']] ?? 0]);
        }
        if (! empty($filters['user_id'])) {
            $calls->havingRaw('SUM(CASE WHEN crm_events.user_id = ? THEN 1 ELSE 0 END) > 0', [(int) $filters['user_id']]);
        }
        if (! empty($filters['has_recording'])) {
            $calls->havingRaw('SUM(CASE WHEN crm_events.metadata LIKE ? THEN 1 ELSE 0 END) > 0', ['%"recording_id"%']);
        }
        if (! empty($filters['unlinked'])) {
            $calls->havingRaw('MAX(crm_events.model_id) IS NULL');
        }
        if (! empty($filters['search'])) {
            // Numbers are stored as typed ("+49 170 1234567"), so match the
            // raw term; escape LIKE wildcards so "%" / "_" are literal.
            $term = addcslashes(trim((string) $filters['search']), '%_\\');
            $calls->havingRaw('SUM(CASE WHEN crm_events.metadata LIKE ? THEN 1 ELSE 0 END) > 0', ['%'.$term.'%']);
        }
    }

    /**
     * One call from all of its legs: the best leg gives the outcome, the
     * answering agent and the duration; every agent it reached is listed in
     * `legs` with how their leg ended; the recording comes from whichever leg
     * has one.
     *
     * @param  Collection<int, CrmEvent>  $events  oldest first
     * @param  array<string, array{name: string|null, url: string}>  $entities
     * @param  array<string, mixed>  $recordings
     * @return array<string, mixed>
     */
    private function serializeCall(Collection $events, User $viewer, array $entities, array $recordings): array
    {
        $rankOf = fn (CrmEvent $e) => self::OUTCOME_RANK[(string) $e->eventType?->slug] ?? 99;

        // Best outcome wins; between equals, the latest leg.
        $primary = $events->reduce(function (?CrmEvent $best, CrmEvent $e) use ($rankOf) {
            return $best === null || $rankOf($e) <= $rankOf($best) ? $e : $best;
        });

        $rows = $events->mapWithKeys(fn (CrmEvent $e) => [$e->id => $this->serialize($e, $viewer, $entities, $recordings)]);
        $row = $rows[$primary->id];

        // Entity and number may only be on some legs.
        foreach (['entity_type', 'entity_id', 'entity_name', 'entity_url', 'phone_number'] as $field) {
            if ($row[$field] === null) {
                $row[$field] = $rows->pluck($field)->filter()->first();
            }
        }

        // The recording comes from whichever leg captured one.
        $statePriority = ['playable' => 0, 'restricted' => 1, 'expired' => 2, 'processing' => 3, 'failed' => 4];
        $withRecording = $rows
            ->filter(fn ($r) => $r['recording'] !== null)
            ->sortBy(fn ($r) => $statePriority[$r['recording']['state']] ?? 5)
            ->first();
        if ($withRecording !== null) {
            $row['recording'] = $withRecording['recording'];
            $row['has_recording'] = $withRecording['has_recording'];
        }

        $row['duration'] = $rows->pluck('duration')->filter()->max() ?? $row['duration'];

        $forwarded = $rows->first(fn ($r) => $r['is_forwarded']);
        if ($forwarded !== null && ! $row['is_forwarded']) {
            foreach (['is_forwarded', 'forwarded_from_user_id', 'forwarded_from_user_name'] as $field) {
                $row[$field] = $forwarded[$field];
            }
        }

        // Each agent the call reached, once, in the order it reached them,
        // with how their leg ended.
        $legs = [];
        foreach ($events as $event) {
            if ($event->user_id === null) {
                continue;
            }
            $uid = (int) $event->user_id;
            $rank = $rankOf($event);
            if (! isset($legs[$uid]) || $rank < $legs[$uid]['rank']) {
                $legs[$uid] = [
                    'rank' => $rank,
                    'user_id' => $uid,
                    'user_name' => $event->user?->name,
                    'outcome' => str_replace('call_', '', (string) $event->eventType?->slug),
                    'at' => $legs[$uid]['at'] ?? $event->occurred_at?->toIso8601String(),
                ];
            }
        }
        $legs = array_values(array_map(function (array $leg) {
            unset($leg['rank']);

            return $leg;
        }, $legs));

        // call_started only means it rang or was dialled; a call is answered
        // when one of its legs ended as connected (see OUTCOME_RANK).
        $answered = $row['outcome'] === 'ended';
        if ($answered) {
            // A leg that failed before someone else picked up is not the
            // call's failure.
            $row['failure_reason'] = null;
            $row['failure_message'] = null;
        } else {
            // Nobody took it: no single agent owns the call unless only one
            // agent was rung.
            $row['user_id'] = count($legs) === 1 ? $legs[0]['user_id'] : null;
            $row['user_name'] = count($legs) === 1 ? $legs[0]['user_name'] : null;
        }

        $first = $events->first();
        $last = $events->last();
        $row['occurred_at'] = $first->occurred_at?->toIso8601String();

        return $row + [
            'started_at' => $first->occurred_at?->toIso8601String(),
            'ended_at' => $last->occurred_at?->toIso8601String(),
            'answered' => $answered,
            'answered_by_user_id' => $answered ? $row['user_id'] : null,
            'answered_by_user_name' => $answered ? $row['user_name'] : null,
            'legs' => $legs,
            'rang_count' => count($legs),
            'event_ids' => $events->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
        ];
    }

    /**
     * @param  array<string, array{name: string|null, url: string}>  $entities
     * @param  array<int, CallRecording>  $recordings
     * @return array<string, mixed>
     */
    private function serialize(CrmEvent $event, User $viewer, array $entities, array $recordings): array
    {
        $meta = (array) ($event->metadata ?? []);
        $type = $this->modelKey($event) ?: (string) ($meta['entity_type'] ?? '');
        $entityId = (int) ($event->model_id ?? $meta['entity_id'] ?? 0);
        $entity = $entities[$type.':'.$entityId] ?? null;

        $recordingId = isset($meta['recording_id']) ? (int) $meta['recording_id'] : null;
        $callRef = isset($meta['call_ref']) && is_string($meta['call_ref']) ? $meta['call_ref'] : null;
        $recording = $recordingId !== null ? ($recordings['id:'.$recordingId] ?? null) : null;
        if ($recording === null && $callRef !== null) {
            $candidates = $recordings['refs:'.$callRef] ?? [];
            foreach ($candidates as $candidate) {
                // Apply linker owner-eligibility: exclude recordings belonging to another agent, while allowing system events.
                if ($event->user_id === null || (int) $candidate->user_id === (int) $event->user_id) {
                    $recording = $candidate;
                    break;
                }
            }
        }
        $ownerId = $recording?->user_id !== null ? (int) $recording->user_id : ($event->user_id !== null ? (int) $event->user_id : null);
        $expired = $recording?->expires_at?->isPast() ?? false;
        $canPlay = $recording !== null && ! $expired && CallAccess::canPlayRecording($viewer, $ownerId);

        $recordingFailure = ($meta['recording_status'] ?? null) === 'failed' || ! empty($meta['recording_error']);
        $hasRecording = $recording !== null || ($meta['has_recording'] ?? false) === true;
        $recordingState = match (true) {
            $recording !== null && $expired => 'expired',
            $recording !== null && ! $canPlay => 'restricted',
            $recording !== null && $canPlay => 'playable',
            $recordingFailure => 'failed',
            $hasRecording => 'processing',
            default => 'none',
        };

        return [
            'id' => $event->id,
            'occurred_at' => $event->occurred_at?->toIso8601String(),
            'outcome' => str_replace('call_', '', (string) $event->eventType?->slug),
            'direction' => $event->direction?->value,
            'phone_number' => $meta['phone_number'] ?? null,
            'duration' => isset($meta['duration']) ? (int) $meta['duration'] : null,
            'user_id' => $event->user_id,
            'user_name' => $event->user?->name,
            'entity_type' => $entity ? $type : null,
            'entity_id' => $entity ? $entityId : null,
            'entity_name' => $entity['name'] ?? null,
            'entity_url' => $entity['url'] ?? null,
            'failure_reason' => $meta['failure_reason'] ?? null,
            'failure_message' => $meta['failure_message'] ?? null,
            'routing_reason' => $meta['routing_reason'] ?? null,
            'is_forwarded' => ($meta['is_forwarded'] ?? false) === true,
            'forwarded_from_user_id' => isset($meta['forwarded_from_user_id']) ? (int) $meta['forwarded_from_user_id'] : null,
            'forwarded_from_user_name' => $meta['forwarded_from_user_name'] ?? null,
            'has_recording' => $hasRecording,
            'recording' => $recording === null && ! $hasRecording && ! $recordingFailure ? null : [
                'state' => $recordingState,
                'error' => $meta['recording_error'] ?? ($recordingFailure ? 'Recording failed' : null),
                'expired' => $expired,
                'expires_at' => $recording?->expires_at?->toIso8601String(),
                'duration_seconds' => $recording?->duration_seconds !== null ? (int) $recording->duration_seconds : null,
                'can_play' => $canPlay,
                // Links only for viewers who may play it.
                'id' => $canPlay ? $recording?->id : null,
                'filename' => $canPlay ? $recording?->filename : null,
                'play_url' => $canPlay && $recording ? route('call-recordings.play', $recording->id, false) : null,
                'download_url' => $canPlay && $recording ? route('call-recordings.download', $recording->id, false) : null,
                'open_url' => $canPlay && $recording?->opensInNewTab() ? route('call-recordings.open', $recording->id, false) : null,
            ],
        ];
    }

    private function modelKey(CrmEvent $event): string
    {
        $type = (string) $event->model_type;

        return match (true) {
            $type === Lead::class || $type === 'lead' => 'lead',
            $type === Deal::class || $type === 'deal' => 'deal',
            default => '',
        };
    }

    /**
     * @param  Collection<int, CrmEvent>  $events
     * @return array<string, CallRecording>
     */
    private function recordings(Collection $events, int $companyId): array
    {
        $ids = $events
            ->map(fn (CrmEvent $e) => ((array) ($e->metadata ?? []))['recording_id'] ?? null)
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $callRefs = $events
            ->map(fn (CrmEvent $e) => ((array) ($e->metadata ?? []))['call_ref'] ?? null)
            ->filter(fn ($ref) => ! empty($ref) && is_string($ref))
            ->unique()
            ->values()
            ->all();

        if ($ids === [] && $callRefs === []) {
            return [];
        }

        $hasSystemEvent = $events->contains(fn ($e) => empty($e->user_id));
        $eventUserIds = $events->pluck('user_id')->filter()->unique()->values()->all();

        $query = CallRecording::query()->where('company_id', $companyId);
        $query->where(function ($q) use ($ids, $callRefs, $hasSystemEvent, $eventUserIds) {
            if ($ids !== []) {
                $q->whereIn('id', $ids);
            }
            if ($callRefs !== []) {
                $q->orWhere(function ($refQ) use ($callRefs, $hasSystemEvent, $eventUserIds) {
                    $refQ->whereIn('call_ref', $callRefs);
                    if (! $hasSystemEvent) {
                        $refQ->whereIn('user_id', $eventUserIds);
                    }
                });
            }
        });

        $recordings = $query->get(['id', 'call_ref', 'user_id', 'filename', 'mime_type', 'external_url', 'duration_seconds', 'expires_at', 'company_id']);

        $byKey = [];
        foreach ($recordings as $rec) {
            $byKey['id:'.$rec->id] = $rec;
            if (! empty($rec->call_ref)) {
                $byKey['refs:'.$rec->call_ref][] = $rec;
            }
        }

        return $byKey;
    }

    /**
     * Name + link for every lead/deal on the page, in two queries.
     *
     * @param  Collection<int, CrmEvent>  $events
     * @return array<string, array{name: string|null, url: string}>
     */
    private function entityNames(Collection $events, int $companyId): array
    {
        $ids = ['lead' => [], 'deal' => []];

        foreach ($events as $event) {
            $meta = (array) ($event->metadata ?? []);
            $type = $this->modelKey($event) ?: (string) ($meta['entity_type'] ?? '');
            $id = (int) ($event->model_id ?? $meta['entity_id'] ?? 0);
            if (isset($ids[$type]) && $id > 0) {
                $ids[$type][$id] = $id;
            }
        }

        $out = [];

        if ($ids['lead'] !== []) {
            Lead::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereIn('id', array_values($ids['lead']))
                ->get(['id', 'client_name'])
                ->each(function (Lead $lead) use (&$out) {
                    $out['lead:'.$lead->id] = [
                        'name' => $lead->client_name,
                        'url' => route('lead-contact.show', $lead->id),
                    ];
                });
        }

        if ($ids['deal'] !== []) {
            Deal::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereIn('id', array_values($ids['deal']))
                ->get(['id', 'name'])
                ->each(function (Deal $deal) use (&$out) {
                    $out['deal:'.$deal->id] = [
                        'name' => $deal->name,
                        'url' => route('deals.show', $deal->id),
                    ];
                });
        }

        return $out;
    }
}
