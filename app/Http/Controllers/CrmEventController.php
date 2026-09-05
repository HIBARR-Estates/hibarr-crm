<?php

namespace App\Http\Controllers;

use App\Enums\CrmEventDirection;
use App\Enums\CrmEventSource;
use App\Enums\CrmEventStatus;
use App\Models\CrmBusinessRule;
use App\Models\CrmEvent;
use App\Services\CrmEventService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

/**
 * REST API controller for CRM Event ingestion and querying.
 *
 * Endpoints are exposed under the api.token middleware for external consumers.
 */
class CrmEventController extends Controller
{
    public function __construct(
        protected CrmEventService $eventService
    ) {}

    /**
     * Record a single CRM event.
     *
     * POST /api/crm-events
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'event_type_slug' => 'required|string|max:100',
            'business_rule_slug' => 'nullable|string|max:100',
            'model_type' => 'nullable|string|max:255',
            'model_id' => 'nullable|integer',
            'user_id' => 'nullable|integer',
            'generation_type' => 'nullable|string|in:user_generated,system_generated,external',
            'status' => 'nullable|string|in:completed,error_occurred,missed,rejected',
            'direction' => 'nullable|string|in:inbound,outbound',
            'correlation_id' => 'nullable|string|max:36',
            'causation_id' => 'nullable|integer',
            'metadata' => 'nullable|array',
            'occurred_at' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $companyId = $this->resolveCompanyId($request);

        Log::info('[CrmEventController::store] Called.', [
            'company_id' => $companyId,
            'source' => CrmEventSource::API->value,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $params = array_merge($validator->validated(), [
            'company_id' => $companyId,
            'source' => CrmEventSource::API->value,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        if (!empty($params['model_type'])) {
            $params['model_type'] = $this->normalizeModelType($params['model_type']);
        }

        // Resolve business rule slug to metadata if provided
        if (!empty($params['business_rule_slug'])) {
            $rule = CrmBusinessRule::withoutGlobalScopes()
                ->where('slug', $params['business_rule_slug'])
                ->where(function ($q) use ($companyId) {
                    $q->where('company_id', $companyId)->orWhereNull('company_id');
                })
                ->first();

            if ($rule) {
                $params['metadata'] = array_merge($params['metadata'] ?? [], [
                    'business_rule_id' => $rule->id,
                    'business_rule_slug' => $rule->slug,
                ]);
            }
            unset($params['business_rule_slug']);
        }

        $event = $this->eventService->record($params);

        if ($event) {
            return response()->json([
                'status' => 'success',
                'message' => 'Event recorded.',
                'data' => $this->transformEvent($event),
            ], 201);
        }

        // Event was dispatched async or type was inactive
        return response()->json([
            'status' => 'accepted',
            'message' => 'Event accepted for processing.',
        ], 202);
    }

    /**
     * Record multiple CRM events in a batch.
     *
     * POST /api/crm-events/batch
     */
    public function storeBatch(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'events' => 'required|array|min:1|max:100',
            'events.*.event_type_slug' => 'required|string|max:100',
            'events.*.model_type' => 'nullable|string|max:255',
            'events.*.model_id' => 'nullable|integer',
            'events.*.user_id' => 'nullable|integer',
            'events.*.generation_type' => 'nullable|string|in:user_generated,system_generated,external',
            'events.*.status' => 'nullable|string|in:completed,error_occurred,missed,rejected',
            'events.*.direction' => 'nullable|string|in:inbound,outbound',
            'events.*.correlation_id' => 'nullable|string|max:36',
            'events.*.causation_id' => 'nullable|integer',
            'events.*.metadata' => 'nullable|array',
            'events.*.occurred_at' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $companyId = $this->resolveCompanyId($request);
        $events = collect($validator->validated()['events'])->map(function ($event) use ($companyId, $request) {
            if (!empty($event['model_type'])) {
                $event['model_type'] = $this->normalizeModelType($event['model_type']);
            }

            return array_merge($event, [
                'company_id' => $companyId,
                'source' => CrmEventSource::API->value,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        })->toArray();

        $results = $this->eventService->recordBatch($events);

        return response()->json([
            'status' => 'success',
            'message' => $results->count() . ' events recorded.',
            'data' => $results->map(fn ($e) => $this->transformEvent($e))->values(),
        ], 201);
    }

    /**
     * Query/list CRM events with filters and pagination.
     *
     * GET /api/crm-events
     */
    public function index(Request $request): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        Log::info('[CrmEventController::index] Called.', [
            'company_id' => $companyId,
            'model_type' => $request->input('model_type'),
            'model_id' => $request->input('model_id'),
            'auth_user_id' => \Illuminate\Support\Facades\Auth::id(),
            'has_company_header' => $request->hasHeader('X-COMPANY-ID'),
            'company_header' => $request->header('X-COMPANY-ID'),
        ]);

        $filters = array_merge($request->only([
            'event_type_slug',
            'category_slug',
            'model_type',
            'model_id',
            'user_id',
            'generation_type',
            'status',
            'direction',
            'source',
            'correlation_id',
            'date_from',
            'date_to',
            'per_page',
            'sort_by',
            'sort_order',
        ]), ['company_id' => $companyId]);

        if (!empty($filters['model_type'])) {
            $filters['model_type'] = $this->normalizeModelType($filters['model_type']);
        }

        $paginated = $this->eventService->query($filters);

        return response()->json([
            'status' => 'success',
            'data' => collect($paginated->items())->map(fn ($e) => $this->transformEvent($e)),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'total_pages' => $paginated->lastPage(),
                'has_more' => $paginated->hasMorePages(),
            ],
        ]);
    }

