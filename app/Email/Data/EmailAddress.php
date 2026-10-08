<?php

namespace App\Email\Data;

use InvalidArgumentException;

/**
 * One mailbox address. The address is lower-cased so it can be compared and
 * matched directly; the display name is kept as received.
 */
final class EmailAddress
{
    public readonly string $address;

    public readonly ?string $name;

    public function __construct(string $address, ?string $name = null)
    {
        $normalized = strtolower(trim($address));

        if (filter_var($normalized, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('Invalid email address.');
        }

        $name = $name !== null ? trim($name, " \t\r\n\"'") : null;

        $this->address = $normalized;
        $this->name = $name === '' ? null : $name;
    }

    /**
     * Accepts "user@example.com" or "Display Name <user@example.com>".
     * Null instead of an exception, for headers that arrive malformed.
     */
    public static function tryParse(?string $value): ?self
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        $name = null;
        $address = $value;

        if (preg_match('/^(.*)<([^<>]+)>\s*$/s', $value, $match) === 1) {
            $name = $match[1];
            $address = $match[2];
        }

        try {
            return new self($address, $name);
        } catch (InvalidArgumentException) {
            return null;
        }
    }

    /**
     * Unparseable entries are dropped; duplicates (by address) keep the first.
     *
     * @param  iterable<mixed>  $values  Strings or EmailAddress instances.
     * @return list<self>
     */
    public static function listFrom(iterable $values): array
    {
        $addresses = [];

        foreach ($values as $value) {
            $address = $value instanceof self ? $value : (is_string($value) ? self::tryParse($value) : null);

            if ($address !== null && ! isset($addresses[$address->address])) {
                $addresses[$address->address] = $address;
            }
        }

        return array_values($addresses);
    }

    public function equals(self $other): bool
    {
        return $this->address === $other->address;
    }

    public function domain(): string
    {
        return substr($this->address, (int) strrpos($this->address, '@') + 1);
    }

    /**
     * @return array{address: string, name: string|null}
     */
    public function toArray(): array
    {
        return ['address' => $this->address, 'name' => $this->name];
    }

    /**
     * @param  array{address: string, name?: string|null}  $data
     */
    public static function fromArray(array $data): self
    {
        return new self((string) ($data['address'] ?? ''), $data['name'] ?? null);
    }
}
