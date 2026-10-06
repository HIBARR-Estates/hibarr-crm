<?php

namespace App\Email\Ingest;

use App\Email\Data\AttachmentRef;
use App\Email\Data\EmailAddress;
use App\Email\Data\NormalizedMessage;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use Illuminate\Support\Facades\DB;

/**
 * Stores a provider message as this mailbox's copy of a canonical message.
 * Safe to run any number of times for the same provider message.
 *
 * Every query here names its company explicitly: sync runs in jobs, where no
 * logged-in user is present to scope by.
 */
class MessageIngestor
{
    public function ingestNormalized(EmailConnection $connection, NormalizedMessage $normalized): EmailMailboxCopy
    {
        return DB::transaction(function () use ($connection, $normalized) {
            $copy = $this->findCopy($connection, $normalized->providerMessageId);

            if ($copy !== null) {
                $this->completeMessage($copy->message, $normalized);
                $this->refreshCopy($copy, $normalized);

                return $copy;
            }

            $message = $this->findOrCreateMessage($connection, $normalized);

            $copy = EmailMailboxCopy::withoutGlobalScopes()->createOrFirst(
                [
                    'connection_id' => $connection->id,
                    'provider_message_id' => $normalized->providerMessageId,
                ],
                [
                    'company_id' => $connection->company_id,
                    'message_id' => $message->id,
                    'folder' => $normalized->folder,
                    'direction' => $normalized->direction,
                    'bcc_recipients' => $this->addresses($normalized->bcc) ?: null,
                    'provider_attachments' => $this->attachments($normalized) ?: null,
                ],
            );

            return $copy->setRelation('message', $message);
        });
    }

    private function findCopy(EmailConnection $connection, string $providerMessageId): ?EmailMailboxCopy
    {
        return EmailMailboxCopy::withoutGlobalScopes()
            ->with('message')
            ->where('connection_id', $connection->id)
            ->where('provider_message_id', $providerMessageId)
            ->first();
    }

    /**
     * Messages are shared across a company's mailboxes by RFC Message-ID.
     * Without one there is nothing reliable to match on, so the message
     * belongs to this copy alone.
     */
    private function findOrCreateMessage(EmailConnection $connection, NormalizedMessage $normalized): EmailMessage
    {
        $attributes = $this->messageAttributes($normalized);

        if ($normalized->rfcMessageId === null) {
            return EmailMessage::withoutGlobalScopes()->create(['company_id' => $connection->company_id] + $attributes);
        }

        // createOrFirst leans on the unique index, so two mailboxes syncing
        // the same email at once still end up on one row.
        $message = EmailMessage::withoutGlobalScopes()->createOrFirst(
            [
                'company_id' => $connection->company_id,
                'rfc_message_id_hash' => EmailMessage::hashRfcMessageId($normalized->rfcMessageId),
            ],
            $attributes,
        );

        if (! $message->wasRecentlyCreated) {
            $this->completeMessage($message, $normalized);
        }

        return $message;
    }

    /**
     * The first copy to arrive defines the canonical message. Later copies
     * only fill in what is still missing (a thin list payload, a provider
     * that omitted a header) — they never overwrite stored content.
     */
    private function completeMessage(EmailMessage $message, NormalizedMessage $normalized): void
    {
        if ($normalized->partial && ! $message->is_partial) {
            return;
        }

        $attributes = $this->messageAttributes($normalized);

        // A message stored without a Message-ID may learn it later, but not
        // if that id already belongs to another canonical message.
        if ($message->rfc_message_id === null && $normalized->rfcMessageId !== null && $this->rfcIdTaken($message, $normalized->rfcMessageId)) {
            unset($attributes['rfc_message_id'], $attributes['rfc_message_id_hash']);
        }

        foreach ($attributes as $attribute => $value) {
            $current = $message->getAttribute($attribute);

            if (($current === null || $current === '' || $current === []) && $value !== null && $value !== []) {
                $message->setAttribute($attribute, $value);
            }
        }

        $message->has_attachments = $message->has_attachments || $normalized->hasAttachments();
        $message->is_partial = $message->is_partial && $normalized->partial;

        if ($message->isDirty()) {
            $message->save();
        }
    }

    private function rfcIdTaken(EmailMessage $message, string $rfcMessageId): bool
    {
        return EmailMessage::withoutGlobalScopes()
            ->where('company_id', $message->company_id)
            ->where('rfc_message_id_hash', EmailMessage::hashRfcMessageId($rfcMessageId))
            ->whereKeyNot($message->id)
            ->exists();
    }

    /** A message moved at the provider keeps its copy; only where it sits changes. */
    private function refreshCopy(EmailMailboxCopy $copy, NormalizedMessage $normalized): void
    {
        if ($normalized->folder !== null) {
            $copy->folder = $normalized->folder;
        }

        if ($copy->provider_attachments === null && $normalized->hasAttachments()) {
            $copy->provider_attachments = $this->attachments($normalized);
        }

        if ($copy->isDirty()) {
            $copy->save();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function messageAttributes(NormalizedMessage $normalized): array
    {
        return [
            'rfc_message_id' => $normalized->rfcMessageId,
            'rfc_message_id_hash' => EmailMessage::hashRfcMessageId($normalized->rfcMessageId),
            'in_reply_to' => $normalized->inReplyTo,
            'reference_ids' => $normalized->references,
            'thread_keys' => $normalized->threadKeys(),
            'from_email' => $normalized->from?->address,
            'from_name' => $normalized->from?->name,
            'to_recipients' => $this->addresses($normalized->to),
            'cc_recipients' => $this->addresses($normalized->cc),
            'reply_to_recipients' => $this->addresses($normalized->replyTo),
            'subject' => $normalized->subject,
            'sent_at' => $normalized->sentAt,
            'text_body' => $normalized->textBody,
            'html_raw' => $normalized->htmlRaw,
            'has_attachments' => $normalized->hasAttachments(),
            'is_partial' => $normalized->partial,
        ];
    }

    /**
     * @param  list<EmailAddress>  $addresses
     * @return list<array{address: string, name: string|null}>
     */
    private function addresses(array $addresses): array
    {
        return array_map(fn (EmailAddress $address): array => $address->toArray(), $addresses);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function attachments(NormalizedMessage $normalized): array
    {
        return array_map(fn (AttachmentRef $attachment): array => [
            'part_id' => $attachment->partId,
            'filename' => $attachment->filename,
            'mime_type' => $attachment->mimeType,
            'size_bytes' => $attachment->sizeBytes,
            'content_id' => $attachment->contentId,
            'inline' => $attachment->inline,
        ], $normalized->attachments);
    }
}
