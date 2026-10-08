<?php

namespace App\Email\Contracts;

use App\Email\Data\AttachmentContent;
use App\Email\Data\Checkpoint;
use App\Email\Data\ConnectionContext;
use App\Email\Data\ConnectionHealth;
use App\Email\Data\Draft;
use App\Email\Data\FetchPage;
use App\Email\Data\NormalizedMessage;
use App\Email\Data\SendResult;
use App\Email\Exceptions\MailTransportException;

/**
 * The only door between the CRM and a mail provider. Adapters (fake, Mailtrap,
 * Zoho) implement this and nothing else; callers never see provider SDKs.
 *
 * Adapters report what the provider said. The send-state machine, matching,
 * linking and persistence all live in the CRM.
 */
interface MailTransport
{
    /**
     * Reachable / needs reconnect / quota backoff. Never throws: an
     * unreachable or misconfigured provider is a health state, not an error.
     */
    public function health(ConnectionContext $connection): ConnectionHealth;

    /**
     * Submit a draft. Provider acceptance is "accepted", never "delivered".
     * Rejections, throttling and unknown outcomes (e.g. a timeout) come back
     * as a SendResult rather than an exception so the caller can reconcile
     * the same attempt.
     */
    public function send(ConnectionContext $connection, Draft $draft): SendResult;

    /**
     * Normalized messages newer than the checkpoint, plus the checkpoint to
     * persist once they are ingested.
     *
     * @param  list<string>  $folders  Provider folder/label names to read.
     *
     * @throws MailTransportException
     */
    public function fetchSince(ConnectionContext $connection, Checkpoint $checkpoint, array $folders): FetchPage;

    /**
     * Full payload for a message whose list entry was partial. Null when the
     * provider no longer has it.
     *
     * @throws MailTransportException
     */
    public function getMessage(ConnectionContext $connection, string $providerMessageId): ?NormalizedMessage;

    /**
     * Attachment bytes for scan/store. Null when the provider no longer has it.
     *
     * @throws MailTransportException
     */
    public function getAttachment(ConnectionContext $connection, string $providerMessageId, string $partId): ?AttachmentContent;
}
