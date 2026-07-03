<?php

namespace App\Services\EntitySummary;

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
        $required = [
            'deal_id', 'deal_name', 'value', 'currency', 'stage_label',
            'risk_level', 'status_line', 'next_step_label', 'meta',
        ];

        foreach ($required as $key) {
            if (! array_key_exists($key, $payload)) {
                throw new \InvalidArgumentException("Deal summary missing required key: {$key}");
            }
        }

        if (! in_array($payload['risk_level'], ['none', 'low', 'medium', 'high'], true)) {
            throw new \InvalidArgumentException('Invalid deal summary risk_level');
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function toLeadConsumerShape(array $dealSummary): array
    {
        return [
            'deal_id' => (string) ($dealSummary['deal_id'] ?? ''),
            'deal_name' => (string) ($dealSummary['deal_name'] ?? ''),
            'value' => (float) ($dealSummary['value'] ?? 0),
            'currency' => (string) ($dealSummary['currency'] ?? 'USD'),
            'stage_label' => (string) ($dealSummary['stage_label'] ?? ''),
            'risk_level' => (string) ($dealSummary['risk_level'] ?? 'none'),
            'status_line' => (string) ($dealSummary['status_line'] ?? ''),
            'next_step_label' => $dealSummary['next_step_label'] ?? null,
        ];
    }
}
