<?php

namespace App\Email\Data;

/**
 * Where a sync left off, per folder. Cursors are opaque strings owned by the
 * adapter (a message id, an IMAP UID, a timestamp); the CRM only stores them
 * and hands them back.
 */
final class Checkpoint
{
    /** @var array<string, string> */
    private readonly array $cursors;

    /**
     * @param  array<string, string>  $cursors  folder => cursor
     */
    public function __construct(array $cursors = [])
    {
        $clean = [];

        foreach ($cursors as $folder => $cursor) {
            if (is_scalar($cursor) && (string) $cursor !== '') {
                $clean[(string) $folder] = (string) $cursor;
            }
        }

        ksort($clean);
        $this->cursors = $clean;
    }

    public static function start(): self
    {
        return new self;
    }

    public function cursor(string $folder): ?string
    {
        return $this->cursors[$folder] ?? null;
    }

    public function with(string $folder, string $cursor): self
    {
        return new self([...$this->cursors, $folder => $cursor]);
    }

    public function isStart(): bool
    {
        return $this->cursors === [];
    }

    public function equals(self $other): bool
    {
        return $this->cursors === $other->cursors;
    }

    /**
     * @return array<string, string>
     */
    public function toArray(): array
    {
        return $this->cursors;
    }

    /**
     * @param  array<string, mixed>|null  $data
     */
    public static function fromArray(?array $data): self
    {
        return new self($data ?? []);
    }
}
