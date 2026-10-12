<?php

namespace App\Email\Data;

use App\Email\Support\RfcMessageId;
use DateTimeImmutable;

/**
 * One provider message in the CRM's shape. Adapters normalize once, here;
 * nothing past the adapter edge reads provider payloads.
 *
 * Provider and RFC ids are metadata — the CRM assigns its own UUIDs.
 */
final class NormalizedMessage
{
    public readonly ?string $rfcMessageId;

    public readonly ?string $inReplyTo;

    /** @var list<string> */
    public readonly array $references;

    /** @var list<EmailAddress> */
    public readonly array $to;

    /** @var list<EmailAddress> */
    public readonly array $cc;

    /** @var list<EmailAddress> */
    public readonly array $bcc;

    /** @var list<EmailAddress> */
    public readonly array $replyTo;

    /** @var list<AttachmentRef> */
    public readonly array $attachments;

    /**
     * @param  string  $providerMessageId  Provider's id within this connection (Mailtrap id, IMAP UID, Zoho id).
     * @param  iterable<mixed>  $to
     * @param  iterable<mixed>  $cc
     * @param  iterable<mixed>  $replyTo
     * @param  DateTimeImmutable|null  $sentAt  Original Date header, not the time we fetched it.
     * @param  string|null  $htmlRaw  Unsanitized. Never render; the safe copy is produced in the CRM.
     * @param  iterable<AttachmentRef>  $attachments
     * @param  string|iterable<mixed>|null  $references
     * @param  iterable<mixed>  $bcc  Only when this mailbox knows it (its own sent mail).
     * @param  bool  $partial  True when the list payload was thin; call getMessage() for the rest.
     */
    public function __construct(
        public readonly string $providerMessageId,
        public readonly MessageDirection $direction,
        public readonly ?EmailAddress $from,
        iterable $to = [],
        iterable $cc = [],
        iterable $replyTo = [],
        public readonly ?DateTimeImmutable $sentAt = null,
        public readonly ?string $subject = null,
        public readonly ?string $textBody = null,
        public readonly ?string $htmlRaw = null,
        iterable $attachments = [],
        ?string $rfcMessageId = null,
        ?string $inReplyTo = null,
        string|iterable|null $references = null,
        public readonly ?string $folder = null,
        iterable $bcc = [],
        public readonly bool $partial = false,
    ) {
        $this->to = EmailAddress::listFrom($to);
        $this->cc = EmailAddress::listFrom($cc);
        $this->bcc = EmailAddress::listFrom($bcc);
        $this->replyTo = EmailAddress::listFrom($replyTo);
        $this->rfcMessageId = RfcMessageId::normalize($rfcMessageId);
        $this->inReplyTo = RfcMessageId::normalize($inReplyTo);
        $this->references = RfcMessageId::parseList($references);

        $refs = [];
        foreach ($attachments as $attachment) {
            if ($attachment instanceof AttachmentRef) {
                $refs[] = $attachment;
            }
        }
        $this->attachments = $refs;
    }

    public function hasAttachments(): bool
    {
        return $this->attachments !== [];
    }

    /**
     * Ids that tie this message to a thread: its own Message-ID, In-Reply-To
     * and References. Subject is deliberately not part of this.
     *
     * @return list<string>
     */
    public function threadKeys(): array
    {
        return array_values(array_unique(array_filter([
            $this->rfcMessageId,
            $this->inReplyTo,
            ...$this->references,
        ])));
    }

    /**
     * Everyone addressed on the message (To, Cc and any known Bcc).
     *
     * @return list<EmailAddress>
     */
    public function recipients(): array
    {
        return EmailAddress::listFrom([...$this->to, ...$this->cc, ...$this->bcc]);
    }

    /**
     * Bodies stay out of dumps and logs.
     *
     * @return array<string, mixed>
     */
    public function __debugInfo(): array
    {
        return [
            'providerMessageId' => $this->providerMessageId,
            'rfcMessageId' => $this->rfcMessageId,
            'direction' => $this->direction->value,
            'folder' => $this->folder,
            'sentAt' => $this->sentAt?->format(DATE_ATOM),
            'attachments' => count($this->attachments),
            'partial' => $this->partial,
        ];
    }
}
