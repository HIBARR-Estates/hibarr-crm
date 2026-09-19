<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

class OlTelephonyProxyService
{
    /**
     * @param  array{phone_number: string, entity_type: string, entity_id: int, user_id: int}  $payload
     * @return array<string, mixed>
     */
    public function initiateCall(array $payload): array
    {
        $response = $this->request('POST', $this->telephonyCallsPath(), $payload);

        return $this->decodeSuccessfulResponse($response, 'initiate telephony call');
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function request(string $method, string $path, array $payload): Response
    {
        $baseUrl = (string) config('services.ol.base_url', '');
        $apiKey = (string) config('services.ol.api_key', '');
        $timeout = (int) config('services.ol.timeout', 15);

        if ($baseUrl === '' || $apiKey === '') {
            Log::error('OlTelephonyProxyService: OL config missing', [
                'base_url_set' => $baseUrl !== '',
                'api_key_set' => $apiKey !== '',
            ]);

            throw new HttpException(503, 'Telephony service is not configured.');
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
                'POST' => $pending->post($url, $payload),
                default => throw new \InvalidArgumentException("Unsupported HTTP method: {$method}"),
            };
        } catch (\Throwable $e) {
            Log::error('OlTelephonyProxyService: OL request failed', [
                'method' => $method,
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            throw new HttpException(502, 'Unable to reach telephony service.');
        }

        if (!$response->successful()) {
            Log::error('OlTelephonyProxyService: OL returned non-2xx', [
                'method' => $method,
                'url' => $url,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new HttpException(
                $response->status() >= 400 && $response->status() < 600 ? $response->status() : 502,
                $response->json('message') ?? 'Telephony service request failed.'
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

        if (!is_array($json)) {
            return ['message' => 'Call initiated.'];
        }

        $data = is_array($json['data'] ?? null) ? $json['data'] : [];
        $message = is_string($json['message'] ?? null) ? $json['message'] : 'Call initiated.';

        return array_merge($data, ['message' => $message]);
    }

    private function telephonyCallsPath(): string
    {
        return (string) config(
            'services.ol.telephony_calls_path',
            '/telephony/calls'
        );
    }
}
