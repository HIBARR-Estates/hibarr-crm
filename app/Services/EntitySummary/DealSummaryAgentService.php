<?php

namespace App\Services\EntitySummary;

use App\Contracts\EntitySummaryAgentInterface;
use App\Models\Deal;
use Illuminate\Support\Facades\Log;

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
     * @return array{summary: array<string, mixed>, input_hash: string, prompt_version: string}
     */
    public function generate(Deal $deal): array
    {
        $input = $this->inputBuilder->build($deal);
        $inputHash = $this->inputBuilder->inputHash($deal);

        try {
            $systemPrompt = $this->promptLoader->loadDealSummaryPrompt();
            $summary = $this->agent->executeStructuredAgent(
                'deal_summary',
                $systemPrompt,
                $input,
            );
            $this->validator->validateDealSummary($summary);
        } catch (\Throwable $e) {
            Log::warning('DealSummaryAgentService: AI failed, using heuristic fallback', [
                'deal_id' => $deal->id,
                'message' => $e->getMessage(),
            ]);
            $summary = $this->heuristicFallback($deal, $input);
        }

        return [
            'summary' => $summary,
            'input_hash' => $inputHash,
            'prompt_version' => self::PROMPT_VERSION,
        ];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function heuristicFallback(Deal $deal, array $input): array
    {
        $dealData = $input['deal'];
        $daysSinceUpdate = $deal->updated_at
            ? $deal->updated_at->diffInDays(now())
            : 0;

        $riskLevel = 'low';
        $statusLine = "Deal \"{$deal->name}\" is in {$dealData['stage_label']} with value {$dealData['currency']} " . number_format((float) $dealData['value'], 0) . '.';

        if ($daysSinceUpdate >= 14) {
            $riskLevel = 'high';
            $statusLine = "Deal \"{$deal->name}\" has had no recorded activity in {$daysSinceUpdate} days while sitting in {$dealData['stage_label']}.";
        } elseif ($daysSinceUpdate >= 7) {
            $riskLevel = 'medium';
            $statusLine = "Deal \"{$deal->name}\" may be stalling in {$dealData['stage_label']} — last update was {$daysSinceUpdate} days ago.";
        }

        $nextStepLabel = $riskLevel === 'none' || $riskLevel === 'low'
            ? null
            : 'Review deal activity and schedule follow-up';

        return [
            'deal_id' => (string) $deal->id,
            'deal_name' => $deal->name,
            'value' => (float) ($deal->value ?? 0),
            'currency' => $dealData['currency'],
            'stage_label' => $dealData['stage_label'],
            'risk_level' => $riskLevel,
            'status_line' => $statusLine,
            'next_step_label' => $nextStepLabel,
            'meta' => [
                'generated_at' => $input['now'],
                'data_confidence' => 'low',
            ],
        ];
    }
}
