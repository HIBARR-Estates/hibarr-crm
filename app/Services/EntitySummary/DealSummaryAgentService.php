<?php

namespace App\Services\EntitySummary;

use App\Contracts\EntitySummaryAgentInterface;
use App\Models\Deal;

class DealSummaryAgentService
{
    private const PROMPT_VERSION = 'v3';

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
            // Always ISO for UI/DB — input `now` is human-readable for the model.
            'generated_at' => now()->toIso8601String(),
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

        $currency = $dealData['currency'] ?? null;
        $valuePhrase = $currency
            ? number_format((float) $dealData['value'], 0) . ' ' . $currency
            : number_format((float) $dealData['value'], 0);

        $riskLevel = 'low';
        $statusLine = "Your deal sits in {$stageLabel} at {$valuePhrase} — regenerate when AI is available for a fuller read.";

        if ($daysSinceUpdate >= 14) {
            $riskLevel = 'high';
            $statusLine = "You have had no recorded activity on this deal for {$daysSinceUpdate} days while it sits in {$stageLabel} — re-engage before it goes cold.";
        } elseif ($daysSinceUpdate >= 7) {
            $riskLevel = 'medium';
            $statusLine = "Your last update was {$daysSinceUpdate} days ago in {$stageLabel} — momentum may be slipping; schedule a concrete follow-up.";
        }

        $chips = [
            [
                'id' => 'momentum',
                'label' => 'Momentum',
                'value' => $riskLevel === 'low' ? 'Quiet' : 'Slowing',
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

        $staleWarning = $daysSinceUpdate >= 14;

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
                'generated_at' => now()->toIso8601String(),
                'data_confidence' => 'low',
                'stale_data_warning' => $staleWarning,
                'source' => 'heuristic',
            ],
        ];
    }
}
