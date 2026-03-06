<?php

namespace App\Traits;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Models\CrmEvent;
use App\Services\CrmEventService;
use Illuminate\Database\Eloquent\Model;

/**
 * Convenience trait for recording CRM events from observers, controllers, and jobs.
 *
 * Provides a simplified API that auto-fills common fields (company_id, user_id,
 * model_type/model_id, source, generation_type) from context.
 *
 * Usage:
 *   use RecordsCrmEvents;
 *
 *   // In an observer:
 *   $this->recordCrmEvent('deal_created', $deal, ['metadata_key' => 'value']);
 *
 *   // With correlation:
 *   $correlationId = $this->startEventCorrelation();
 *   $this->recordCrmEvent('deal_created', $deal, [
 *       'correlation_id' => $correlationId,
 *   ]);
 *   $this->recordCrmEvent('deal_agent_assigned', $deal, [
 *       'correlation_id' => $correlationId,
 *       'causation_id' => $previousEvent->id,
 *   ]);
 */
trait RecordsCrmEvents
{
    /**
     * Record a CRM event with auto-filled context.
     *
     * @param string     $eventTypeSlug The event type slug (e.g. 'deal_created').
     * @param Model|null $model         The model involved (auto-extracts type, id, company_id).
     * @param array      $extra         Additional params to merge/override defaults.
     * @return CrmEvent|null
     */
    protected function recordCrmEvent(string $eventTypeSlug, ?Model $model = null, array $extra = []): ?CrmEvent
    {
        /** @var CrmEventService $service */
        $service = app(CrmEventService::class);

        $params = array_merge(
            $this->buildEventDefaults($model),
            ['event_type_slug' => $eventTypeSlug],
            $extra
        );

        return $service->record($params);
    }

    /**
     * Start a new correlation chain and return the correlation ID.
     */
    protected function startEventCorrelation(): string
    {
        return app(CrmEventService::class)->startCorrelation();
    }

    /**
     * Build default event parameters from context.
     */
    private function buildEventDefaults(?Model $model = null): array
    {
        $companyId = null;
        $userId = null;
        $modelType = null;
        $modelId = null;

        // Extract model info
        if ($model) {
            $modelType = get_class($model);
            $modelId = $model->getKey();

            // Try to get company_id from the model
            if (method_exists($model, 'getAttribute') && $model->getAttribute('company_id')) {
                $companyId = $model->getAttribute('company_id');
            }
        }

        // Fall back to auth context for company_id and user_id
        if (!$companyId && function_exists('company')) {
            try {
                $company = company();
                $companyId = $company?->id;
            } catch (\Throwable) {
                // Not in a company context
            }
        }

        if (auth()->check()) {
            $userId = auth()->id();
            if (!$companyId && auth()->user()->company_id ?? null) {
                $companyId = auth()->user()->company_id;
            }
        }

        // Auto-detect source from call context
        $source = $this->detectEventSource();

        // Auto-detect generation type
        $generationType = $userId
            ? CrmEventGenerationType::USER_GENERATED->value
            : CrmEventGenerationType::SYSTEM_GENERATED->value;

        return [
            'company_id' => $companyId,
            'user_id' => $userId,
            'model_type' => $modelType,
            'model_id' => $modelId,
            'source' => $source,
            'generation_type' => $generationType,
        ];
    }

    /**
     * Detect the event source based on the calling context.
     */
    private function detectEventSource(): string
    {
        $class = static::class;

        // Check if we're in an observer
        if (str_contains($class, 'Observer')) {
            return CrmEventSource::OBSERVER->value;
        }

        // Check if we're in a job
        if (str_contains($class, 'Job') || is_subclass_of($class, \Illuminate\Contracts\Queue\ShouldQueue::class)) {
            return CrmEventSource::JOB->value;
        }

        // Check if we're in a controller
        if (str_contains($class, 'Controller')) {
            return CrmEventSource::CONTROLLER->value;
        }

        // Check if we're in middleware
        if (str_contains($class, 'Middleware')) {
            return CrmEventSource::MIDDLEWARE->value;
        }

        // Check if we're in a gRPC service
        if (str_contains($class, 'Grpc')) {
            return CrmEventSource::GRPC->value;
        }

        // Default to system
        return CrmEventSource::SYSTEM->value;
    }
}
