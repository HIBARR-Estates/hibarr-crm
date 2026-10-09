<?php

namespace App\Email\Adapters\Zoho;

use App\Email\Models\EmailConnection;

/**
 * Writes a refreshed access token back onto the connection that owns it.
 * The calendar org token is never stored here.
 */
class ZohoCredentialStore
{
    public function save(string $connectionUuid, ZohoToken $token): void
    {
        $connection = EmailConnection::withoutGlobalScopes()->where('uuid', $connectionUuid)->first();

        if ($connection === null) {
            return;
        }

        $credentials = $connection->credentials ?? [];
        $credentials['access_token'] = $token->accessToken;
        $credentials['expires_at'] = time() + $token->expiresIn;

        if ($token->refreshToken !== null) {
            $credentials['refresh_token'] = $token->refreshToken;
        }

        $connection->credentials = $credentials;
        $connection->save();
    }
}
