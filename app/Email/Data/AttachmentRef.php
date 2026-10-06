<?php

namespace App\Email\Data;

/**
 * An attachment as listed on a message: metadata only. Bytes are fetched
 * separately through MailTransport::getAttachment().
 */
final class AttachmentRef
{
    /**
     * @param  string  $partId  Provider's id for this part within the message.
     */
    public function __construct(
        public readonly string $partId,
        public readonly string $filename,
        public readonly ?string $mimeType = null,
        public readonly ?int $sizeBytes = null,
        public readonly ?string $contentId = null,
        public readonly bool $inline = false,
    ) {}
}
