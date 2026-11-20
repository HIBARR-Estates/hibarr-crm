<?php

namespace App\Contracts;

use App\Services\Keycloak\KeycloakProvisionResult;

/**
 * OL-backed Keycloak admin operations. CRM never talks to Keycloak Admin API itself.
 */
interface KeycloakIdentityClient
{
    /**
     * Create or find a Keycloak user by email and optionally send the setup-actions email.
     * Idempotent: the same email returns the same id, with created=false on a subsequent call.
     */
    public function provision(
        string $email,
        string $firstName,
        string $lastName,
        bool $sendSetupEmail = true,
    ): KeycloakProvisionResult;

    /**
     * Re-trigger Keycloak execute-actions-email (enrolment / set password).
     *
     * @param  list<string>  $actions
     */
    public function sendActionsEmail(
        string $keycloakUserId,
        array $actions = ['UPDATE_PASSWORD'],
    ): void;

    /**
     * Lifecycle patch: enabled, email, firstName, lastName.
     *
     * @param  array<string, mixed>  $patch
     */
    public function update(string $keycloakUserId, array $patch): void;
}
