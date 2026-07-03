<?php

namespace App\Contracts;

interface EntitySummaryAgentInterface
{
    /**
     * Execute a structured JSON agent and return decoded output.
     *
     * @param  array<string, mixed>  $inputPayload
     * @return array<string, mixed>
     *
     * @throws \RuntimeException
     */
    public function executeStructuredAgent(
        string $featureContext,
        string $systemPrompt,
        array $inputPayload,
        int $maxTokens = 2048,
    ): array;
}
