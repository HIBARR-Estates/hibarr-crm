<?php

namespace App\Services\AiSummary;

use App\Contracts\AiSummaryInterface;

class MockAiSummaryService implements AiSummaryInterface
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
}
