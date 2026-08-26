<?php

namespace App\Services;

use App\Models\Deal;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

class OlDealPaymentProxyService
{
    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function createForDeal(Deal $deal, array $input): array
    {
        $payload = [
            'deal_id' => $deal->id,
            'amount' => round((float) $input['amount'], 2),
            'currency' => strtoupper((string) $input['currency']),
            'provider_key' => (string) ($input['provider_key'] ?? 'manual-bank-transfer'),
        ];

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
