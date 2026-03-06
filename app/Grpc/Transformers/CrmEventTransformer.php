<?php

namespace App\Grpc\Transformers;

use App\Models\CrmEvent;
use App\Models\CrmEventType;

/**
 * Transforms CrmEvent and CrmEventType Eloquent models into arrays
 * suitable for gRPC message construction.
 *
 * Note: The actual protobuf message classes are generated from proto/crm_event.proto.
 * This transformer produces associative arrays that mirror the proto message fields.
 * When the generated classes are available, this can be updated to return typed messages.
 */
class CrmEventTransformer
{
    /**
     * Transform a CrmEvent model to a gRPC-compatible array.
     */
    public function transformEvent(CrmEvent $event): array
    {
        return [
            'id' => $event->id,
            'uuid' => $event->uuid,
            'company_id' => $event->company_id,
            'event_type_id' => $event->event_type_id,
            'event_type_slug' => $event->eventType?->slug ?? '',
            'event_type_name' => $event->eventType?->name ?? '',
            'category_slug' => $event->eventType?->category?->slug ?? '',
            'category_name' => $event->eventType?->category?->name ?? '',
            'generation_type' => $event->getRawOriginal('generation_type') ?? '',
            'user_id' => $event->user_id ?? 0,
            'model_type' => $event->model_type ?? '',
            'model_id' => $event->model_id ?? 0,
            'correlation_id' => $event->correlation_id ?? '',
            'causation_id' => $event->causation_id ?? 0,
            'source' => $event->getRawOriginal('source') ?? '',
            'ip_address' => $event->ip_address ?? '',
            'user_agent' => $event->user_agent ?? '',
            'metadata_json' => $event->metadata ? json_encode($event->metadata) : '',
            'occurred_at' => $event->occurred_at?->toIso8601String() ?? '',
            'created_at' => $event->created_at?->toIso8601String() ?? '',
        ];
    }

    /**
     * Transform a CrmEventType model to a gRPC-compatible array.
     */
    public function transformEventType(CrmEventType $type): array
    {
        return [
            'id' => $type->id,
            'slug' => $type->slug,
            'name' => $type->name,
            'description' => $type->description ?? '',
            'model_type' => $type->model_type ?? '',
            'category_slug' => $type->category?->slug ?? '',
            'category_name' => $type->category?->name ?? '',
            'is_system' => $type->is_system,
            'is_active' => $type->is_active,
            'sync_processing' => $type->sync_processing,
            'business_rule_slug' => $type->businessRule?->slug ?? '',
            'business_rule_name' => $type->businessRule?->name ?? '',
        ];
    }
}
