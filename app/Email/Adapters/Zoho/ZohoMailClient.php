<?php

namespace App\Email\Adapters\Zoho;

use App\Email\Data\ConnectionContext;
use App\Email\Exceptions\MailTransportException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Zoho Mail REST client. Authorization is Zoho-oauthtoken from the connection,
 * never a calendar access token.
 */
class ZohoMailClient
{
    public function __construct(private readonly ZohoAccess $access) {}

    /**
     * Mailboxes visible to an access token that is not on a connection yet
     * (the OAuth callback, before the row exists).
     *
     * @return list<array{account_id: string, email: string}>
     *
     * @throws MailTransportException
     */
    public function mailboxes(string $accessToken): array
    {
        $payload = $this->decode($this->send($accessToken, 'get', $this->url('/api/accounts')));
        $rows = $payload['data'] ?? [];
        $mailboxes = [];

        foreach (is_array($rows) ? $rows : [] as $row) {
            if (! is_array($row)) {
                continue;
            }

            $accountId = $row['accountId'] ?? null;
            $email = $row['primaryEmailAddress'] ?? $row['mailboxAddress'] ?? $row['incomingUserName'] ?? null;

            if (! is_scalar($accountId) || ! is_string($email) || trim($email) === '') {
                continue;
            }

            $mailboxes[] = [
                'account_id' => (string) $accountId,
                'email' => strtolower(trim($email)),
            ];
        }

        return $mailboxes;
    }

    /**
     * @param  array<string, scalar>  $query
     * @return array<string, mixed>
     *
     * @throws MailTransportException
     */
    public function get(ConnectionContext $connection, string $path, array $query = []): array
    {
        return $this->decode($this->call($connection, 'get', $path, query: $query));
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     *
     * @throws MailTransportException
     */
    public function postJson(ConnectionContext $connection, string $path, array $body): array
    {
        return $this->decode($this->call($connection, 'post', $path, json: $body));
    }

    /**
     * Raw attachment bytes. Null when Zoho no longer has the part.
     *
     * @throws MailTransportException
     */
    public function getBytes(ConnectionContext $connection, string $path): ?string
    {
        $response = $this->call($connection, 'get', $path, jsonAccept: false);

        if ($response->status() === 404) {
            return null;
        }

        $this->ensureOk($response);

        $type = strtolower((string) $response->header('Content-Type'));

        if (str_contains($type, 'application/json') || str_contains($type, 'text/json')) {
            throw new MailTransportException('provider_error', retryable: true);
        }

        return $response->body();
    }

    /**
     * @return array<string, mixed> The uploaded attachment descriptor (storeName, attachmentPath, attachmentName).
     *
     * @throws MailTransportException
     */
    public function uploadAttachment(ConnectionContext $connection, string $filename, string $bytes, ?string $mime): array
    {
        $accountId = $this->accountId($connection);
        $token = $this->access->bearer($connection);

        try {
            $response = $this->http($token, false)
                ->attach('attach', $bytes, $filename, ['Content-Type' => $mime ?: 'application/octet-stream'])
                ->post($this->url('/api/accounts/'.rawurlencode($accountId).'/messages/attachments'));
        } catch (ConnectionException) {
            throw new MailTransportException('provider_unreachable', retryable: true);
        } catch (MailTransportException $exception) {
            throw $exception;
        } catch (Throwable) {
            throw new MailTransportException('provider_error', retryable: true);
        }

        if ($response->status() === 401) {
            $token = $this->access->refresh($connection);
            $response = $this->http($token, false)
                ->attach('attach', $bytes, $filename, ['Content-Type' => $mime ?: 'application/octet-stream'])
                ->post($this->url('/api/accounts/'.rawurlencode($accountId).'/messages/attachments'));
        }

        $payload = $this->decode($response);
        $data = $payload['data'] ?? null;

        if (is_array($data) && array_is_list($data)) {
            $data = $data[0] ?? null;
        }

        if (! is_array($data) || ! isset($data['storeName'], $data['attachmentPath'])) {
            throw new MailTransportException('attachment_unavailable', retryable: false);
        }

        return $data;
    }

    /**
     * @throws MailTransportException
     */
    private function call(
        ConnectionContext $connection,
        string $method,
        string $path,
        array $query = [],
        ?array $json = null,
        bool $jsonAccept = true,
    ): Response {
        $accountId = $this->accountId($connection);
        $absolute = $this->url('/api/accounts/'.rawurlencode($accountId).'/'.ltrim($path, '/'));

        $response = $this->send($this->access->bearer($connection), $method, $absolute, $query, $json, $jsonAccept);

        if ($response->status() !== 401) {
            return $response;
        }

        return $this->send($this->access->refresh($connection), $method, $absolute, $query, $json, $jsonAccept);
    }

    /**
     * @param  array<string, scalar>  $query
     * @param  array<string, mixed>|null  $json
     *
     * @throws MailTransportException
     */
    private function send(string $accessToken, string $method, string $url, array $query = [], ?array $json = null, bool $jsonAccept = true): Response
    {
        try {
            $pending = $this->http($accessToken, $jsonAccept);

            $response = match ($method) {
                'post' => $pending->post($url, $json ?? []),
                default => $pending->get($url, $query),
            };
        } catch (ConnectionException) {
            throw new MailTransportException('provider_unreachable', retryable: true);
        } catch (Throwable) {
            throw new MailTransportException('provider_error', retryable: true);
        }

        return $response;
    }

    private function http(string $accessToken, bool $json = true): PendingRequest
    {
        $pending = Http::withHeaders([
            'Authorization' => 'Zoho-oauthtoken '.$accessToken,
            'Accept' => $json ? 'application/json' : '*/*',
        ])->timeout(max(1, (int) config('email.zoho.timeout', 15)));

        return $json ? $pending->acceptJson() : $pending;
    }

    private function url(string $path): string
    {
        return rtrim((string) config('email.zoho.api_base_url', 'https://mail.zoho.eu'), '/').$path;
    }

    /**
     * @throws MailTransportException
     */
    private function accountId(ConnectionContext $connection): string
    {
        $accountId = $connection->credential('account_id');

        if (! is_scalar($accountId) || (string) $accountId === '') {
            throw new MailTransportException('missing_account_id', retryable: false);
        }

        return (string) $accountId;
    }

    /**
     * @return array<string, mixed>
     *
     * @throws MailTransportException
     */
    private function decode(Response $response): array
    {
        if ($response->status() === 404) {
            return ['data' => null, 'missing' => true];
        }

        $this->ensureOk($response);

        $data = $response->json();

        if (! is_array($data)) {
            throw new MailTransportException('provider_error', retryable: true);
        }

        return $data;
    }

    /**
     * @throws MailTransportException
     */
    private function ensureOk(Response $response): void
    {
        $payload = $response->json();
        $code = is_array($payload) && is_numeric($payload['status']['code'] ?? null)
            ? (int) $payload['status']['code']
            : $response->status();

        if ($response->successful() && $code < 400) {
            return;
        }

        throw match (true) {
            in_array($code, [401, 403], true) => new MailTransportException('unauthorized', retryable: false),
            $code === 404 => new MailTransportException('mailbox_not_found', retryable: false),
            $code === 429 => new MailTransportException('rate_limited', retryable: true),
            $code >= 500 => new MailTransportException('provider_error', retryable: true),
            default => new MailTransportException('rejected_by_provider', retryable: false),
        };
    }
}
