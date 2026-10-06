<?php

namespace App\Email\Adapters\Mailtrap;

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
use App\Email\Support\RfcHeaders;
use DateTimeImmutable;
use Illuminate\Http\Client\Response;
use Throwable;

/**
 * Mailtrap Email Sandbox, for dev and staging. Captured mail never reaches a
 * real recipient. One sandbox inbox stands in for one agent's mailbox.
 *
 * Sending is not implemented yet and says so rather than pretending.
 */
class MailtrapAdapter implements MailTransport
{
    public const PROVIDER = 'mailtrap';

    /** A sandbox inbox has no folders; everything it holds is checkpointed under this one name. */
    public const FOLDER = 'INBOX';

    /** Messages hydrated per fetchSince() call. Each one costs several API requests. */
    private const PAGE_SIZE = 25;

    /** Safety stop when walking the (newest-first) message list back to the checkpoint. */
    private const MAX_LIST_PAGES = 50;

    public function health(ConnectionContext $connection): ConnectionHealth
    {
        try {
            $response = $this->client($connection)->get();
        } catch (MailTransportException $exception) {
            return $exception->retryable
                ? ConnectionHealth::unreachable($exception->errorCode)
                : ConnectionHealth::needsReconnect($exception->errorCode);
        } catch (Throwable) {
            return ConnectionHealth::unreachable('provider_error');
        }

        return match (true) {
            $response->successful() => ConnectionHealth::ok(),
            in_array($response->status(), [401, 403], true) => ConnectionHealth::needsReconnect('unauthorized'),
            $response->status() === 404 => ConnectionHealth::needsReconnect('inbox_not_found'),
            $response->status() === 429 => ConnectionHealth::quotaBackoff(
                is_numeric($response->header('Retry-After')) ? (int) $response->header('Retry-After') : null,
                'rate_limited',
            ),
            default => ConnectionHealth::unreachable('provider_error'),
        };
    }

    public function send(ConnectionContext $connection, Draft $draft): SendResult
    {
        return SendResult::rejected('not_implemented');
    }

    /**
     * Mailtrap lists newest first and message ids only grow, so the cursor is
     * the highest id already handed over. The list is walked back to that id,
     * then the oldest unseen messages are returned first so the checkpoint
     * can advance in order.
     */
    public function fetchSince(ConnectionContext $connection, Checkpoint $checkpoint, array $folders): FetchPage
    {
        if ($folders !== [] && ! in_array(self::FOLDER, $folders, true)) {
            return FetchPage::empty($checkpoint);
        }

        $client = $this->client($connection);
        $cursor = (int) $checkpoint->cursor(self::FOLDER);

        $pending = $this->listNewerThan($client, $cursor);
        ksort($pending);

        $batch = array_slice($pending, 0, self::PAGE_SIZE, true);
        $messages = [];

        foreach ($batch as $id => $item) {
            $message = $this->hydrate($client, $connection, $item);

            // A message deleted at Mailtrap between the list and the read is
            // simply gone; step past it rather than stalling on it forever.
            if ($message !== null) {
                $messages[] = $message;
            }

            $checkpoint = $checkpoint->with(self::FOLDER, (string) $id);
        }

        return new FetchPage($messages, $checkpoint, count($pending) > count($batch));
    }

    public function getMessage(ConnectionContext $connection, string $providerMessageId): ?NormalizedMessage
    {
        $client = $this->client($connection);
        $response = $client->get('messages/'.rawurlencode($providerMessageId));

        if ($response->status() === 404) {
            return null;
        }

        $item = $this->json($response);

        return isset($item['id']) ? $this->hydrate($client, $connection, $item) : null;
    }

    public function getAttachment(ConnectionContext $connection, string $providerMessageId, string $partId): ?AttachmentContent
    {
        $client = $this->client($connection);
        $response = $client->get('messages/'.rawurlencode($providerMessageId).'/attachments/'.rawurlencode($partId));

        if ($response->status() === 404) {
            return null;
        }

        $attachment = $this->json($response);
        $downloadPath = $attachment['download_path'] ?? null;

        if (! is_string($downloadPath) || $downloadPath === '') {
            return null;
        }

        $download = $client->getPath($downloadPath);

        if ($download->status() === 404) {
            return null;
        }

        $this->ensureOk($download);

        return new AttachmentContent(
            (string) ($attachment['filename'] ?? "attachment-{$partId}"),
            isset($attachment['content_type']) ? (string) $attachment['content_type'] : null,
            $download->body(),
        );
    }

    /**
     * @return array<int, array<string, mixed>> list items newer than the cursor, keyed by message id
     */
    private function listNewerThan(MailtrapClient $client, int $cursor): array
    {
        $pending = [];
        $lastId = null;

        for ($page = 0; $page < self::MAX_LIST_PAGES; $page++) {
            $items = $this->json($client->get('messages', $lastId !== null ? ['last_id' => $lastId] : []));
            $ids = [];
            $reachedCursor = false;

            foreach ($items as $item) {
                if (! is_array($item) || ! is_numeric($item['id'] ?? null)) {
                    continue;
                }

                $id = (int) $item['id'];
                $ids[] = $id;

                if ($id <= $cursor) {
                    $reachedCursor = true;

                    continue;
                }

                $pending[$id] = $item;
            }

            // Stop on an empty page, at the checkpoint, or if the list is not moving backwards.
            if ($ids === [] || $reachedCursor || ($lastId !== null && min($ids) >= $lastId)) {
                break;
            }

            $lastId = min($ids);
        }

        return $pending;
    }

