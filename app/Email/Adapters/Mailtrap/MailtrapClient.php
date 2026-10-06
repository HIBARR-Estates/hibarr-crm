<?php

namespace App\Email\Adapters\Mailtrap;

use App\Email\Data\ConnectionContext;
use App\Email\Exceptions\MailTransportException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use SensitiveParameter;
use Throwable;

/**
 * Mailtrap Email Sandbox REST client for one inbox. Built from the account
 * settings in config('email.mailtrap') plus one connection's credentials.
 */
class MailtrapClient
{
    private function __construct(
        #[SensitiveParameter]
        private readonly string $apiToken,
        public readonly string $accountId,
        public readonly string $inboxId,
        private readonly string $baseUrl,
        private readonly int $timeout,
    ) {}

    /**
     * @param  array<string, mixed>  $config  config('email.mailtrap')
     *
     * @throws MailTransportException naming what is missing (never its value).
     */
    public static function forConnection(ConnectionContext $connection, array $config): self
    {
        $apiToken = self::filled($config['api_token'] ?? null)
            ?? throw new MailTransportException('missing_api_token', retryable: false);

        $accountId = self::filled($config['account_id'] ?? null)
            ?? throw new MailTransportException('missing_account_id', retryable: false);

        $inboxId = self::filled($connection->credential('inbox_id'))
            ?? self::filled($config['sandboxes'][(string) $connection->credential('sandbox', '')] ?? null)
            ?? throw new MailTransportException('missing_inbox_id', retryable: false);

        return new self(
            $apiToken,
            $accountId,
            $inboxId,
            rtrim((string) ($config['api_base_url'] ?? 'https://mailtrap.io'), '/'),
            max(1, (int) ($config['timeout'] ?? 10)),
        );
    }

    /**
     * GET a path under this inbox, e.g. "" for the inbox itself or "messages".
     *
     * @param  array<string, scalar>  $query
     *
     * @throws MailTransportException with a short code; the response body is never carried along.
     */
    public function get(string $path = '', array $query = []): Response
    {
        try {
            $response = $this->request()->get($this->inboxUrl($path), $query);
        } catch (ConnectionException) {
            throw new MailTransportException('provider_unreachable', retryable: true);
        } catch (Throwable) {
            throw new MailTransportException('provider_error', retryable: true);
        }

        return $response;
    }

    public function inboxUrl(string $path = ''): string
    {
        $url = "{$this->baseUrl}/api/accounts/{$this->accountId}/inboxes/{$this->inboxId}";

        return $path === '' ? $url : $url.'/'.ltrim($path, '/');
    }

    private function request(): PendingRequest
    {
        return Http::timeout($this->timeout)
            ->acceptJson()
            ->withHeaders(['Api-Token' => $this->apiToken]);
    }

    private static function filled(mixed $value): ?string
    {
        $value = is_scalar($value) ? trim((string) $value) : '';

        return $value === '' ? null : $value;
    }

    /**
     * Keeps the token out of dumps, logs and exception traces.
     *
     * @return array<string, mixed>
     */
    public function __debugInfo(): array
    {
        return [
            'accountId' => $this->accountId,
            'inboxId' => $this->inboxId,
            'baseUrl' => $this->baseUrl,
            'apiToken' => '[redacted]',
        ];
    }
}
