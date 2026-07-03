<?php

namespace App\Services\AiSummary;

use App\Contracts\AiSummaryInterface;
use App\Contracts\EntitySummaryAgentInterface;
use Carbon\Carbon;

class MockAiSummaryService implements AiSummaryInterface, EntitySummaryAgentInterface
{
    public function summarize(string $notesText, string $context, string $startDate, string $endDate): string
    {
        if (empty(trim($notesText))) {
            return "No notes found for {$context} between {$startDate} and {$endDate}.";
        }

        $wordCount = str_word_count($notesText);

        return "AI Summary (Mock)\n\n"
            . "Context: {$context}\n"
            . "Period: {$startDate} to {$endDate}\n"
            . "Notes analyzed: {$wordCount} words across the selected period.\n\n"
            . "This is a placeholder summary. Connect an AI provider (e.g. OpenAI) to generate real insights from your sales notes.\n\n"
            . "To enable AI summaries, implement the AiSummaryInterface with your preferred LLM provider and update the binding in AppServiceProvider.";
    }

    /**
     * @param  array<string, mixed>  $inputPayload
     * @return array<string, mixed>
     */
    public function executeStructuredAgent(
        string $featureContext,
        string $systemPrompt,
        array $inputPayload,
        int $maxTokens = 2048,
    ): array {
        $now = $inputPayload['now'] ?? Carbon::now()->toIso8601String();

        if ($featureContext === 'deal_summary') {
            $deal = $inputPayload['deal'] ?? [];

            return [
                'deal_id' => (string) ($deal['deal_id'] ?? ''),
                'deal_name' => (string) ($deal['deal_name'] ?? 'Deal'),
                'value' => (float) ($deal['value'] ?? 0),
                'currency' => (string) ($deal['currency'] ?? 'USD'),
                'stage_label' => (string) ($deal['stage_label'] ?? 'Unknown'),
                'risk_level' => 'medium',
                'status_line' => 'Mock deal summary — connect AI provider for real analysis.',
                'next_step_label' => 'Review deal activity',
                'meta' => [
                    'generated_at' => $now,
                    'data_confidence' => 'low',
                ],
            ];
        }

        $lead = $inputPayload['lead'] ?? [];
        $deals = $inputPayload['sections']['deals'] ?? [];

        return [
            'status_line' => "Mock summary for {$lead['name']} — connect an AI provider for real insights.",
            'risk_level' => count($deals) > 0 ? 'medium' : 'low',
            'primary_risk_source' => count($deals) > 0 ? 'linked_deal' : 'lead',
            'chips' => [
                [
                    'id' => 'contactability',
                    'label' => 'Contactability',
                    'value' => 'Reachable',
                    'tone' => 'green',
                    'sublabel' => 'Mock chip',
                ],
            ],
            'bullets' => [
                'This is a placeholder AI lead summary.',
            ],
            'next_step' => [
                'action_type' => count($deals) === 1 ? 'OPEN_DEAL' : 'CONTACT_LEAD',
                'target_deal_id' => count($deals) === 1 ? (string) ($deals[0]['deal_id'] ?? null) : null,
                'label' => 'Contact lead',
                'rationale' => 'Mock next step for development.',
                'urgency' => 'this_week',
            ],
            'meta' => [
                'generated_at' => $now,
                'data_confidence' => 'low',
                'stale_data_warning' => false,
            ],
        ];
    }
}
