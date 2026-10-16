<?php

namespace App\Email\Adapters\Zoho;

/**
 * One OAuth token response. The refresh token is absent when Zoho only
 * renewed the access token.
 */
final class ZohoToken
{
    public function __construct(
        public readonly string $accessToken,
        public readonly ?string $refreshToken,
        public readonly int $expiresIn,
    ) {}
}
