<?php

namespace App\Services\AiSummary;

use App\Contracts\AiSummaryInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HibarrAiSummaryService implements AiSummaryInterface
{
    private string $baseUrl;
    private int $timeout;
    private string $provider;
    private string $model;
    private ?string $apiKey;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.ai.base_url'), '/');
        $this->timeout = config('services.ai.timeout', 45);
        $this->provider = config('services.ai.provider', 'openai');
        $this->model = config('services.ai.model', 'gpt-4o');

        $apiKey = config('services.ai.api_key');
        $this->apiKey = is_string($apiKey) ? trim($apiKey) : null;
    }

    public function summarize(string $notesText, string $context, string $startDate, string $endDate): string
    {
        if (empty(trim($notesText))) {
            return "No notes found for {$context} between {$startDate} and {$endDate}.";
        }

        $systemPrompt = <<<PROMPT
You are an expert CRM analyst for a real-estate brokerage. You will receive a batch of sales notes written by agents.

Summarize the notes for "{$context}" covering the period {$startDate} to {$endDate}.

Your summary should:
1. Highlight key client interactions and deals discussed.
2. Identify recurring themes or objections raised by prospects.
3. Call out any follow-ups or action items that appear overdue or urgent.
4. Provide 2-3 actionable recommendations to improve conversion.

Keep the summary concise (under 500 words), professional, and written in the third person.
PROMPT;

        try {
            $request = Http::timeout($this->timeout);

            if (!empty($this->apiKey)) {
                $request = $request->withHeaders([
                    'x-api-key' => $this->apiKey,
                ]);
            }

            $response = $request
                ->post("{$this->baseUrl}/ai/execute", [
                    'featureContext' => 'report_summary',
                    'userId' => (string) auth()->id(),
                    'payload' => [
                        'messages' => [
                            ['role' => 'system', 'content' => $systemPrompt],
                            ['role' => 'user', 'content' => $notesText],
                        ],
                        'maxTokens' => 1024,
                    ],
                    'routingPreference' => [
                        'provider' => $this->provider,
                        'model' => $this->model,
                        'fallbackEnabled' => true,
                    ],
                ]);

            if ($response->failed()) {
                Log::error('AI Summary API error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return 'Unable to generate AI summary at this time. Please try again later.';
            }

            $data = $response->json();

            if (!($data['success'] ?? false) || empty($data['data']['completion'])) {
                Log::warning('AI Summary unexpected response', ['response' => $data]);

                return 'Unable to generate AI summary at this time. Please try again later.';
            }

            return $data['data']['completion'];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('AI Summary connection timeout', ['message' => $e->getMessage()]);

            return 'The AI summary request timed out. Please try again.';
        } catch (\Throwable $e) {
            Log::error('AI Summary unexpected error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return 'An unexpected error occurred while generating the AI summary. Please try again later.';
        }
    }
}
