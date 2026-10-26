<?php

namespace App\Email\Adapters;

use App\Email\Contracts\MailTransport;
use App\Email\Data\AttachmentContent;
use App\Email\Data\AttachmentRef;
use App\Email\Data\Checkpoint;
use App\Email\Data\ConnectionContext;
use App\Email\Data\ConnectionHealth;
use App\Email\Data\Draft;
use App\Email\Data\EmailAddress;
use App\Email\Data\FetchPage;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\Data\SendResult;
use App\Email\Exceptions\MailTransportException;
use DateTimeImmutable;

/**
 * In-memory provider for tests and local development. No network, no disk:
 * each connection key owns its own mailbox, and the seed helpers below put it
 * in whatever state a test needs.
 */
class FakeMailAdapter implements MailTransport
{
    public const PROVIDER = 'fake';

    public const FOLDER_INBOX = 'INBOX';

    public const FOLDER_SENT = 'Sent';

    private int $pageSize = 50;

    private int $sequence = 0;

    /** @var array<string, array<string, array{sequence: int, message: NormalizedMessage}>> */
    private array $mailboxes = [];

    /** @var array<string, array<string, array<string, AttachmentContent>>> */
    private array $attachments = [];

    /** @var array<string, list<array{result: SendResult, stored: bool}>> */
    private array $sendScripts = [];

    /** @var array<string, list<Draft>> */
    private array $sendCalls = [];

    /** @var array<string, array<string, string>> rfc message id => provider submission id */
    private array $submissions = [];

    /** @var array<string, ConnectionHealth> */
    private array $health = [];

    /** @var array<string, MailTransportException> */
    private array $fetchFailures = [];

    // ---------------------------------------------------------------------
    // MailTransport
    // ---------------------------------------------------------------------

    public function health(ConnectionContext $connection): ConnectionHealth
    {
        return $this->health[$connection->key] ?? ConnectionHealth::ok();
    }

    public function send(ConnectionContext $connection, Draft $draft): SendResult
    {
        $key = $connection->key;
        $this->sendCalls[$key][] = $draft;

        // Resubmitting a message the provider already took returns the same
        // submission instead of sending it twice.
        $known = $draft->rfcMessageId !== null ? ($this->submissions[$key][$draft->rfcMessageId] ?? null) : null;
        if ($known !== null) {
            return SendResult::accepted($known);
        }

        $script = isset($this->sendScripts[$key]) ? array_shift($this->sendScripts[$key]) : null;

        if ($script === null) {
            return SendResult::accepted($this->storeSent($key, $draft));
        }

        if ($script['stored']) {
            $submissionId = $this->storeSent($key, $draft);

            return $script['result']->isAccepted() ? SendResult::accepted($submissionId) : $script['result'];
        }

        return $script['result'];
    }

    public function fetchSince(ConnectionContext $connection, Checkpoint $checkpoint, array $folders): FetchPage
    {
        $key = $connection->key;

        if (isset($this->fetchFailures[$key])) {
            throw $this->fetchFailures[$key];
        }

        $mailbox = $this->mailboxes[$key] ?? [];
        $folders = $folders !== [] ? array_values($folders) : $this->folders($key);

        $pending = [];
        foreach ($mailbox as $entry) {
            $folder = (string) $entry['message']->folder;

            if (in_array($folder, $folders, true) && $entry['sequence'] > (int) $checkpoint->cursor($folder)) {
                $pending[] = $entry;
            }
        }

        usort($pending, fn (array $a, array $b): int => $a['sequence'] <=> $b['sequence']);

        $page = array_slice($pending, 0, $this->pageSize);

        foreach ($page as $entry) {
            $checkpoint = $checkpoint->with((string) $entry['message']->folder, (string) $entry['sequence']);
        }

        return new FetchPage(
            array_map(fn (array $entry): NormalizedMessage => $entry['message'], $page),
            $checkpoint,
            count($pending) > count($page),
        );
    }

    public function getMessage(ConnectionContext $connection, string $providerMessageId): ?NormalizedMessage
    {
        return $this->mailboxes[$connection->key][$providerMessageId]['message'] ?? null;
    }

    public function getAttachment(ConnectionContext $connection, string $providerMessageId, string $partId): ?AttachmentContent
    {
        return $this->attachments[$connection->key][$providerMessageId][$partId] ?? null;
    }

    // ---------------------------------------------------------------------
    // Seeding mail
    // ---------------------------------------------------------------------

    /**
     * Put a received message in the connection's inbox.
     *
     * @param  array<string, mixed>  $attributes  from, to, cc, bcc, reply_to, subject, text, html, sent_at,
     *                                            rfc_message_id, in_reply_to, references, folder,
     *                                            provider_message_id, attachments
     *                                            (list of [filename, bytes, mime_type?, inline?, content_id?])
     */
    public function seedInbound(ConnectionContext|string $connection, array $attributes = []): NormalizedMessage
    {
        return $this->seed($connection, MessageDirection::Inbound, $attributes + [
            'from' => 'customer@example.test',
            'to' => $connection instanceof ConnectionContext ? [$connection->identity] : ['agent@example.test'],
            'folder' => self::FOLDER_INBOX,
        ]);
    }