    /**
     * Get a single CRM event by UUID.
     *
     * GET /api/crm-events/{uuid}
     */
    public function show(Request $request, string $uuid): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        $event = CrmEvent::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('uuid', $uuid)
            ->with(['eventType.category', 'user', 'causation', 'effects'])
            ->first();

        if (!$event) {
            return response()->json([
                'status' => 'error',
                'message' => 'Event not found.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $this->transformEvent($event, withRelations: true),
        ]);
    }

    /**
     * Get the full event chain for a correlation ID.
     *
     * GET /api/crm-events/chain/{correlationId}
     */
    public function chain(Request $request, string $correlationId): JsonResponse
    {
        $companyId = $this->resolveCompanyId($request);

        $events = $this->eventService->getEventChain($correlationId, $companyId);

        if ($events->isEmpty()) {
            return response()->json([
                'status' => 'error',
                'message' => 'No events found for this correlation chain.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $events->map(fn ($e) => $this->transformEvent($e, withRelations: true)),
            'meta' => [
                'correlation_id' => $correlationId,
                'total_events' => $events->count(),
            ],
        ]);
    }

    /**
     * Update an agent-logged (user-generated) CRM event.
     *
     * PATCH /api/crm-events/{uuid}
     *
     * Restricted to administrators. Only user-generated events may be edited —
     * system-generated and external events are immutable records.
     */
    public function update(Request $request, string $uuid): JsonResponse
    {
        if (!$this->userCanManageEvents()) {
            return response()->json([
                'status' => 'error',
                'message' => 'You are not authorized to modify timeline events.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'nullable|string|in:completed,error_occurred,missed,rejected',
            'direction' => 'nullable|string|in:inbound,outbound',
            'comment' => 'nullable|string|max:2000',
            'occurred_at' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $companyId = $this->resolveCompanyId($request);

        $event = CrmEvent::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('uuid', $uuid)
            ->first();

        if (!$event) {
            return response()->json([
                'status' => 'error',
                'message' => 'Event not found.',
            ], 404);
        }

        if (!$this->isAgentLoggedEvent($event)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Only agent-logged events can be edited.',
            ], 403);
        }

        $data = $validator->validated();

        if (array_key_exists('status', $data) && $data['status'] !== null) {
            $event->status = CrmEventStatus::from($data['status']);
        }

        // `direction` is nullable — an explicit null clears it, an omitted key
        // leaves it untouched (nullable keys absent from the request are not
        // returned by validated()).
        if (array_key_exists('direction', $data)) {
            $event->direction = $data['direction'] !== null
                ? CrmEventDirection::from($data['direction'])
                : null;
        }

        if (array_key_exists('occurred_at', $data) && $data['occurred_at']) {
            $event->occurred_at = $data['occurred_at'];
        }

        if (array_key_exists('comment', $data)) {
            $metadata = $event->metadata ?? [];
            if ($data['comment'] === null || $data['comment'] === '') {
                unset($metadata['comment']);
            } else {
                $metadata['comment'] = $data['comment'];
            }
            $event->metadata = $metadata;
        }

        $event->save();
        $event->load(['eventType.category', 'user']);

        return response()->json([
            'status' => 'success',
            'message' => 'Event updated.',
            'data' => $this->transformEvent($event),
        ]);
    }

    /**
     * Delete an agent-logged (user-generated) CRM event.
     *
     * DELETE /api/crm-events/{uuid}
     *
     * Restricted to administrators. Only user-generated events may be deleted.
     */
    public function destroy(Request $request, string $uuid): JsonResponse
    {
        if (!$this->userCanManageEvents()) {
            return response()->json([
                'status' => 'error',
                'message' => 'You are not authorized to delete timeline events.',
            ], 403);
        }

        $companyId = $this->resolveCompanyId($request);

        $event = CrmEvent::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('uuid', $uuid)
            ->first();

        if (!$event) {
            return response()->json([
                'status' => 'error',
                'message' => 'Event not found.',
            ], 404);
        }

        if (!$this->isAgentLoggedEvent($event)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Only agent-logged events can be deleted.',
            ], 403);
        }

        $event->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Event deleted.',
        ]);
    }

    /**
     * An "agent-logged" event is one a person recorded by hand through the Log
     * Action flow, which always uses a custom (admin-created) event type.
     *
     * This is deliberately NOT `generation_type === user_generated`: events the
     * system records as a side effect of user activity (field edits, stage
     * changes) are also user_generated, but they are an audit trail and must
     * stay immutable. The system-seeded event types behind them carry
     * `is_system = true`, which is what separates the two.
     */
    protected function isAgentLoggedEvent(CrmEvent $event): bool
    {
        $event->loadMissing('eventType');

        return $event->eventType !== null && !$event->eventType->is_system;
    }

    /**
     * Whether the current session user may edit/delete agent-logged events.
     * Gated to administrators (see HIB-1038 — timeline event management).
     *
     * Important: Role uses HasCompany/CompanyScope. On API requests the active
     * company in scope can disagree with how roles were loaded for the Inertia
     * page, which made hasRole('admin') return false even for real admins and
     * broke delete/update while the UI still showed the controls. Bypass the
     * company scope for this check, and prefer the session role cache when set.
     */
    protected function userCanManageEvents(): bool
    {
        $user = Auth::user();
        if ($user === null) {
            return false;
        }

        if (function_exists('user_roles') && session()->has('user_roles')) {
            return in_array('admin', user_roles(), true);
        }

        return $user->roles()
            ->withoutGlobalScopes()
            ->where('roles.name', 'admin')
            ->exists();
    }

    /**
     * Resolve company ID from the X-COMPANY-ID header (external API consumers)
     * or from the authenticated session user (frontend / Inertia requests).
     */
    protected function resolveCompanyId(Request $request): int
    {
        if ($request->hasHeader('X-COMPANY-ID') && $request->header('X-COMPANY-ID') !== '') {
            return (int) $request->header('X-COMPANY-ID');
        }

        return (int) (Auth::user()?->company_id ?? 0);
    }

    /**
     * Collapse escaped FQCN backslashes to the canonical Eloquent class name.
     *
     * Callers send either `App\Models\Lead` or `App\\Models\\Lead` (the latter
     * was required when this used stripslashes(), which turns a single-backslash
     * FQCN into `AppModelsLead`). Both forms normalize to `App\Models\Lead`.
     */
    protected function normalizeModelType(string $modelType): string
    {
        $normalized = preg_replace('/\\\\+/', '\\', $modelType) ?? $modelType;

        // Recover the fully-stripped form the old stripslashes() left behind (and
        // that clients still occasionally send). Left unrecovered, these events
        // resolve to no model at all, which silently breaks first-contact stamping.
        if (!str_contains($normalized, '\\')) {
            foreach ([\App\Models\Lead::class, \App\Models\Deal::class] as $candidate) {
                if (str_replace('\\', '', $candidate) === $normalized) {
                    return $candidate;
                }
            }
        }

        return $normalized;
    }

    /**
     * Transform a CrmEvent model into a JSON-serializable array.
     */
    protected function transformEvent(CrmEvent $event, bool $withRelations = false): array
    {
        $data = $event->toTimelineArray();

        if ($withRelations) {
            $data['causation'] = $event->relationLoaded('causation') && $event->causation
                ? [
                    'uuid' => $event->causation->uuid,
                    'event_type_slug' => $event->causation->eventType?->slug,
                    'occurred_at' => $event->causation->occurred_at?->toIso8601String(),
                ]
                : null;

            $data['effects'] = $event->relationLoaded('effects')
                ? $event->effects->map(fn ($e) => [
                    'uuid' => $e->uuid,
                    'event_type_slug' => $e->eventType?->slug,
                    'occurred_at' => $e->occurred_at?->toIso8601String(),
                ])->values()
                : [];
        }

        return $data;
    }
}
