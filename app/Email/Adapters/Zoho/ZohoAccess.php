<?php

namespace App\Email\Adapters\Zoho;

use App\Email\Data\ConnectionContext;
use App\Email\Exceptions\MailTransportException;

/**
 * Bearer token for one mailbox. Uses the connection's own refresh token and
 * remembers a token refreshed during this process so a stale snapshot still
 * sends with the new access token.
 */
class ZohoAccess
{
    /** @var array<string, string> */
    private array $fresh = [];

    public function __construct(
        private readonly ZohoOAuth $oauth,
        private readonly ZohoCredentialStore $store,
    ) {}

    /**
     * @throws MailTransportException
     */
    public function bearer(ConnectionContext $connection): string
    {
        if (isset($this->fresh[$connection->key])) {
            return $this->fresh[$connection->key];
        }

        if ($this->stillValid($connection)) {
            return (string) $connection->credential('access_token');
        }

        return $this->refresh($connection);
    }

    /**
     * @throws MailTransportException
     */
    public function refresh(ConnectionContext $connection): string
    {
        $refresh = $connection->credential('refresh_token');

        if (! is_string($refresh) || trim($refresh) === '') {
            throw new MailTransportException('missing_refresh_token', retryable: false);
        }

        $token = $this->oauth->refresh($refresh);
        $this->fresh[$connection->key] = $token->accessToken;
        $this->store->save($connection->key, $token);

        return $token->accessToken;
    }

    private function stillValid(ConnectionContext $connection): bool
    {
        $access = $connection->credential('access_token');
        $expires = $connection->credential('expires_at');

        return is_string($access) && $access !== ''
            && is_numeric($expires)
            && (int) $expires > time() + 60;
    }
}
