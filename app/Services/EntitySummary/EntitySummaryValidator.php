<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;

class EntitySummaryValidator
{
    private const LEAD_ACTIONS = [
        'CONTACT_LEAD',
        'SCHEDULE_CALL',
        'SEND_FOLLOWUP_EMAIL',
        'QUALIFY_LEAD',
        'REQUEST_MISSING_INFO',
        'OPEN_DEAL',
        'REVIEW_DEALS',
        'ESCALATE_TO_MANAGER',
        'NO_ACTION_NEEDED',
    ];

    private const DEAL_ACTIONS = [
        'CREATE_TASK',
        'SCHEDULE_CALL',
        'REQUEST_DOCUMENTS',
        'SEND_FOLLOWUP_EMAIL',
        'ADVANCE_STAGE',
        'ESCALATE_TO_MANAGER',
        'REVIEW_STALE_DEAL',
        'NO_ACTION_NEEDED',
    ];

    private const CHIP_TONES = ['green', 'amber', 'red', 'neutral'];

    private const URGENCIES = ['immediate', 'this_week', 'routine'];

    private const CONFIDENCE = ['high', 'medium', 'low'];

    /**
     * @param  array<string, mixed>  $payload
     */
    public function validateLeadSummary(array $payload): void
    {
        $this->validateCommon($payload, 'Lead');

        if (! array_key_exists('primary_risk_source', $payload)) {
            throw new \InvalidArgumentException('Lead summary missing required key: primary_risk_source');
        }

        if (! in_array($payload['primary_risk_source'], ['linked_deal', 'lead', 'none'], true)) {
            throw new \InvalidArgumentException('Invalid lead summary primary_risk_source');
        }

        $this->validateNextStep($payload['next_step'], self::LEAD_ACTIONS, 'Lead');
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function validateDealSummary(array $payload): void
    {
        $this->validateCommon($payload, 'Deal');
        $this->validateNextStep($payload['next_step'], self::DEAL_ACTIONS, 'Deal');

        $meta = $payload['meta'] ?? [];
        if (($meta['stale_data_warning'] ?? false) === true
            && ($meta['data_confidence'] ?? null) === 'high') {
            throw new \InvalidArgumentException(
                'Deal summary meta.data_confidence cannot be high when stale_data_warning is true'
            );
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
            'deal_name' => $deal->name,
            'stage_label' => $deal->leadStage?->name ?? 'Unknown',
            'value' => (float) ($deal->value ?? 0),
            'currency' => $deal->currency?->currency_code ?? 'USD',
            'risk_level' => $dealSummary['risk_level'] ?? 'low',
            'status_line' => $dealSummary['status_line'] ?? '',
            'next_step_label' => $nextStepLabel,
            'is_stale' => (bool) ($dealSummary['meta']['is_stale'] ?? false),
            'source' => $dealSummary['meta']['source'] ?? 'ai',
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function validateCommon(array $payload, string $label): void
    {
        $required = ['status_line', 'risk_level', 'chips', 'bullets', 'next_step', 'meta'];

        foreach ($required as $key) {
            if (! array_key_exists($key, $payload)) {
                throw new \InvalidArgumentException("{$label} summary missing required key: {$key}");
            }
        }

        if (! in_array($payload['risk_level'], ['none', 'low', 'medium', 'high'], true)) {
            throw new \InvalidArgumentException("Invalid {$label} summary risk_level");
        }

        if (! is_array($payload['chips']) || count($payload['chips']) < 1) {
            throw new \InvalidArgumentException("{$label} summary must include at least one chip");
        }

        foreach ($payload['chips'] as $index => $chip) {
            if (! is_array($chip)) {
                throw new \InvalidArgumentException("{$label} summary chip {$index} must be an object");
            }

            foreach (['id', 'label', 'value', 'tone', 'sublabel'] as $chipKey) {
                if (! array_key_exists($chipKey, $chip)) {
                    throw new \InvalidArgumentException("{$label} summary chip {$index} missing {$chipKey}");
                }
            }

            if (! in_array($chip['tone'], self::CHIP_TONES, true)) {
                throw new \InvalidArgumentException("{$label} summary chip {$index} has invalid tone");
            }
        }

        if (! is_array($payload['bullets'])) {
            throw new \InvalidArgumentException("{$label} summary bullets must be an array");
        }

        $meta = $payload['meta'];
        if (! is_array($meta) || empty($meta['generated_at'])) {
            throw new \InvalidArgumentException("{$label} summary meta.generated_at is required");
        }

        if (isset($meta['data_confidence']) && ! in_array($meta['data_confidence'], self::CONFIDENCE, true)) {
            throw new \InvalidArgumentException("{$label} summary meta.data_confidence is invalid");
        }
    }

    /**
     * @param  mixed  $nextStep
     * @param  list<string>  $allowedActions
     */
    private function validateNextStep(mixed $nextStep, array $allowedActions, string $label): void
    {
        if (! is_array($nextStep) || empty($nextStep['action_type']) || empty($nextStep['label'])) {
            throw new \InvalidArgumentException("{$label} summary next_step is invalid");
        }

        if (! in_array($nextStep['action_type'], $allowedActions, true)) {
            throw new \InvalidArgumentException("{$label} summary next_step.action_type is not in taxonomy");
        }

        if (isset($nextStep['urgency']) && ! in_array($nextStep['urgency'], self::URGENCIES, true)) {
            throw new \InvalidArgumentException("{$label} summary next_step.urgency is invalid");
        }
    }
}
