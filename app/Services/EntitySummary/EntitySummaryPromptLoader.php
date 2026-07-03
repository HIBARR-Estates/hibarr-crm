<?php

namespace App\Services\EntitySummary;

class EntitySummaryPromptLoader
{
    public function loadLeadSummaryPrompt(): string
    {
        return $this->extractSystemPromptFromMarkdown(
            base_path('lead-summary-agent-prompt.md')
        );
    }

    public function loadDealSummaryPrompt(): string
    {
        return $this->extractSystemPromptFromMarkdown(
            base_path('deal-summary-agent-prompt.md')
        );
    }

    private function extractSystemPromptFromMarkdown(string $path): string
    {
        if (! is_file($path)) {
            throw new \RuntimeException("Summary prompt file not found: {$path}");
        }

        $content = file_get_contents($path);

        if (! is_string($content)) {
            throw new \RuntimeException("Unable to read summary prompt file: {$path}");
        }

        if (preg_match('/## System Prompt\s+```\s*(.*?)```/s', $content, $matches)) {
            return trim($matches[1]);
        }

        throw new \RuntimeException("System prompt block not found in: {$path}");
    }
}
