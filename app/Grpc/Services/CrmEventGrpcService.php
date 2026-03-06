<?php

namespace App\Grpc\Services;

use App\Enums\CrmEventSource;
use App\Grpc\Transformers\CrmEventTransformer;
use App\Models\CrmBusinessRule;
use App\Models\CrmEvent;
use App\Models\CrmEventType;
use App\Services\CrmEventService;
use Illuminate\Support\Facades\Log;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

/**
 * gRPC service implementation for the CRM Event Record Keeping Engine.
 *
 * Mirrors the REST API endpoints but via gRPC protocol.
 * Implements CrmEventServiceInterface generated from proto/crm_event.proto.
 *
 * NOTE: This service is structured to work with the generated protobuf classes.
 * Until proto compilation is run, this serves as the reference implementation.
 * The actual interface implementation will be connected once `protoc` generates
 * the PHP classes from proto/crm_event.proto.
 */
class CrmEventGrpcService
{
    public function __construct(
        private CrmEventService $eventService,
        private CrmEventTransformer $transformer,
    ) {}

    /**
     * Record a single CRM event.
     */
    public function RecordEvent(ContextInterface $ctx, $in): array
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $params = [
                'event_type_slug' => $in->getEventTypeSlug(),
                'company_id' => $companyId,
                'source' => CrmEventSource::GRPC->value,
                'user_id' => $in->getUserId() ?: null,
                'model_type' => $in->getModelType() ?: null,
                'model_id' => $in->getModelId() ?: null,
                'generation_type' => $in->getGenerationType() ?: null,
                'correlation_id' => $in->getCorrelationId() ?: null,
                'causation_id' => $in->getCausationId() ?: null,
                'ip_address' => $in->getIpAddress() ?: null,
                'user_agent' => $in->getUserAgent() ?: null,
                'occurred_at' => $in->getOccurredAt() ?: null,
            ];

            // Parse metadata JSON
            $metadataJson = $in->getMetadataJson();
            if ($metadataJson) {
                $params['metadata'] = json_decode($metadataJson, true);
            }

            // Resolve business rule slug
            $businessRuleSlug = $in->getBusinessRuleSlug();
            if ($businessRuleSlug) {
                $rule = CrmBusinessRule::withoutGlobalScopes()
                    ->where('slug', $businessRuleSlug)
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
            }

            $event = $this->eventService->record($params);

            return [
                'event' => $event ? $this->transformer->transformEvent($event->load(['eventType.category', 'user'])) : null,
                'accepted' => true,
            ];
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    /**
     * Record a batch of CRM events.
     */
    public function RecordBatch(ContextInterface $ctx, $in): array
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $eventsData = [];

            foreach ($in->getEvents() as $eventRequest) {
                $params = [
                    'event_type_slug' => $eventRequest->getEventTypeSlug(),
                    'company_id' => $companyId,
                    'source' => CrmEventSource::GRPC->value,
                    'user_id' => $eventRequest->getUserId() ?: null,
                    'model_type' => $eventRequest->getModelType() ?: null,
                    'model_id' => $eventRequest->getModelId() ?: null,
                    'generation_type' => $eventRequest->getGenerationType() ?: null,
                    'correlation_id' => $eventRequest->getCorrelationId() ?: null,
                    'causation_id' => $eventRequest->getCausationId() ?: null,
                    'ip_address' => $eventRequest->getIpAddress() ?: null,
                    'user_agent' => $eventRequest->getUserAgent() ?: null,
                    'occurred_at' => $eventRequest->getOccurredAt() ?: null,
                ];

                $metadataJson = $eventRequest->getMetadataJson();
                if ($metadataJson) {
                    $params['metadata'] = json_decode($metadataJson, true);
                }

                $eventsData[] = $params;
            }

            $results = $this->eventService->recordBatch($eventsData);

