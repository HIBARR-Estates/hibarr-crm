<?php

namespace App\Services;

use App\Models\Deal;
use App\Services\OlWebhook\OlPayloadMapper;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

class OlDealPaymentProxyService
{
    public function __construct(
        private readonly OlPayloadMapper $payloadMapper,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function createForDeal(Deal $deal, array $input): array
    {
        $deal->loadMissing('leadStage', 'leadAgent.user');

        $payload = [
            'deal_id' => $deal->id,
            'amount' => round((float) $input['amount'], 2),
            'currency' => strtoupper((string) $input['currency']),
            // OL's shadow copy of the deal is created by an async webhook that may not
            // have landed yet; the snapshot (same shape as the webhook entityData) lets OL
            // create it synchronously instead of failing with "deal not found".
            'deal' => $this->payloadMapper->mapDealEntityData($deal) + [
                'occurredAt' => ($deal->updated_at ?? now())->toIso8601String(),
            ],
        ];

        // Omit provider_key unless explicitly set so OL checkout can let the client choose.
        if (!empty($input['provider_key'])) {
            $payload['provider_key'] = (string) $input['provider_key'];
        }

        $response = $this->request('POST', $this->dealPaymentRequestPath(), $payload);

        return $this->decodeSuccessfulResponse($response, 'create deal payment request');
    }

    /**
     * @return array<string, mixed>
     */
    public function getFromOl(string $paymentId): array
    {
        $path = rtrim($this->dealPaymentRequestPath(), '/') . '/' . rawurlencode($paymentId);
        $response = $this->request('GET', $path, []);

        return $this->decodeSuccessfulResponse($response, 'fetch deal payment request');
    }

    /**
     * Cancels a still-pending payment request so its checkout link stops
     * accepting payment. OL answers 409 once the client has already started
     * paying (proof uploaded / crypto in flight) — that surfaces as an
     * HttpException with the same status.
     *
     * @param  array<string, mixed>  $meta  reason / cancelled_by
     * @return array<string, mixed>
     */
    public function cancel(string $paymentId, array $meta): array
    {
        $path = rtrim($this->dealPaymentRequestPath(), '/') . '/' . rawurlencode($paymentId) . '/cancel';
        $response = $this->request('POST', $path, $meta);

        return $this->decodeSuccessfulResponse($response, 'cancel deal payment request');
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function request(string $method, string $path, array $payload): Response
    {
        $baseUrl = (string) config('services.ol.base_url', '');
        $apiKey = (string) config('services.ol.crm_webhook_api_key', '');
        $timeout = (int) config('services.ol.timeout', 15);

        if ($baseUrl === '' || $apiKey === '') {
            Log::error('OlDealPaymentProxyService: OL webhook config missing', [
                'base_url_set' => $baseUrl !== '',
                'api_key_set' => $apiKey !== '',
            ]);

            throw new HttpException(503, 'Payment service is not configured.');
        }

        $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/');
        $method = strtoupper($method);

        try {
            $pending = Http::timeout($timeout)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'X-Api-Key' => $apiKey,
                    'Accept' => 'application/json',
                ]);

            $response = match ($method) {
                'GET' => $pending->get($url),
                'POST' => $pending->post($url, $payload),
                default => throw new \InvalidArgumentException("Unsupported HTTP method: {$method}"),
            };
        } catch (\Throwable $e) {
            Log::error('OlDealPaymentProxyService: OL request failed', [
                'method' => $method,
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            throw new HttpException(502, 'Unable to reach payment service.');
        }

        if (!$response->successful()) {
            Log::error('OlDealPaymentProxyService: OL returned non-2xx', [
                'method' => $method,
                'url' => $url,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new HttpException(
                $response->status() >= 400 && $response->status() < 600 ? $response->status() : 502,
                $response->json('message') ?? 'Payment service request failed.'
            );
        }

        return $response;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeSuccessfulResponse(Response $response, string $action): array
    {
        $json = $response->json();
        $data = is_array($json) ? ($json['data'] ?? $json) : null;

        if (!is_array($data)) {
            throw new HttpException(502, "Invalid payment service response while trying to {$action}.");
        }

        return $data;
    }

    private function dealPaymentRequestPath(): string
    {
        return (string) config(
            'services.ol.deal_payment_request_path',
            '/internal/payments/deal-requests'
        );
    }
}
