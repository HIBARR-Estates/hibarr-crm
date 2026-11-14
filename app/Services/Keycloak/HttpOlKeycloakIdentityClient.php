<?php

namespace App\Services\Keycloak;

use App\Contracts\KeycloakIdentityClient;
use App\Exceptions\OlKeycloakException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HttpOlKeycloakIdentityClient implements KeycloakIdentityClient
{
    public function provision(
        string $email,
        string $firstName,
        string $lastName,
        bool $sendSetupEmail = true,
    ): KeycloakProvisionResult {
        $response = $this->request('POST', $this->path('provision'), [
            'email' => strtolower(trim($email)),
            'firstName' => $firstName,
            'lastName' => $lastName,
            'sendSetupEmail' => $sendSetupEmail,
        ]);

        $payload = $this->payload($response);
        $id = $payload['keycloakUserId'] ?? $payload['keycloak_user_id'] ?? null;

        if (! is_string($id) || $id === '') {
            throw new OlKeycloakException('OL Keycloak provision did not return a user id.');
        }

        return new KeycloakProvisionResult($id, (bool) ($payload['created'] ?? false));
    }

    public function sendActionsEmail(
        string $keycloakUserId,
        array $actions = ['UPDATE_PASSWORD'],
    ): void {
        $this->request(
            'POST',
            $this->path('actions_email', $keycloakUserId),
            ['actions' => $actions],
        );
    }

    public function update(string $keycloakUserId, array $patch): void
    {
        $this->request('PATCH', $this->path('update', $keycloakUserId), $patch);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function request(string $method, string $path, array $payload): Response
    {
        $baseUrl = (string) config('services.ol.base_url', '');
        $apiKey = (string) config('services.ol.api_key', '');
        $timeout = (int) config('services.ol.timeout', 15);

        if ($baseUrl === '' || $apiKey === '' || $path === '') {
            Log::error('HttpOlKeycloakIdentityClient: OL config missing', [
                'base_url_set' => $baseUrl !== '',
                'api_key_set' => $apiKey !== '',
                'path_set' => $path !== '',
            ]);

            throw new OlKeycloakException('Keycloak identity service is not configured.', 503);
        }

        $url = rtrim($baseUrl, '/').'/'.ltrim($path, '/');
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
                'PATCH' => $pending->patch($url, $payload),
                default => throw new \InvalidArgumentException("Unsupported HTTP method: {$method}"),
            };
        } catch (OlKeycloakException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('HttpOlKeycloakIdentityClient: OL request failed', [
                'method' => $method,
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            throw new OlKeycloakException('Unable to reach Keycloak identity service.', 502, $e);
        }

        if ($response->successful()) {
            return $response;
        }

        if ($response->status() === 409) {
            $id = $this->payload($response)['keycloakUserId']
                ?? $this->payload($response)['keycloak_user_id']
                ?? null;
            if (is_string($id) && $id !== '') {
                return $response;
            }
        }

        Log::error('HttpOlKeycloakIdentityClient: OL returned non-2xx', [
            'method' => $method,
            'url' => $url,
            'status' => $response->status(),
        ]);

        $status = $response->status() >= 400 && $response->status() < 600 ? $response->status() : 502;
        $message = $response->json('message') ?? 'Keycloak identity service request failed.';

        throw new OlKeycloakException(is_string($message) ? $message : 'Keycloak identity service request failed.', $status);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Response $response): array
    {
        $json = $response->json();
        if (! is_array($json)) {
            return [];
        }

        return is_array($json['data'] ?? null) ? $json['data'] : $json;
    }

    private function path(string $key, ?string $keycloakUserId = null): string
    {
        $template = (string) config('services.ol.keycloak.paths.'.$key, '');
        if ($keycloakUserId !== null) {
            $template = str_replace('{keycloakUserId}', rawurlencode($keycloakUserId), $template);
        }

        return $template;
    }
}