            return [
                'events' => $results->map(fn ($e) => $this->transformer->transformEvent(
                    $e->load(['eventType.category', 'user'])
                ))->toArray(),
                'recorded_count' => $results->count(),
            ];
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    /**
     * Query events with filters and pagination.
     */
    public function QueryEvents(ContextInterface $ctx, $in): array
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $filters = [
                'company_id' => $companyId,
            ];

            if ($in->getEventTypeSlug()) $filters['event_type_slug'] = $in->getEventTypeSlug();
            if ($in->getCategorySlug()) $filters['category_slug'] = $in->getCategorySlug();
            if ($in->getModelType()) $filters['model_type'] = $in->getModelType();
            if ($in->getModelId()) $filters['model_id'] = $in->getModelId();
            if ($in->getUserId()) $filters['user_id'] = $in->getUserId();
            if ($in->getGenerationType()) $filters['generation_type'] = $in->getGenerationType();
            if ($in->getSource()) $filters['source'] = $in->getSource();
            if ($in->getCorrelationId()) $filters['correlation_id'] = $in->getCorrelationId();
            if ($in->getDateFrom()) $filters['date_from'] = $in->getDateFrom();
            if ($in->getDateTo()) $filters['date_to'] = $in->getDateTo();

            // Pagination
            $pagination = $in->getPagination();
            if ($pagination) {
                if ($pagination->getPerPage()) $filters['per_page'] = $pagination->getPerPage();
                if ($pagination->getSortBy()) $filters['sort_by'] = $pagination->getSortBy();
                if ($pagination->getSortOrder()) $filters['sort_order'] = $pagination->getSortOrder();
            }

            $paginated = $this->eventService->query($filters);

            return [
                'events' => collect($paginated->items())->map(fn ($e) => $this->transformer->transformEvent($e))->toArray(),
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'total_pages' => $paginated->lastPage(),
                    'has_more' => $paginated->hasMorePages(),
                ],
            ];
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    /**
     * Get the full event chain for a correlation ID.
     */
    public function GetEventChain(ContextInterface $ctx, $in): array
    {
        try {
            $companyId = $this->getCompanyId($ctx);
            $correlationId = $in->getCorrelationId();

            if (!$correlationId) {
                throw new GRPCException('Correlation ID is required', StatusCode::INVALID_ARGUMENT);
            }

            $events = $this->eventService->getEventChain($correlationId, $companyId);

            return [
                'events' => $events->map(fn ($e) => $this->transformer->transformEvent($e))->toArray(),
                'correlation_id' => $correlationId,
                'total_events' => $events->count(),
            ];
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    /**
     * List available event type definitions.
     */
    public function ListEventTypes(ContextInterface $ctx, $in): array
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $query = CrmEventType::withoutGlobalScopes()
                ->where(function ($q) use ($companyId) {
                    $q->where('company_id', $companyId)->orWhereNull('company_id');
                })
                ->active()
                ->with(['category', 'businessRule']);

            if ($in->getCategorySlug()) {
                $query->whereHas('category', fn ($q) => $q->where('slug', $in->getCategorySlug()));
            }

            if ($in->getModelType()) {
                $query->where('model_type', $in->getModelType());
            }

            $types = $query->orderBy('category_id')->orderBy('name')->get();

            return [
                'event_types' => $types->map(fn ($t) => $this->transformer->transformEventType($t))->toArray(),
            ];
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────

    /**
     * Extract the authenticated company ID from the gRPC context.
     */
    protected function getCompanyId(ContextInterface $ctx): int
    {
        $companyId = $ctx->getValue('authenticated_company_id');

        if (!$companyId) {
            throw new GRPCException('Company authentication required', StatusCode::UNAUTHENTICATED);
        }

        return (int) $companyId;
    }

    /**
     * Map a generic exception to a gRPC exception.
     */
    protected function mapException(\Throwable $e): GRPCException
    {
        Log::error('CrmEventGrpcService error: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString(),
        ]);

        return new GRPCException(
            'Internal server error: ' . $e->getMessage(),
            StatusCode::INTERNAL
        );
    }
}
