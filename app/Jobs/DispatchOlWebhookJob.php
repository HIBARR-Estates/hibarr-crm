<?php

namespace App\Jobs;

use App\Models\CrmEvent;
use App\Services\OlWebhook\OlDeliveryDecision;
use App\Services\OlWebhook\OlPayloadMapper;
use App\Services\OlWebhook\OlWebhookClient;
use App\Services\OlWebhook\WebhookSignatureService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class DispatchOlWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;

    public int $timeout = 30;

    public function __construct(private readonly int $crmEventId)
    {
        $this->tries = (int) config('services.ol_webhook.tries', 3);
        $this->onQueue((string) config('services.ol_webhook.queue', 'ol_webhooks'));
    }

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        $configured = config('services.ol_webhook.backoff', [60, 300, 900]);

        if (!is_array($configured) || $configured === []) {
            return [60, 300, 900];
        }

        return array_map(static fn ($seconds) => (int) $seconds, $configured);
    }

    public function handle(
        OlPayloadMapper $payloadMapper,
        OlWebhookClient $client,
        WebhookSignatureService $signatureService,
        OlDeliveryDecision $decision
    ): void {
        $event = CrmEvent::withoutGlobalScopes()->with(['eventType', 'model'])->find($this->crmEventId);

        if (!$event) {
            Log::warning('DispatchOlWebhookJob: CRM event not found', ['crm_event_id' => $this->crmEventId]);
            return;
        }

        $payload = $payloadMapper->map($event);

        if ($payload === null) {
            Log::warning('DispatchOlWebhookJob: Unsupported event payload', [
                'crm_event_id' => $this->crmEventId,
                'event_type' => $event->eventType?->slug,
            ]);
            return;
        }

        $secret = (string) config('services.ol_webhook.secret', '');
        if ($secret === '') {
            Log::error('DispatchOlWebhookJob: OL webhook secret missing', [
                'crm_event_id' => $this->crmEventId,
            ]);
            return;
        }

        $timestamp = (string) now()->timestamp;
        $signature = $signatureService->sign(
            (string) json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            $timestamp,
            $secret
        );

        try {
            $response = $client->send($payload, $timestamp, $signature);
            $statusCode = $response->status();

            if ($decision->isSuccess($statusCode)) {
                Log::info('DispatchOlWebhookJob: webhook delivered', [
                    'crm_event_id' => $this->crmEventId,
                    'event_id' => $payload['eventId'] ?? null,
                    'status' => $statusCode,
                    'attempt' => $this->attempts(),
                ]);
                return;
            }

            if ($decision->isRetryableStatus($statusCode)) {
                Log::warning('DispatchOlWebhookJob: retryable webhook failure', [
                    'crm_event_id' => $this->crmEventId,
                    'event_id' => $payload['eventId'] ?? null,
                    'status' => $statusCode,
                    'attempt' => $this->attempts(),
                    'response' => $response->body(),
                ]);

                throw new \RuntimeException("Retryable OL webhook failure with status {$statusCode}");
            }

            Log::error('DispatchOlWebhookJob: non-retryable webhook failure', [
                'crm_event_id' => $this->crmEventId,
                'event_id' => $payload['eventId'] ?? null,
                'status' => $statusCode,
                'attempt' => $this->attempts(),
                'response' => $response->body(),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('DispatchOlWebhookJob: exception while sending webhook', [
                'crm_event_id' => $this->crmEventId,
                'attempt' => $this->attempts(),
                'error' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('DispatchOlWebhookJob: webhook delivery exhausted retries', [
            'crm_event_id' => $this->crmEventId,
            'error' => $exception->getMessage(),
        ]);
    }
}

