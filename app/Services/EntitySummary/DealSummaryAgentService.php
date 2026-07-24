<?php

namespace App\Services\EntitySummary;

use App\Contracts\EntitySummaryAgentInterface;
use App\Models\Deal;

class DealSummaryAgentService
{
    private const PROMPT_VERSION = 'v1';

    public function __construct(
        private EntitySummaryAgentInterface $agent,
        private EntitySummaryPromptLoader $promptLoader,
        private DealSummaryInputBuilder $inputBuilder,
        private EntitySummaryValidator $validator,
    ) {}

    /**
     * Generate via AI. Throws on AI/validation failure (no silent heuristic).
     *
     * @return array{summary: array<string, mixed>, input_hash: string, prompt_version: string, source: string}
     */
    public function generate(Deal $deal): array
    {
        $input = $this->inputBuilder->build($deal);
        $inputHash = $this->inputBuilder->inputHash($deal);

        $systemPrompt = $this->promptLoader->loadDealSummaryPrompt();
        $summary = $this->agent->executeStructuredAgent(
            'deal_summary',
            $systemPrompt,
            $input,
        );
        $this->validator->validateDealSummary($summary);

        $summary['meta'] = array_merge($summary['meta'] ?? [], [
            'source' => 'ai',
            'generated_at' => $summary['meta']['generated_at'] ?? $input['now'],
        ]);

        return [
            'summary' => $summary,
            'input_hash' => $inputHash,
            'prompt_version' => self::PROMPT_VERSION,
            'source' => 'ai',
        ];
    }

    /**
     * Explicit heuristic path used only when no preferable AI summary exists.
     *
     * @return array{summary: array<string, mixed>, input_hash: string, prompt_version: string, source: string}
     */
    public function heuristicOnly(Deal $deal): array
    {
        $input = $this->inputBuilder->build($deal);
        $inputHash = $this->inputBuilder->inputHash($deal);
        $summary = $this->heuristicFallback($deal, $input);
        $this->validator->validateDealSummary($summary);

        return [
            'summary' => $summary,
            'input_hash' => $inputHash,
            'prompt_version' => self::PROMPT_VERSION,
            'source' => 'heuristic',
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function heuristicFallback(Deal $deal, array $input): array
    {
        $dealData = $input['deal'];
        $stageLabel = 'Unknown';
        $currentKey = $input['pipeline']['current_stage_key'] ?? null;
        foreach ($input['pipeline']['stages'] ?? [] as $stage) {
            if (($stage['key'] ?? null) === $currentKey) {
                $stageLabel = $stage['label'] ?? $stageLabel;
                break;
            }
        }

        $daysSinceUpdate = $deal->updated_at
            ? $deal->updated_at->diffInDays(now())
            : 0;

        $riskLevel = 'low';
        $statusLine = "Deal \"{$deal->name}\" is in {$stageLabel} with value {$dealData['currency']} "
            . number_format((float) $dealData['value'], 0) . '.';

        if ($daysSinceUpdate >= 14) {
            $riskLevel = 'high';
            $statusLine = "Deal \"{$deal->name}\" has had no recorded activity in {$daysSinceUpdate} days while sitting in {$stageLabel}.";
        } elseif ($daysSinceUpdate >= 7) {
            $riskLevel = 'medium';
            $statusLine = "Deal \"{$deal->name}\" may be stalling in {$stageLabel} — last update was {$daysSinceUpdate} days ago.";
        }

        $chips = [
            [
                'id' => 'momentum',
                'label' => 'Momentum',
                'value' => $riskLevel === 'low' ? 'On track' : 'Slowing',
                'tone' => $riskLevel === 'low' ? 'green' : ($riskLevel === 'high' ? 'red' : 'amber'),
                'sublabel' => "Last update {$daysSinceUpdate} day(s) ago",
            ],
        ];

        if (! empty($input['sections']['properties'])) {
            $chips[] = [
                'id' => 'property_fit',
                'label' => 'Property fit',
                'value' => 'Linked',
                'tone' => 'neutral',
                'sublabel' => count($input['sections']['properties']) . ' linked item(s)',
            ];
        }

        $actionType = $riskLevel === 'low' ? 'NO_ACTION_NEEDED' : 'CREATE_TASK';
        $actionLabel = $riskLevel === 'low'
            ? 'No action needed'
            : 'Review deal activity and schedule follow-up';

        return [
            'status_line' => $statusLine,
            'risk_level' => $riskLevel,
            'chips' => $chips,
            'bullets' => [
                'This is a heuristic summary generated while the AI service was unavailable.',
            ],
            'next_step' => [
                'action_type' => $actionType,
                'label' => $actionLabel,
                'rationale' => 'Based on deal recency and current stage.',
                'urgency' => $riskLevel === 'high' ? 'immediate' : 'this_week',
            ],
            'meta' => [
                'generated_at' => $input['now'],
                'data_confidence' => 'low',
                'stale_data_warning' => $daysSinceUpdate >= 14,
                'source' => 'heuristic',
            ],
        ];
    }
}
