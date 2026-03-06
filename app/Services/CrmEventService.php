<?php

namespace App\Services;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Jobs\RecordCrmEventJob;
use App\Models\CrmEvent;
use App\Models\CrmEventType;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Central service for the CRM Event Record Keeping Engine.
 *
 * All event recording flows through this service. It handles:
 * - Event type resolution with caching
 * - Sync vs async recording based on event type config
 * - Batch recording for high-volume scenarios
 * - Correlation chain management
 * - Filtered querying with pagination
 */
class CrmEventService
{
    /**
     * Record a single CRM event.
     *
     * @param array $params {
     *   @type string      $event_type_slug  Required. The event type slug.
     *   @type int         $company_id       Required. The company ID.
     *   @type int|null    $user_id          Optional. The user who initiated the event.
     *   @type string|null $model_type       Optional. Polymorphic model class.
     *   @type int|null    $model_id         Optional. Polymorphic model ID.
     *   @type string      $generation_type  Optional. Defaults to auto-detected.
     *   @type string      $source           Required. One of CrmEventSource values.
     *   @type string|null $correlation_id   Optional. Groups events in a saga.
     *   @type int|null    $causation_id     Optional. Direct parent event ID.
     *   @type array|null  $metadata         Optional. Free-form payload.
     *   @type string|null $occurred_at      Optional. Defaults to now().
     *   @type string|null $ip_address       Optional.
     *   @type string|null $user_agent       Optional.
     * }
     * @param bool $forceSync Force synchronous recording (used by the queue job).
     * @return CrmEvent|null Returns the event when sync, null when dispatched async.
     */
    public function record(array $params, bool $forceSync = false): ?CrmEvent
    {
        // Resolve event type
        $eventType = $this->resolveEventType(
            $params['event_type_slug'],
            $params['company_id'] ?? null
        );

        if (!$eventType) {
            Log::warning('CrmEventService::record — Unknown event type slug.', [
                'slug' => $params['event_type_slug'],
                'company_id' => $params['company_id'] ?? null,
            ]);
            return null;
        }

        if (!$eventType->is_active) {
            Log::debug('CrmEventService::record — Event type is inactive. Skipping.', [
                'slug' => $params['event_type_slug'],
            ]);
            return null;
        }

        // Check if the category is active
        if ($eventType->relationLoaded('category') && !$eventType->category->is_active) {
            Log::debug('CrmEventService::record — Event category is inactive. Skipping.', [
                'slug' => $params['event_type_slug'],
                'category' => $eventType->category->slug ?? 'unknown',
            ]);
            return null;
        }

        // Auto-detect generation type
        $generationType = $params['generation_type']
            ?? ($params['user_id'] ?? null
                ? CrmEventGenerationType::USER_GENERATED->value
                : CrmEventGenerationType::SYSTEM_GENERATED->value);

        // Build the event payload
        $eventData = [
            'uuid' => Str::uuid()->toString(),
            'company_id' => $params['company_id'],
            'event_type_id' => $eventType->id,
            'generation_type' => $generationType,
            'user_id' => $params['user_id'] ?? null,
            'model_type' => $params['model_type'] ?? $eventType->model_type,
            'model_id' => $params['model_id'] ?? null,
            'correlation_id' => $params['correlation_id'] ?? null,
            'causation_id' => $params['causation_id'] ?? null,
            'source' => $params['source'],
            'ip_address' => $params['ip_address'] ?? null,
            'user_agent' => $params['user_agent'] ?? null,
            'metadata' => $params['metadata'] ?? null,
            'occurred_at' => $params['occurred_at'] ?? now(),
        ];

        // Dispatch async or insert sync
        if (!$forceSync && $eventType->isAsync()) {
            $queueConnection = config('crm_events.queue.connection');
            $queueName = config('crm_events.queue.name', 'crm_events');

            $job = new RecordCrmEventJob($eventData);

            if ($queueConnection) {
                $job->onConnection($queueConnection);
            }

            dispatch($job->onQueue($queueName));

            Log::debug('CrmEventService::record — Dispatched async.', [
                'slug' => $params['event_type_slug'],
                'uuid' => $eventData['uuid'],
            ]);

            return null;
        }

        // Sync insert
        $event = CrmEvent::withoutGlobalScopes()->create($eventData);

        Log::debug('CrmEventService::record — Recorded sync.', [
            'id' => $event->id,
            'slug' => $params['event_type_slug'],
            'uuid' => $event->uuid,
        ]);

        return $event;
    }

    /**
     * Record multiple events in a single batch.
     *
     * All events in a batch are inserted synchronously for consistency.
     *
     * @param array $events Array of event param arrays (same format as record()).
     * @return \Illuminate\Support\Collection<CrmEvent>
     */
    public function recordBatch(array $events): \Illuminate\Support\Collection
    {
        $results = collect();

        foreach ($events as $eventParams) {
            $result = $this->record($eventParams, forceSync: true);

            if ($result) {
                $results->push($result);
            }
        }

        return $results;
    }

    /**
     * Generate a new correlation ID for chaining events into a saga.
     */
    public function startCorrelation(): string
    {
        return Str::uuid()->toString();
    }

