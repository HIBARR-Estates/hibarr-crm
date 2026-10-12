<?php

namespace App\Email\Adapters\Zoho;

use App\Email\Exceptions\MailTransportException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Zoho Accounts OAuth for Mail. Reads config('email.zoho') only — never
 * config/zoho.php and never an org-wide refresh token.
 */
class ZohoOAuth
{
    /**
     * @throws MailTransportException
     */
    public function authorizationUrl(string $state): string
    {
        $this->assertConfigured();

        $query = http_build_query([
            'scope' => (string) config('email.zoho.scopes'),
            'client_id' => $this->clientId(),
            'response_type' => 'code',
            'access_type' => 'offline',
            'redirect_uri' => $this->redirectUri(),
            'prompt' => 'consent',
            'state' => $state,
        ], '', '&', PHP_QUERY_RFC3986);

        return $this->accountsUrl().'/oauth/v2/auth?'.$query;
    }

    /**
     * @throws MailTransportException
     */
    public function exchange(string $code): ZohoToken
    {
        return $this->token([
            'grant_type' => 'authorization_code',
            'client_id' => $this->clientId(),
            'client_secret' => $this->clientSecret(),
            'redirect_uri' => $this->redirectUri(),
            'code' => $code,
        ], requireRefresh: true);
    }

    /**
     * @throws MailTransportException
     */
    public function refresh(string $refreshToken): ZohoToken
    {
        return $this->token([
            'grant_type' => 'refresh_token',
            'client_id' => $this->clientId(),
            'client_secret' => $this->clientSecret(),
            'refresh_token' => $refreshToken,
        ], requireRefresh: false);
    }

    /**
     * @throws MailTransportException
     */
    public function assertConfigured(): void
    {
        if ($this->clientId() === '' || $this->clientSecret() === '') {
            throw new MailTransportException('missing_oauth_client', retryable: false);
        }

        if ($this->redirectUri() === '') {
            throw new MailTransportException('missing_redirect_uri', retryable: false);
        }
    }

    /**
     * @param  array<string, string>  $form
     *
     * @throws MailTransportException
     */
    private function token(array $form, bool $requireRefresh): ZohoToken
    {
        $this->assertConfigured();

        try {
            $response = Http::asForm()
                ->timeout($this->timeout())
                ->acceptJson()
                ->post($this->accountsUrl().'/oauth/v2/token', $form);
        } catch (ConnectionException) {
            throw new MailTransportException('provider_unreachable', retryable: true);
        } catch (Throwable) {
            throw new MailTransportException('provider_error', retryable: true);
        }

        $data = $response->json();
        $access = is_array($data) ? ($data['access_token'] ?? null) : null;
        $refresh = is_array($data) ? ($data['refresh_token'] ?? null) : null;

        if (! is_string($access) || $access === '' || ($requireRefresh && (! is_string($refresh) || $refresh === ''))) {
            throw new MailTransportException('oauth_exchange_failed', retryable: false);
        }

        $expires = is_array($data) && is_numeric($data['expires_in'] ?? null)
            ? (int) $data['expires_in']
            : 3600;

        return new ZohoToken($access, is_string($refresh) && $refresh !== '' ? $refresh : null, max(1, $expires));
    }

    private function clientId(): string
    {
        return trim((string) config('email.zoho.client_id', ''));
    }

    private function clientSecret(): string
    {
        return trim((string) config('email.zoho.client_secret', ''));
    }

    private function redirectUri(): string
    {
        $configured = trim((string) config('email.zoho.redirect_uri', ''));

        return $configured !== '' ? $configured : route('email.connections.zoho.callback');
    }

    private function accountsUrl(): string
    {
        return rtrim((string) config('email.zoho.accounts_url', 'https://accounts.zoho.eu'), '/');
    }

    private function timeout(): int
    {
        return max(1, (int) config('email.zoho.timeout', 15));
    }
}
