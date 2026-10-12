<?php

namespace App\Email\Data;

use App\Email\Support\RfcMessageId;

/**
 * An outbound message as composed in the CRM. Serializable, so the exact
 * payload can be kept with its send attempt and retried unchanged.
 *
 * No Bcc: the composer does not offer it.
 */
final class Draft
{
    /** @var list<EmailAddress> */
    public readonly array $to;

    /** @var list<EmailAddress> */
    public readonly array $cc;

    public readonly ?string $rfcMessageId;

    public readonly ?string $inReplyTo;

    /** @var list<string> */
    public readonly array $references;

    /** @var list<DraftAttachment> */
    public readonly array $attachments;

    /**
     * @param  iterable<mixed>  $to
     * @param  iterable<mixed>  $cc
     * @param  iterable<DraftAttachment>  $attachments
     * @param  string|null  $rfcMessageId  Assigned by the CRM so a retry resubmits the same message.
     * @param  string|iterable<mixed>|null  $references
     */
    public function __construct(
        public readonly EmailAddress $from,
        iterable $to = [],
        iterable $cc = [],
        public readonly ?EmailAddress $replyTo = null,
        public readonly string $subject = '',
        public readonly ?string $textBody = null,
        public readonly ?string $htmlBody = null,
        iterable $attachments = [],
        ?string $rfcMessageId = null,
        ?string $inReplyTo = null,
        string|iterable|null $references = null,
    ) {
        $this->to = EmailAddress::listFrom($to);
        $this->cc = EmailAddress::listFrom($cc);
        $this->rfcMessageId = RfcMessageId::normalize($rfcMessageId);
        $this->inReplyTo = RfcMessageId::normalize($inReplyTo);
        $this->references = RfcMessageId::parseList($references);

        $files = [];
        foreach ($attachments as $attachment) {
            if ($attachment instanceof DraftAttachment) {
                $files[] = $attachment;
            }
        }
        $this->attachments = $files;
    }

    /**
     * @return list<EmailAddress>
     */
    public function recipients(): array
    {
        return EmailAddress::listFrom([...$this->to, ...$this->cc]);
    }

    public function hasRecipients(): bool
    {
        return $this->to !== [];
    }

    public function isReply(): bool
    {
        return $this->inReplyTo !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $addresses = fn (array $list): array => array_map(fn (EmailAddress $a): array => $a->toArray(), $list);

        return [
            'from' => $this->from->toArray(),
            'to' => $addresses($this->to),
            'cc' => $addresses($this->cc),
            'reply_to' => $this->replyTo?->toArray(),
            'subject' => $this->subject,
            'text_body' => $this->textBody,
            'html_body' => $this->htmlBody,
            'attachments' => array_map(fn (DraftAttachment $a): array => $a->toArray(), $this->attachments),
            'rfc_message_id' => $this->rfcMessageId,
            'in_reply_to' => $this->inReplyTo,
            'references' => $this->references,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $addresses = fn (mixed $list): array => array_map(
            fn (array $a): EmailAddress => EmailAddress::fromArray($a),
            is_array($list) ? $list : [],
        );

        return new self(
            from: EmailAddress::fromArray($data['from'] ?? []),
            to: $addresses($data['to'] ?? []),
            cc: $addresses($data['cc'] ?? []),
            replyTo: isset($data['reply_to']) ? EmailAddress::fromArray($data['reply_to']) : null,
            subject: (string) ($data['subject'] ?? ''),
            textBody: $data['text_body'] ?? null,
            htmlBody: $data['html_body'] ?? null,
            attachments: array_map(
                fn (array $a): DraftAttachment => DraftAttachment::fromArray($a),
                is_array($data['attachments'] ?? null) ? $data['attachments'] : [],
            ),
            rfcMessageId: $data['rfc_message_id'] ?? null,
            inReplyTo: $data['in_reply_to'] ?? null,
            references: $data['references'] ?? null,
        );
    }

    /**
     * Bodies stay out of dumps and logs.
     *
     * @return array<string, mixed>
     */
    public function __debugInfo(): array
    {
        return [
            'rfcMessageId' => $this->rfcMessageId,
            'to' => count($this->to),
            'cc' => count($this->cc),
            'attachments' => count($this->attachments),
            'isReply' => $this->isReply(),
        ];
    }
}