    /**
     * Put a message the mailbox owner sent (from any mail client) in Sent.
     *
     * @param  array<string, mixed>  $attributes  See seedInbound().
     */
    public function seedOutbound(ConnectionContext|string $connection, array $attributes = []): NormalizedMessage
    {
        return $this->seed($connection, MessageDirection::Outbound, $attributes + [
            'from' => $connection instanceof ConnectionContext ? $connection->from : 'agent@example.test',
            'to' => ['customer@example.test'],
            'folder' => self::FOLDER_SENT,
        ]);
    }

    /**
     * One email received by several mailboxes: the same RFC Message-ID lands
     * in every connection, each with its own provider id.
     *
     * @param  list<ConnectionContext|string>  $connections
     * @param  array<string, mixed>  $attributes  See seedInbound().
     * @return array<string, NormalizedMessage> keyed by connection key
     */
    public function seedSameMessageOnConnections(array $connections, array $attributes = []): array
    {
        $attributes['rfc_message_id'] ??= $this->newRfcMessageId();
        $attributes['sent_at'] ??= new DateTimeImmutable;
        $attributes['to'] ??= array_map(
            fn (ConnectionContext|string $c) => $c instanceof ConnectionContext ? $c->identity : "{$c}@example.test",
            $connections,
        );
        unset($attributes['provider_message_id']);

        $seeded = [];
        foreach ($connections as $connection) {
            $seeded[$this->keyOf($connection)] = $this->seedInbound($connection, $attributes);
        }

        return $seeded;
    }

    // ---------------------------------------------------------------------
    // Scripting provider behaviour
    // ---------------------------------------------------------------------

    /** The next send is accepted. This is also what happens with nothing scripted. */
    public function acceptNextSend(ConnectionContext|string $connection): static
    {
        return $this->scriptSend($connection, SendResult::accepted(), stored: true);
    }

    public function rejectNextSend(ConnectionContext|string $connection, string $errorCode = 'rejected'): static
    {
        return $this->scriptSend($connection, SendResult::rejected($errorCode), stored: false);
    }

    /**
     * The next send times out, so the caller cannot tell what happened.
     *
     * @param  bool  $providerTookIt  True when the provider did take the message before the
     *                                connection dropped — it then shows up in Sent, and a retry
     *                                with the same Message-ID is acknowledged, not sent twice.
     */
    public function timeoutNextSend(ConnectionContext|string $connection, bool $providerTookIt = false): static
    {
        return $this->scriptSend($connection, SendResult::unknown('timeout'), stored: $providerTookIt);
    }

    public function throttleNextSend(ConnectionContext|string $connection, ?int $retryAfterSeconds = 60): static
    {
        return $this->scriptSend($connection, SendResult::throttled($retryAfterSeconds, 'throttled'), stored: false);
    }

    public function setHealth(ConnectionContext|string $connection, ConnectionHealth $health): static
    {
        $this->health[$this->keyOf($connection)] = $health;

        return $this;
    }

    /** Every fetchSince() for this connection throws until cleared with null. */
    public function failFetches(ConnectionContext|string $connection, ?MailTransportException $exception): static
    {
        $key = $this->keyOf($connection);

        if ($exception === null) {
            unset($this->fetchFailures[$key]);
        } else {
            $this->fetchFailures[$key] = $exception;
        }

        return $this;
    }

    public function setPageSize(int $pageSize): static
    {
        $this->pageSize = max(1, $pageSize);

        return $this;
    }

    // ---------------------------------------------------------------------
    // Inspecting
    // ---------------------------------------------------------------------

    /**
     * Every draft handed to send(), in order, whatever the outcome.
     *
     * @return list<Draft>
     */
    public function sendCalls(ConnectionContext|string $connection): array
    {
        return $this->sendCalls[$this->keyOf($connection)] ?? [];
    }

    /**
     * Everything currently in the mailbox, oldest first.
     *
     * @return list<NormalizedMessage>
     */
    public function messages(ConnectionContext|string $connection, ?string $folder = null): array
    {
        $entries = array_values($this->mailboxes[$this->keyOf($connection)] ?? []);
        usort($entries, fn (array $a, array $b): int => $a['sequence'] <=> $b['sequence']);

        $messages = array_map(fn (array $entry): NormalizedMessage => $entry['message'], $entries);

        if ($folder === null) {
            return $messages;
        }

        return array_values(array_filter($messages, fn (NormalizedMessage $m): bool => $m->folder === $folder));
    }

