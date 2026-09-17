<?php

namespace App\Jobs;

use App\Models\CrmEvent;
use App\Models\OlWebhookDelivery;
use App\Services\OlWebhook\OlDeliveryDecision;
use App\Services\OlWebhook\OlPayloadMapper;
use App\Services\OlWebhook\OlWebhookClient;
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

        if (! is_array($configured) || $configured === []) {
            return [60, 300, 900];
        }

        return array_map(static fn ($seconds) => (int) $seconds, $configured);
    }

    public function handle(
        OlPayloadMapper $payloadMapper,
        OlWebhookClient $client,
        OlDeliveryDecision $decision
    ): void {
        $event = CrmEvent::withoutGlobalScopes()->with(['eventType', 'model'])->find($this->crmEventId);

        if (! $event) {
            Log::warning('DispatchOlWebhookJob: CRM event not found', ['crm_event_id' => $this->crmEventId]);

            return;
        }

        $delivery = $this->loadDelivery($event);
        $delivery->attempts = $this->attempts();
        $delivery->last_attempted_at = now();
        $delivery->save();

        $payload = $payloadMapper->map($event);

        if ($payload === null) {
            Log::warning('DispatchOlWebhookJob: Unsupported event payload', [
                'crm_event_id' => $this->crmEventId,
                'event_type' => $event->eventType?->slug,
            ]);
            $delivery->update(['status' => OlWebhookDelivery::STATUS_REJECTED, 'last_error' => 'Unsupported event payload']);

            return;
        }

        $apiKey = (string) config('services.ol_webhook.api_key', '');
        if ($apiKey === '') {
            Log::error('DispatchOlWebhookJob: OL webhook API key missing', [
                'crm_event_id' => $this->crmEventId,
            ]);
            $delivery->update(['status' => OlWebhookDelivery::STATUS_REJECTED, 'last_error' => 'OL webhook API key missing']);

            return;
        }

        $apiKeyHeader = (string) config('services.ol_webhook.api_key_header', 'X-API-KEY');

        try {
            $response = $client->send($payload, $apiKey, $apiKeyHeader);
            $statusCode = $response->status();

            if ($decision->isSuccess($statusCode)) {
                Log::info('DispatchOlWebhookJob: webhook delivered', [
                    'crm_event_id' => $this->crmEventId,
                    'event_id' => $payload['eventId'] ?? null,
                    'status' => $statusCode,
                    'attempt' => $this->attempts(),
                ]);
                $delivery->update([
                    'status' => OlWebhookDelivery::STATUS_SENT,
                    'delivered_at' => now(),
                    'last_error' => null,
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

                $delivery->update([
                    'status' => OlWebhookDelivery::STATUS_FAILED,
                    'last_error' => "Retryable HTTP {$statusCode}",
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

            // Non-retryable: the job returns normally (no exception, no more
            // attempts), so this status is the only durable record that
            // delivery never actually succeeded.
            $delivery->update([
                'status' => OlWebhookDelivery::STATUS_REJECTED,
                'last_error' => "Non-retryable HTTP {$statusCode}: ".$response->body(),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('DispatchOlWebhookJob: exception while sending webhook', [
                'crm_event_id' => $this->crmEventId,
                'attempt' => $this->attempts(),
                'error' => $exception->getMessage(),
            ]);

            $delivery->update([
                'status' => OlWebhookDelivery::STATUS_FAILED,
                'last_error' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    /**
     * Load the tracking row created by CrmEventObserver, or create it
     * defensively if the job is being run/retried without one (e.g. a
     * manual queue:retry against an older, untracked job payload).
     */
    private function loadDelivery(CrmEvent $event): OlWebhookDelivery
    {
        return OlWebhookDelivery::firstOrCreate(
            ['crm_event_id' => $event->id],
            [
                'crm_event_uuid' => $event->uuid,
                'event_type_slug' => $event->eventType?->slug ?? '',
                'model_type' => $event->model_type,
                'model_id' => $event->model_id,
                'company_id' => $event->company_id,
            ]
        );
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('DispatchOlWebhookJob: webhook delivery exhausted retries', [
            'crm_event_id' => $this->crmEventId,
            'error' => $exception->getMessage(),
        ]);

        OlWebhookDelivery::where('crm_event_id', $this->crmEventId)->update([
            'status' => OlWebhookDelivery::STATUS_EXHAUSTED,
            'last_error' => $exception->getMessage(),
        ]);
    }
}