    /**
     * Query and filter events with pagination.
     *
     * @param array $filters {
     *   @type int         $company_id       Required.
     *   @type string|null $event_type_slug  Filter by event type slug.
     *   @type string|null $category_slug    Filter by category slug.
     *   @type string|null $model_type       Filter by polymorphic model class.
     *   @type int|null    $model_id         Filter by polymorphic model ID.
     *   @type int|null    $user_id          Filter by initiating user.
     *   @type string|null $generation_type  Filter by generation type.
     *   @type string|null $source           Filter by source.
     *   @type string|null $correlation_id   Filter by correlation chain.
     *   @type string|null $date_from        Filter from this date (inclusive).
     *   @type string|null $date_to          Filter to this date (inclusive).
     *   @type int         $per_page         Items per page (default 15).
     *   @type string      $sort_by          Sort field (default 'occurred_at').
     *   @type string      $sort_order       Sort direction (default 'desc').
     * }
     */
    public function query(array $filters): LengthAwarePaginator
    {
        $query = CrmEvent::withoutGlobalScopes()
            ->where('company_id', $filters['company_id'])
            ->with(['eventType.category', 'user']);

        // Event type slug
        if (!empty($filters['event_type_slug'])) {
            $query->ofType($filters['event_type_slug']);
        }

        // Category slug
        if (!empty($filters['category_slug'])) {
            $query->whereHas('eventType.category', fn ($q) => $q->where('slug', $filters['category_slug']));
        }

        // Polymorphic model
        if (!empty($filters['model_type'])) {
            $query->where('model_type', $filters['model_type']);
            if (!empty($filters['model_id'])) {
                $query->where('model_id', $filters['model_id']);
            }
        }

        // User
        if (!empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        // Generation type
        if (!empty($filters['generation_type'])) {
            $query->where('generation_type', $filters['generation_type']);
        }

        // Source
        if (!empty($filters['source'])) {
            $query->where('source', $filters['source']);
        }

        // Correlation
        if (!empty($filters['correlation_id'])) {
            $query->forCorrelation($filters['correlation_id']);
        }

        // Date range
        if (!empty($filters['date_from'])) {
            $query->where('occurred_at', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->where('occurred_at', '<=', $filters['date_to']);
        }

        // Sorting
        $sortBy = $filters['sort_by'] ?? 'occurred_at';
        $sortOrder = $filters['sort_order'] ?? 'desc';
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = min($filters['per_page'] ?? 15, 100);

        return $query->paginate($perPage);
    }

    /**
     * Get all events in a correlation chain, ordered chronologically.
     *
     * Returns a flat collection with causation relationships eager-loaded
     * so the caller can reconstruct the event tree.
     *
     * @param string $correlationId The correlation UUID.
     * @param int    $companyId     The company ID for scoping.
     * @return Collection
     */
    public function getEventChain(string $correlationId, int $companyId): Collection
    {
        return CrmEvent::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->forCorrelation($correlationId)
            ->with(['eventType.category', 'user', 'causation', 'effects'])
            ->orderBy('occurred_at', 'asc')
            ->get();
    }

    /**
     * Get all events for a specific model instance.
     *
     * @param string $modelType Fully qualified model class.
     * @param int    $modelId   Model primary key.
     * @param int    $companyId Company ID for scoping.
     * @return Collection
     */
    public function getModelEvents(string $modelType, int $modelId, int $companyId): Collection
    {
        return CrmEvent::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->forModel($modelType, $modelId)
            ->with(['eventType.category', 'user'])
            ->orderBy('occurred_at', 'desc')
            ->get();
    }

    // ─── Type Resolution ─────────────────────────────────────────

    /**
     * Resolve an event type by slug and company ID.
     *
     * Looks up company-specific override first, then falls back to global (company_id = null).
     * Uses cache to avoid per-event DB hits.
     *
     * @param string   $slug      The event type slug.
     * @param int|null $companyId The company ID (nullable for global lookups).
     * @return CrmEventType|null
     */
    public function resolveEventType(string $slug, ?int $companyId = null): ?CrmEventType
    {
        $cacheKey = config('crm_events.cache.prefix', 'crm_event_')
            . 'type_' . ($companyId ?? 'global') . '_' . $slug;

        $ttl = config('crm_events.cache.event_type_ttl', 300);

        return Cache::remember($cacheKey, $ttl, function () use ($slug, $companyId) {
            // Try company-specific first
            if ($companyId) {
                $type = CrmEventType::withoutGlobalScopes()
                    ->where('slug', $slug)
                    ->where('company_id', $companyId)
                    ->with('category')
                    ->first();

                if ($type) {
                    return $type;
                }
            }

            // Fall back to global (system) type
            return CrmEventType::withoutGlobalScopes()
                ->where('slug', $slug)
                ->whereNull('company_id')
                ->with('category')
                ->first();
        });
    }

    /**
     * Clear the event type cache for a company (call after config changes).
     */
    public function clearTypeCache(?int $companyId = null): void
    {
        // Since we can't easily clear by prefix with all cache drivers,
        // we flush specific known slugs from config
        $prefix = config('crm_events.cache.prefix', 'crm_event_');
        $eventTypes = config('crm_events.event_types', []);

        foreach ($eventTypes as $eventType) {
            $slug = $eventType['slug'];
            Cache::forget($prefix . 'type_' . ($companyId ?? 'global') . '_' . $slug);
            if ($companyId) {
                Cache::forget($prefix . 'type_global_' . $slug);
            }
        }
    }
}