    /**
     * Build the full message from Mailtrap's list item plus its raw source
     * (for the headers the list leaves out) and its text/HTML bodies.
     *
     * @param  array<string, mixed>  $item
     */
    private function hydrate(MailtrapClient $client, ConnectionContext $connection, array $item): ?NormalizedMessage
    {
        $id = (string) $item['id'];
        $base = 'messages/'.rawurlencode($id);

        $source = $client->get("{$base}/body.eml");

        if ($source->status() === 404) {
            return null;
        }

        $this->ensureOk($source);

        $raw = $source->body();
        $headers = RfcHeaders::parse($raw);

        $from = $headers->address('From')
            ?? EmailAddress::tryParse(trim(($item['from_name'] ?? '').' <'.($item['from_email'] ?? '').'>'));
        $to = $headers->addresses('To') ?: EmailAddress::listFrom([(string) ($item['to_email'] ?? '')]);

        return new NormalizedMessage(
            providerMessageId: $id,
            direction: $this->direction($connection, $from),
            from: $from,
            to: $to,
            cc: $headers->addresses('Cc'),
            replyTo: $headers->addresses('Reply-To'),
            sentAt: $headers->date() ?? $this->date($item['sent_at'] ?? $item['created_at'] ?? null),
            subject: $headers->get('Subject') ?? (isset($item['subject']) ? (string) $item['subject'] : null),
            textBody: $this->body($client, "{$base}/body.txt", $item['text_body_size'] ?? null),
            htmlRaw: $this->body($client, "{$base}/body.html", $item['html_body_size'] ?? null),
            attachments: $this->attachments($client, $base, $raw),
            rfcMessageId: $headers->raw('Message-ID'),
            inReplyTo: $headers->raw('In-Reply-To'),
            references: $headers->raw('References'),
            folder: self::FOLDER,
            bcc: $headers->addresses('Bcc'),
        );
    }

    /** Mail the mailbox owner sent is outbound; everything else arrived. */
    private function direction(ConnectionContext $connection, ?EmailAddress $from): MessageDirection
    {
        $own = $from !== null && ($from->equals($connection->identity) || $from->equals($connection->from));

        return $own ? MessageDirection::Outbound : MessageDirection::Inbound;
    }

    private function body(MailtrapClient $client, string $path, mixed $size): ?string
    {
        // The list reports body sizes; skip the request when there is nothing to fetch.
        if (is_numeric($size) && (int) $size === 0) {
            return null;
        }

        $response = $client->get($path);

        if ($response->status() === 404) {
            return null;
        }

        $this->ensureOk($response);

        return $response->body() === '' ? null : $response->body();
    }

    /**
     * @return list<AttachmentRef>
     */
    private function attachments(MailtrapClient $client, string $base, string $raw): array
    {
        // Only ask when the source actually carries file parts.
        if (preg_match('/^Content-Disposition:\s*(attachment|inline)/mi', $raw) !== 1) {
            return [];
        }

        $response = $client->get("{$base}/attachments");

        if ($response->status() === 404) {
            return [];
        }

        $refs = [];

        foreach ($this->json($response) as $attachment) {
            if (! is_array($attachment) || ! isset($attachment['id'])) {
                continue;
            }

            $refs[] = new AttachmentRef(
                partId: (string) $attachment['id'],
                filename: (string) ($attachment['filename'] ?? 'attachment-'.$attachment['id']),
                mimeType: isset($attachment['content_type']) ? (string) $attachment['content_type'] : null,
                sizeBytes: is_numeric($attachment['attachment_size'] ?? null) ? (int) $attachment['attachment_size'] : null,
                contentId: isset($attachment['content_id']) && $attachment['content_id'] !== '' ? (string) $attachment['content_id'] : null,
                inline: ($attachment['attachment_type'] ?? null) === 'inline',
            );
        }

        return $refs;
    }

    private function date(mixed $value): ?DateTimeImmutable
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return new DateTimeImmutable($value);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @return array<mixed>
     *
     * @throws MailTransportException
     */
    private function json(Response $response): array
    {
        $this->ensureOk($response);

        $data = $response->json();

        if (! is_array($data)) {
            throw new MailTransportException('provider_error', retryable: true);
        }

        return $data;
    }

    /**
     * Turn a failed response into a short code. The response body is never carried along.
     *
     * @throws MailTransportException
     */
    private function ensureOk(Response $response): void
    {
        if ($response->successful()) {
            return;
        }

        throw match (true) {
            in_array($response->status(), [401, 403], true) => new MailTransportException('unauthorized', retryable: false),
            $response->status() === 404 => new MailTransportException('inbox_not_found', retryable: false),
            $response->status() === 429 => new MailTransportException('rate_limited', retryable: true),
            default => new MailTransportException('provider_error', retryable: true),
        };
    }

    /**
     * @throws MailTransportException when the account or connection is missing a credential.
     */
    private function client(ConnectionContext $connection): MailtrapClient
    {
        return MailtrapClient::forConnection($connection, (array) config('email.mailtrap', []));
    }
}