    /** Forget all mail, scripts and call history for one connection, or for all of them. */
    public function reset(ConnectionContext|string|null $connection = null): static
    {
        if ($connection === null) {
            $this->mailboxes = $this->attachments = $this->sendScripts = $this->sendCalls = [];
            $this->submissions = $this->health = $this->fetchFailures = [];

            return $this;
        }

        $key = $this->keyOf($connection);

        unset(
            $this->mailboxes[$key],
            $this->attachments[$key],
            $this->sendScripts[$key],
            $this->sendCalls[$key],
            $this->submissions[$key],
            $this->health[$key],
            $this->fetchFailures[$key],
        );

        return $this;
    }

    // ---------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function seed(ConnectionContext|string $connection, MessageDirection $direction, array $attributes): NormalizedMessage
    {
        $key = $this->keyOf($connection);
        $sequence = ++$this->sequence;
        $providerMessageId = (string) ($attributes['provider_message_id'] ?? "fake-{$sequence}");

        $refs = [];
        foreach (array_values($attributes['attachments'] ?? []) as $index => $file) {
            $partId = (string) ($file['part_id'] ?? 'part-'.($index + 1));
            $bytes = (string) ($file['bytes'] ?? '');
            $filename = (string) ($file['filename'] ?? "attachment-{$partId}");
            $mimeType = $file['mime_type'] ?? 'application/octet-stream';

            $refs[] = new AttachmentRef($partId, $filename, $mimeType, strlen($bytes), $file['content_id'] ?? null, (bool) ($file['inline'] ?? false));
            $this->attachments[$key][$providerMessageId][$partId] = new AttachmentContent($filename, $mimeType, $bytes);
        }

        $from = $attributes['from'] ?? null;
        $sentAt = $attributes['sent_at'] ?? new DateTimeImmutable;

        $message = new NormalizedMessage(
            providerMessageId: $providerMessageId,
            direction: $direction,
            from: $from instanceof EmailAddress ? $from : EmailAddress::tryParse($from),
            to: $attributes['to'] ?? [],
            cc: $attributes['cc'] ?? [],
            replyTo: $attributes['reply_to'] ?? [],
            sentAt: $sentAt instanceof DateTimeImmutable ? $sentAt : new DateTimeImmutable((string) $sentAt),
            subject: array_key_exists('subject', $attributes) ? $attributes['subject'] : 'Test message',
            textBody: array_key_exists('text', $attributes) ? $attributes['text'] : 'Test body',
            htmlRaw: $attributes['html'] ?? null,
            attachments: $refs,
            rfcMessageId: array_key_exists('rfc_message_id', $attributes) ? $attributes['rfc_message_id'] : $this->newRfcMessageId(),
            inReplyTo: $attributes['in_reply_to'] ?? null,
            references: $attributes['references'] ?? null,
            folder: $attributes['folder'] ?? self::FOLDER_INBOX,
            bcc: $attributes['bcc'] ?? [],
        );

        $this->mailboxes[$key][$providerMessageId] = ['sequence' => $sequence, 'message' => $message];

        return $message;
    }

    /** Record an accepted draft in Sent and return its submission id. */
    private function storeSent(string $key, Draft $draft): string
    {
        $rfcMessageId = $draft->rfcMessageId ?? $this->newRfcMessageId();

        $message = $this->seed($key, MessageDirection::Outbound, [
            'from' => $draft->from,
            'to' => $draft->to,
            'cc' => $draft->cc,
            'reply_to' => $draft->replyTo !== null ? [$draft->replyTo] : [],
            'subject' => $draft->subject,
            'text' => $draft->textBody,
            'html' => $draft->htmlBody,
            'rfc_message_id' => $rfcMessageId,
            'in_reply_to' => $draft->inReplyTo,
            'references' => $draft->references,
            'folder' => self::FOLDER_SENT,
        ]);

        $submissionId = "fake-submission-{$message->providerMessageId}";
        $this->submissions[$key][(string) $message->rfcMessageId] = $submissionId;

        return $submissionId;
    }

    private function scriptSend(ConnectionContext|string $connection, SendResult $result, bool $stored): static
    {
        $this->sendScripts[$this->keyOf($connection)][] = ['result' => $result, 'stored' => $stored];

        return $this;
    }

    /**
     * @return list<string>
     */
    private function folders(string $key): array
    {
        $folders = [];
        foreach ($this->mailboxes[$key] ?? [] as $entry) {
            $folders[(string) $entry['message']->folder] = true;
        }

        return array_keys($folders);
    }

    private function keyOf(ConnectionContext|string $connection): string
    {
        return $connection instanceof ConnectionContext ? $connection->key : $connection;
    }

    private function newRfcMessageId(): string
    {
        return '<'.bin2hex(random_bytes(8)).'@fake.mail.test>';
    }
}
