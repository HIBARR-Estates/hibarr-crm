<?php

namespace App\Email\Data;

use SensitiveParameter;

final class AttachmentContent
{
    public function __construct(
        public readonly string $filename,
        public readonly ?string $mimeType,
        #[SensitiveParameter]
        public readonly string $bytes,
    ) {}

    public function sizeBytes(): int
    {
        return strlen($this->bytes);
    }

    /**
     * @return array<string, mixed>
     */
    public function __debugInfo(): array
    {
        return [
            'filename' => $this->filename,
            'mimeType' => $this->mimeType,
            'sizeBytes' => $this->sizeBytes(),
        ];
    }
}
