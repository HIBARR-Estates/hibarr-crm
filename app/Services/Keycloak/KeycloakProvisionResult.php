<?php

namespace App\Services\Keycloak;

final class KeycloakProvisionResult
{
    public function __construct(
        public readonly string $keycloakUserId,
        public readonly bool $created,
    ) {
    }
}
