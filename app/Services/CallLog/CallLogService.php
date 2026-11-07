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
     * @param  array{outcome?: string|null, direction?: string|null, user_id?: int|null, search?: string|null, from?: string|null, to?: string|null, has_recording?: bool|null, unlinked?: bool|null}  $filters
     * @param  array{lead_ids?: list<int>, deal_ids?: list<int>}|null  $scope  null = the whole company
     */
    public function paginate(User $viewer, int $companyId, array $filters, ?array $scope, int $perPage, int $page = 1): LengthAwarePaginator
    {
        $types = $this->callTypes($companyId);
        $query = $this->baseQuery($companyId, $types, $scope);
        $this->applyFilters($query, $types, $filters);

        $paginator = $query
            ->with(['user:id,name', 'eventType:id,slug'])
            ->orderByDesc('crm_events.occurred_at')
            ->orderByDesc('crm_events.id')
            ->paginate($perPage, ['crm_events.*'], 'page', $page);

        $events = $paginator->getCollection();
        $entities = $this->entityNames($events, $companyId);
        $recordings = $this->recordings($events, $companyId);

        $paginator->setCollection(
            $events->map(fn (CrmEvent $event) => $this->serialize($event, $viewer, $entities, $recordings))->values()
        );

        return $paginator;
    }

    /**
     * Counts for the summary tiles, over the same scope (no filters).
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

        $endedId = $types['call_ended'] ?? 0;
        $missedIds = array_values(array_filter([
            $types['call_missed'] ?? null,
            $types['call_declined'] ?? null,
            $types['call_busy'] ?? null,
            $types['call_voicemail'] ?? null,
        ]));

        // SQL aggregates over the same base query, so the cost does not grow
        // with a lead's call history (no rows are hydrated).
        $connected = (clone $query)->where('crm_events.event_type_id', $endedId);
        $lastAt = (clone $query)->max('crm_events.occurred_at');

        return [
            'total' => (clone $query)->count(),
            'connected' => (clone $connected)->count(),
            'connected_seconds' => (int) (clone $connected)->sum('crm_events.metadata->duration'),
            'missed' => $missedIds === [] ? 0 : (clone $query)->whereIn('crm_events.event_type_id', $missedIds)->count(),
            'with_recording' => (clone $query)->whereNotNull('crm_events.metadata->recording_id')->count(),
            'unlinked' => (clone $query)->whereNull('crm_events.model_id')->count(),
            'last_at' => $lastAt !== null ? \Illuminate\Support\Carbon::parse($lastAt)->toIso8601String() : null,
        ];
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
            ->whereIn('slug', array_map(fn ($o) => 'call_' . $o, self::OUTCOMES))
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

        $startedId = $types['call_started'] ?? null;
        $outcomeIds = $types->except('call_started')->values()->all();

        // A call that has an outcome event shows one row (the outcome), not a
        // "started" row plus an outcome row. Started rows stay when nothing
        // else shares their correlation id (still ringing, or no outcome came).
        if ($startedId !== null && $outcomeIds !== []) {
            $query->where(function ($q) use ($startedId, $outcomeIds) {
                $q->where('crm_events.event_type_id', '!=', $startedId)
                    ->orWhereNull('crm_events.correlation_id')
                    ->orWhereNotExists(function ($sub) use ($outcomeIds) {
                        $sub->select(DB::raw(1))
                            ->from('crm_events as outcome')
                            ->whereColumn('outcome.correlation_id', 'crm_events.correlation_id')
                            ->whereColumn('outcome.company_id', 'crm_events.company_id')
                            ->whereIn('outcome.event_type_id', $outcomeIds);
                    });
            });
        }

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
     * @param  Collection<string, int>  $types
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, Collection $types, array $filters): void
    {
        if (! empty($filters['outcome'])) {
            $query->where('crm_events.event_type_id', $types['call_' . $filters['outcome']] ?? 0);
        }
        if (! empty($filters['direction'])) {
            $query->where('crm_events.direction', $filters['direction']);
        }
        if (! empty($filters['user_id'])) {
            $query->where('crm_events.user_id', (int) $filters['user_id']);
        }
        if (! empty($filters['from'])) {
            $query->where('crm_events.occurred_at', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->where('crm_events.occurred_at', '<=', $filters['to'] . ' 23:59:59');
        }
        if (! empty($filters['has_recording'])) {
            $query->where('crm_events.metadata', 'like', '%"recording_id"%');
        }
        if (! empty($filters['unlinked'])) {
            $query->whereNull('crm_events.model_id');
        }
        if (! empty($filters['search'])) {
            // Numbers are stored as typed ("+49 170 1234567"), so match the
            // raw term; escape LIKE wildcards so "%" / "_" are literal.
            $term = addcslashes(trim((string) $filters['search']), '%_\\');
            $query->where('crm_events.metadata', 'like', '%' . $term . '%');
        }
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
        $entity = $entities[$type . ':' . $entityId] ?? null;

        $recordingId = isset($meta['recording_id']) ? (int) $meta['recording_id'] : null;
        $callRef = isset($meta['call_ref']) && is_string($meta['call_ref']) ? $meta['call_ref'] : null;
        $recording = $recordingId !== null ? ($recordings['id:' . $recordingId] ?? null) : null;
        if ($recording === null && $callRef !== null) {
            $candidates = $recordings['refs:' . $callRef] ?? [];
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
                'play_url' => $canPlay && $recording ? route('call-recordings.play', $recording->id) : null,
                'download_url' => $canPlay && $recording ? route('call-recordings.download', $recording->id) : null,
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

        $recordings = $query->get(['id', 'call_ref', 'user_id', 'filename', 'duration_seconds', 'expires_at', 'company_id']);

        $byKey = [];
        foreach ($recordings as $rec) {
            $byKey['id:' . $rec->id] = $rec;
            if (! empty($rec->call_ref)) {
                $byKey['refs:' . $rec->call_ref][] = $rec;
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
                    $out['lead:' . $lead->id] = [
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
                    $out['deal:' . $deal->id] = [
                        'name' => $deal->name,
                        'url' => route('deals.show', $deal->id),
                    ];
                });
        }

        return $out;
    }
}
