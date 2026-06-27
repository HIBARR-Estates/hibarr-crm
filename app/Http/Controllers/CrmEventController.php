<?php

namespace App\Http\Controllers;

use App\Enums\CrmEventSource;
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

        // Normalize model_type — the Froiden XSS middleware double-escapes
        // backslashes in FQCN strings (App\\Models\\Deal → App\\\\Models\\\\Deal)
        if (!empty($params['model_type'])) {
            $params['model_type'] = stripslashes($params['model_type']);
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

        // Normalize model_type — the Froiden XSS middleware double-escapes
        // backslashes in FQCN strings (App\\Models\\Deal → App\\\\Models\\\\Deal)
        if (!empty($filters['model_type'])) {
            $filters['model_type'] = stripslashes($filters['model_type']);
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
     * Transform a CrmEvent model into a JSON-serializable array.
     */
    protected function transformEvent(CrmEvent $event, bool $withRelations = false): array
    {
        $data = [
            'uuid' => $event->uuid,
            'event_type' => $event->eventType ? [
                'slug' => $event->eventType->slug,
                'name' => $event->eventType->name,
                'category' => $event->eventType->category ? [
                    'slug' => $event->eventType->category->slug,
                    'name' => $event->eventType->category->name,
                ] : null,
            ] : null,
            'generation_type' => $event->generation_type?->value ?? $event->generation_type,
            'status' => $event->status?->value ?? $event->status,
            'direction' => $event->direction?->value ?? $event->direction,
            'user_id' => $event->user_id,
            'user' => $event->relationLoaded('user') && $event->user ? [
                'id' => $event->user->id,
                'name' => $event->user->name,
            ] : null,
            'model_type' => $event->model_type,
            'model_id' => $event->model_id,
            'correlation_id' => $event->correlation_id,
            'causation_id' => $event->causation_id,
            'source' => $event->source?->value ?? $event->source,
            'ip_address' => $event->ip_address,
            'metadata' => $event->metadata,
            'occurred_at' => $event->occurred_at?->toIso8601String(),
            'created_at' => $event->created_at?->toIso8601String(),
        ];

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
