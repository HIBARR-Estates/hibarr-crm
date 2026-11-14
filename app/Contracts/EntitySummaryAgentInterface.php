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

    /**
     * Run a saved AI config (prompt, provider, model and token budget live on the
     * config row in the AI service, not here) and return its decoded JSON output.
     * Only the data goes over the wire, as the user prompt.
     *
     * @param  array<string, mixed>  $inputPayload
     * @return array<string, mixed>
     *
     * @throws \RuntimeException
     */
    public function executeAgentBySlug(string $slug, array $inputPayload): array;
}
