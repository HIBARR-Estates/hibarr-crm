<?php

namespace App\Email\Data;

/**
 * An outbound attachment by reference: where the stored file lives, not its
 * bytes, so a draft stays small enough to persist alongside a send attempt.
 */
final class DraftAttachment
{
    public function __construct(
        public readonly string $storageKey,
        public readonly string $filename,
        public readonly ?string $mimeType = null,
        public readonly ?int $sizeBytes = null,
    ) {}

    /**
     * @return array{storage_key: string, filename: string, mime_type: string|null, size_bytes: int|null}
     */
    public function toArray(): array
    {
        return [
            'storage_key' => $this->storageKey,
            'filename' => $this->filename,
            'mime_type' => $this->mimeType,
            'size_bytes' => $this->sizeBytes,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            (string) ($data['storage_key'] ?? ''),
            (string) ($data['filename'] ?? ''),
            isset($data['mime_type']) ? (string) $data['mime_type'] : null,
            isset($data['size_bytes']) ? (int) $data['size_bytes'] : null,
        );
    }
}
