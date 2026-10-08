<?php

namespace App\Email\Data;

use SensitiveParameter;

/**
 * What an adapter needs to act on one mailbox connection: a plain snapshot,
 * so adapters never touch the connection's database record.
 */
final class ConnectionContext
{
    /**
     * @param  string  $key  CRM identifier of the connection (never a provider id).
     * @param  string  $provider  fake | mailtrap | zoho
     * @param  array<string, mixed>  $credentials  Decrypted provider secrets.
     */
    public function __construct(
        public readonly string $key,
        public readonly string $provider,
        public readonly EmailAddress $identity,
        public readonly EmailAddress $from,
        public readonly ?EmailAddress $replyTo = null,
        #[SensitiveParameter]
        private readonly array $credentials = [],
    ) {}

    public function credential(string $name, mixed $default = null): mixed
    {
        return $this->credentials[$name] ?? $default;
    }

    public function hasCredential(string $name): bool
    {
        $value = $this->credentials[$name] ?? null;

        return $value !== null && $value !== '';
    }

    /**
     * Keeps secrets out of dumps, logs and exception traces.
     *
     * @return array<string, mixed>
     */
    public function __debugInfo(): array
    {
        return [
            'key' => $this->key,
            'provider' => $this->provider,
            'identity' => $this->identity->address,
            'from' => $this->from->address,
            'replyTo' => $this->replyTo?->address,
            'credentials' => '[redacted]',
        ];
    }
}
