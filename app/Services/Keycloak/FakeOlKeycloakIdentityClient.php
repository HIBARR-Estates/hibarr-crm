<?php

namespace App\Services\Keycloak;

use App\Contracts\KeycloakIdentityClient;
use App\Exceptions\OlKeycloakException;
use Illuminate\Support\Str;

/**
 * In-memory Keycloak identity client for tests and local driver=fake.
 * Never used as a production success-stub: it does not talk to Keycloak.
 */
class FakeOlKeycloakIdentityClient implements KeycloakIdentityClient
{
    /** @var array<string, string> email => keycloakUserId */
    private array $users = [];

    /** @var list<array{keycloakUserId: string, actions: list<string>}> */
    public array $actionsEmails = [];

    /** @var list<array{keycloakUserId: string, patch: array<string, mixed>}> */
    public array $updates = [];

    private ?\Throwable $nextProvisionFailure = null;

    public function failNextProvision(\Throwable $e): void
    {
        $this->nextProvisionFailure = $e;
    }

    public function provision(
        string $email,
        string $firstName,
        string $lastName,
        bool $sendSetupEmail = true,
    ): KeycloakProvisionResult {
        if ($this->nextProvisionFailure) {
            $e = $this->nextProvisionFailure;
            $this->nextProvisionFailure = null;
            throw $e;
        }

        $normalized = strtolower(trim($email));
        $existing = $this->users[$normalized] ?? null;

        if ($existing) {
            if ($sendSetupEmail) {
                $this->sendActionsEmail($existing);
            }

            return new KeycloakProvisionResult($existing, false);
        }

        $id = (string) Str::uuid();
        $this->users[$normalized] = $id;

        if ($sendSetupEmail) {
            $this->sendActionsEmail($id);
        }

        return new KeycloakProvisionResult($id, true);
    }

    public function sendActionsEmail(
        string $keycloakUserId,
        array $actions = ['UPDATE_PASSWORD'],
    ): void {
        $this->actionsEmails[] = [
            'keycloakUserId' => $keycloakUserId,
            'actions' => $actions,
        ];
    }

    public function update(string $keycloakUserId, array $patch): void
    {
        $this->updates[] = [
            'keycloakUserId' => $keycloakUserId,
            'patch' => $patch,
        ];
    }

    public function idForEmail(string $email): ?string
    {
        return $this->users[strtolower(trim($email))] ?? null;
    }
}
