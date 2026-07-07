<?php

namespace App\Services\OlWebhook;

use App\Models\CrmEvent;
use App\Models\Deal;
use App\Models\Lead;

class OlPayloadMapper
{
    public function map(CrmEvent $event): ?array
    {
        $event->loadMissing('eventType', 'model');

        $eventType = $event->eventType?->slug;
        $model = $event->model;

        if (!$eventType || !$model) {
            return null;
        }

        $base = [
            'eventId' => $event->uuid,
            'eventType' => $eventType,
            'crmId' => (int) $event->model_id,
            'correlationId' => $event->correlation_id,
            'occurredAt' => optional($event->occurred_at)->toIso8601String(),
        ];

        if ($model instanceof Lead) {
            return $this->mapLead($base, $model);
        }

        if ($model instanceof Deal) {
            return $this->mapDeal($base, $model);
        }

        return null;
    }

    private function mapLead(array $base, Lead $lead): array
    {
        [$firstName, $lastName] = $this->splitName((string) $lead->client_name);

        return array_merge($base, [
            'entityType' => 'lead',
            'firstName' => $firstName,
            'lastName' => $lastName,
            'email' => $lead->client_email,
            'phone' => $lead->mobile_with_phonecode,
            'status' => $lead->lifecycleStatus?->key ?? $lead->status_id,
            'assignedTo' => $lead->leadOwner ? [
                'id' => $lead->leadOwner->id,
                'name' => $lead->leadOwner->name,
            ] : null,
            'category' => $lead->category ? [
                'id' => $lead->category->id,
                'name' => $lead->category->category_name,
            ] : null,
        ]);
    }

    private function mapDeal(array $base, Deal $deal): array
    {
        return array_merge($base, [
            'entityType' => 'deal',
            'title' => $deal->name,
            'value' => $deal->value,
            'stage' => $deal->leadStage?->name ?? $deal->pipeline_stage_id,
            'status' => $deal->outcome_status?->value ?? $deal->status_id,
            'assignedTo' => $deal->leadAgent?->user ? [
                'id' => $deal->leadAgent->user->id,
                'name' => $deal->leadAgent->user->name,
            ] : null,
        ]);
    }

    /**
     * @return array{0:string,1:string}
     */
    private function splitName(string $fullName): array
    {
        $trimmed = trim($fullName);

        if ($trimmed === '') {
            return ['', ''];
        }

        $parts = preg_split('/\s+/', $trimmed, 2) ?: [];

        return [
            $parts[0] ?? '',
            $parts[1] ?? '',
        ];
    }
}

