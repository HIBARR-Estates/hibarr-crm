<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;

class EntitySummaryValidator
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function validateLeadSummary(array $payload): void
    {
        $required = ['status_line', 'risk_level', 'primary_risk_source', 'chips', 'bullets', 'next_step', 'meta'];

        foreach ($required as $key) {
            if (! array_key_exists($key, $payload)) {
                throw new \InvalidArgumentException("Lead summary missing required key: {$key}");
            }
        }

        if (! in_array($payload['risk_level'], ['none', 'low', 'medium', 'high'], true)) {
            throw new \InvalidArgumentException('Invalid lead summary risk_level');
        }

        if (! is_array($payload['chips']) || count($payload['chips']) < 1) {
            throw new \InvalidArgumentException('Lead summary must include at least one chip');
        }

        if (! is_array($payload['bullets'])) {
            throw new \InvalidArgumentException('Lead summary bullets must be an array');
        }

        $nextStep = $payload['next_step'];
        if (! is_array($nextStep) || empty($nextStep['action_type'])) {
            throw new \InvalidArgumentException('Lead summary next_step is invalid');
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function validateDealSummary(array $payload): void
    {
        $required = ['status_line', 'risk_level', 'chips', 'bullets', 'next_step', 'meta'];

        foreach ($required as $key) {
            if (! array_key_exists($key, $payload)) {
                throw new \InvalidArgumentException("Deal summary missing required key: {$key}");
            }
        }

        if (! in_array($payload['risk_level'], ['none', 'low', 'medium', 'high'], true)) {
            throw new \InvalidArgumentException('Invalid deal summary risk_level');
        }

        if (! is_array($payload['chips']) || count($payload['chips']) < 1) {
            throw new \InvalidArgumentException('Deal summary must include at least one chip');
        }

        if (! is_array($payload['bullets'])) {
            throw new \InvalidArgumentException('Deal summary bullets must be an array');
        }

        $nextStep = $payload['next_step'];
        if (! is_array($nextStep) || empty($nextStep['action_type'])) {
            throw new \InvalidArgumentException('Deal summary next_step is invalid');
        }
    }

    /**
     * @param  array<string, mixed>  $dealSummary
     * @return array<string, mixed>
     */
    public function toLeadConsumerShape(array $dealSummary, Deal $deal): array
    {
        $nextStep = $dealSummary['next_step'] ?? null;
        $nextStepLabel = $dealSummary['next_step_label']
            ?? (is_array($nextStep) ? ($nextStep['label'] ?? null) : null);

        return [
            'deal_id' => (string) $deal->id,
            'deal_name' => (string) $deal->name,
            'value' => (float) ($deal->value ?? 0),
            'currency' => (string) ($deal->currency?->currency_code ?? 'USD'),
            'stage_label' => (string) ($deal->leadStage?->name ?? 'Unknown'),
            'risk_level' => (string) ($dealSummary['risk_level'] ?? 'none'),
            'status_line' => (string) ($dealSummary['status_line'] ?? ''),
            'next_step_label' => $nextStepLabel,
        ];
    }
}
