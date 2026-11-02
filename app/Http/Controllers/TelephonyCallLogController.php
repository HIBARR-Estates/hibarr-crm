<?php

namespace App\Http\Controllers;

use App\Models\CrmEvent;
use App\Models\CrmEventType;
use App\Models\Deal;
use App\Models\Lead;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Company-wide call log for the Call Bridge settings page.
 *
 * Reads the `call_*` events already written to the CRM timeline (by the
 * click-to-call endpoints, the softphone dock and the bridge poller), so it
 * covers every call made from the CRM — including attempts that never
 * connected — without a second source of truth. Admin-only: it exposes every
 * agent's calls.
 */
class TelephonyCallLogController extends AccountBaseController
{
    private const OUTCOMES = ['started', 'ended', 'missed', 'declined', 'voicemail', 'busy', 'failed'];

    public function index(Request $request): JsonResponse
    {
        abort_unless(FeatureFlags::enabled('crm.softphone'), 404);
        abort_403(! user()->hasRole('admin'));

        $validated = $request->validate([
            'outcome' => 'nullable|string|in:' . implode(',', self::OUTCOMES),
            'direction' => 'nullable|string|in:inbound,outbound',
            'user_id' => 'nullable|integer|min:1',
            'search' => 'nullable|string|max:50',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $companyId = (int) company()->id;
        $perPage = (int) ($validated['per_page'] ?? 25);

        // System types are seeded with company_id NULL and shared by everyone.
        $types = CrmEventType::withoutGlobalScopes()
            ->where(fn ($q) => $q->whereNull('company_id')->orWhere('company_id', $companyId))
            ->whereIn('slug', array_map(fn ($o) => 'call_' . $o, self::OUTCOMES))
            ->pluck('id', 'slug');

        $startedId = $types['call_started'] ?? null;
        $outcomeIds = $types->except('call_started')->values()->all();

        $query = CrmEvent::query()
            ->where('crm_events.company_id', $companyId)
            ->whereIn('crm_events.event_type_id', $types->values()->all());

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

        if (! empty($validated['outcome'])) {
            $typeId = $types['call_' . $validated['outcome']] ?? 0;
            $query->where('crm_events.event_type_id', $typeId);
        }
        if (! empty($validated['direction'])) {
            $query->where('crm_events.direction', $validated['direction']);
        }
        if (! empty($validated['user_id'])) {
            $query->where('crm_events.user_id', (int) $validated['user_id']);
        }
        if (! empty($validated['from'])) {
            $query->where('crm_events.occurred_at', '>=', $validated['from']);
        }
        if (! empty($validated['to'])) {
            $query->where('crm_events.occurred_at', '<=', $validated['to'] . ' 23:59:59');
        }
        if (! empty($validated['search'])) {
            // Numbers are stored as typed ("+49 170 1234567"), so match the
            // raw term; escape LIKE wildcards so "%" / "_" are literal.
            $term = addcslashes(trim($validated['search']), '%_\\');
            $query->where('crm_events.metadata', 'like', '%' . $term . '%');
        }

        $paginator = $query
            ->with(['user:id,name', 'eventType:id,slug'])
            ->orderByDesc('crm_events.occurred_at')
            ->orderByDesc('crm_events.id')
            ->paginate($perPage);

        $entities = $this->entityNames($paginator->getCollection(), $companyId);

        $rows = $paginator->getCollection()->map(function (CrmEvent $event) use ($entities) {
            $meta = (array) ($event->metadata ?? []);
            $type = (string) ($meta['entity_type'] ?? $this->modelKey($event));
            $entityId = (int) ($meta['entity_id'] ?? $event->model_id ?? 0);
            $entity = $entities[$type . ':' . $entityId] ?? null;

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
                'has_recording' => ($meta['has_recording'] ?? false) === true || isset($meta['recording_id']),
            ];
        })->values();

        return response()->json([
            'status' => 'success',
            'data' => $rows,
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    private function modelKey(CrmEvent $event): string
    {
        return match ($event->model_type) {
            Lead::class => 'lead',
            Deal::class => 'deal',
            default => '',
        };
    }

    /**
     * Name + link for every lead/deal on the page, in two queries.
     *
     * @param  \Illuminate\Support\Collection<int, CrmEvent>  $events
     * @return array<string, array{name: string|null, url: string}>
     */
    private function entityNames($events, int $companyId): array
    {
        $ids = ['lead' => [], 'deal' => []];

        foreach ($events as $event) {
            $meta = (array) ($event->metadata ?? []);
            $type = (string) ($meta['entity_type'] ?? $this->modelKey($event));
            $id = (int) ($meta['entity_id'] ?? $event->model_id ?? 0);
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
