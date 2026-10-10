<?php

namespace App\Email\Connections;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Adapters\Mailtrap\MailtrapAdapter;
use Illuminate\Validation\Rule;

/**
 * What a connection must supply for each provider. The validated fields are
 * exactly what gets stored, encrypted, as the connection's credentials.
 */
class CredentialRules
{
    /**
     * @return array<string, mixed>
     */
    public static function for(string $provider): array
    {
        return match ($provider) {
            MailtrapAdapter::PROVIDER => [
                'inbox_id' => ['required_without:sandbox', 'nullable', 'string', 'regex:/^\d+$/', 'max:32'],
                'sandbox' => ['nullable', 'string', Rule::in(self::mailtrapSandboxes())],
                'smtp_username' => ['required', 'string', 'max:255'],
                'smtp_password' => ['required', 'string', 'max:255'],
            ],
            FakeMailAdapter::PROVIDER => [],
            default => [],
        };
    }

    /**
     * Named local sandboxes that actually have an inbox configured.
     *
     * @return list<string>
     */
    private static function mailtrapSandboxes(): array
    {
        $sandboxes = array_filter(
            (array) config('email.mailtrap.sandboxes', []),
            fn ($inboxId) => $inboxId !== null && $inboxId !== '',
        );

        return array_map('strval', array_keys($sandboxes));
    }
}
