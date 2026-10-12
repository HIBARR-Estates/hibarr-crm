<?php

namespace App\Email\Adapters\Zoho;

use App\Email\Contracts\AttachmentStore;
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
use Throwable;

/**
 * Zoho Mail over the Mail API. One adapter, one port. IMAP is not used.
 * Tokens are per connection; config/zoho.php is not read.
 */
class ZohoMailAdapter implements MailTransport
{
    public const PROVIDER = 'zoho';

    /** Folders synced when the caller does not name any. */
    private const DEFAULT_FOLDERS = ['Inbox', 'Sent'];

    private const PAGE_SIZE = 20;

    private const MAX_LIST_PAGES = 20;

    public function __construct(
        private readonly ZohoOAuth $oauth,
        private readonly ZohoMailClient $client,
        private readonly AttachmentStore $attachments,
    ) {}

    public function health(ConnectionContext $connection): ConnectionHealth
    {
        try {
            $this->oauth->assertConfigured();
            $this->requireMailbox($connection);
            $folders = $this->client->get($connection, 'folders');

            if (($folders['missing'] ?? false) === true) {
                return ConnectionHealth::needsReconnect('mailbox_not_found');
            }
        } catch (MailTransportException $exception) {
            return $this->healthFrom($exception);
        } catch (Throwable) {
            return ConnectionHealth::unreachable('provider_error');
        }

        return ConnectionHealth::ok();
    }

    public function send(ConnectionContext $connection, Draft $draft): SendResult
    {
        if (! $draft->hasRecipients()) {
            return SendResult::rejected('missing_recipient');
        }

        $content = $draft->htmlBody !== null && $draft->htmlBody !== ''
            ? $draft->htmlBody
            : (string) $draft->textBody;

        if (trim($content) === '' && $draft->subject === '' && $draft->attachments === []) {
            return SendResult::rejected('invalid_draft');
        }

        try {
            $this->oauth->assertConfigured();
            $this->requireMailbox($connection);
            $uploaded = $this->uploadAttachments($connection, $draft);
        } catch (MailTransportException $exception) {
            return $exception->retryable
                ? SendResult::unknown($exception->errorCode)
                : SendResult::rejected($exception->errorCode);
        } catch (Throwable) {
            return SendResult::rejected('invalid_draft');
        }

        $body = [
            'fromAddress' => $draft->from->address,
            'toAddress' => $this->join($draft->to),
            'subject' => $draft->subject,
            'content' => $content,
            'mailFormat' => $draft->htmlBody !== null && $draft->htmlBody !== '' ? 'html' : 'plaintext',
        ];

        if ($draft->cc !== []) {
            $body['ccAddress'] = $this->join($draft->cc);
        }

        if ($uploaded !== []) {
            $body['attachments'] = $uploaded;
        }

        try {
            $payload = $this->client->postJson($connection, 'messages', $body);
        } catch (MailTransportException $exception) {
            return match (true) {
                $exception->errorCode === 'rate_limited' => SendResult::throttled(null, 'rate_limited'),
                $exception->retryable => SendResult::unknown($exception->errorCode),
                default => SendResult::rejected($exception->errorCode),
            };
        } catch (Throwable) {
            return SendResult::unknown('transport_error');
        }

        $messageId = $payload['data']['messageId'] ?? null;

        return SendResult::accepted(is_scalar($messageId) ? (string) $messageId : null);
    }

    public function fetchSince(ConnectionContext $connection, Checkpoint $checkpoint, array $folders): FetchPage
    {
        $this->oauth->assertConfigured();
        $this->requireMailbox($connection);

        $targets = $this->targetFolders($connection, $folders);
        $messages = [];
        $hasMore = false;

        foreach ($targets as $folder) {
            $pending = $this->listNewerThan($connection, $folder, $checkpoint->cursor($folder['name']) ?? '0');
            $batch = array_slice($pending, 0, self::PAGE_SIZE - count($messages));

            foreach ($batch as $item) {
                $message = $this->hydrate($connection, $folder, $item);

                if ($message !== null) {
                    $messages[] = $message;
                }

                $checkpoint = $checkpoint->with($folder['name'], (string) $item['messageId']);
            }

            if (count($pending) > count($batch)) {
                $hasMore = true;
            }

            if (count($messages) >= self::PAGE_SIZE) {
                $hasMore = $hasMore || $this->laterFolderMayHaveMail($targets, $folder);
                break;
            }
        }

        return new FetchPage($messages, $checkpoint, $hasMore);
    }

    public function getMessage(ConnectionContext $connection, string $providerMessageId): ?NormalizedMessage
    {
        $parsed = $this->parseProviderId($providerMessageId);

        if ($parsed === null) {
            return null;
        }

        $this->requireMailbox($connection);

        $details = $this->client->get(
            $connection,
            'folders/'.rawurlencode($parsed['folderId']).'/messages/'.rawurlencode($parsed['messageId']).'/details',
        );

        if (($details['missing'] ?? false) === true || ! is_array($details['data'] ?? null)) {
            return null;
        }

        $item = $details['data'];
        $item['messageId'] = $item['messageId'] ?? $parsed['messageId'];
        $item['folderId'] = $item['folderId'] ?? $parsed['folderId'];

        return $this->hydrate($connection, [
            'id' => $parsed['folderId'],
            'name' => (string) ($item['folderName'] ?? $parsed['folderId']),
            'type' => (string) ($item['folderType'] ?? ''),
        ], $item);
    }

    public function getAttachment(ConnectionContext $connection, string $providerMessageId, string $partId): ?AttachmentContent
    {
        $parsed = $this->parseProviderId($providerMessageId);

        if ($parsed === null) {
            return null;
        }

        $bytes = $this->client->getBytes(
            $connection,
            'folders/'.rawurlencode($parsed['folderId']).'/messages/'.rawurlencode($parsed['messageId']).'/attachments/'.rawurlencode($partId),
        );

        if ($bytes === null || $bytes === '') {
            return null;
        }

        return new AttachmentContent('attachment-'.$partId, null, $bytes);
    }

    /**
     * @return array{folderId: string, messageId: string}|null
     */
    private function parseProviderId(string $providerMessageId): ?array
    {
        $parts = explode(':', $providerMessageId, 2);

        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            return null;
        }

        return ['folderId' => $parts[0], 'messageId' => $parts[1]];
    }

    /**
     * @throws MailTransportException
     */
    private function requireMailbox(ConnectionContext $connection): void
    {
        if (! $connection->hasCredential('refresh_token')) {
            throw new MailTransportException('missing_refresh_token', retryable: false);
        }

        if (! $connection->hasCredential('account_id')) {
            throw new MailTransportException('missing_account_id', retryable: false);
        }
    }

    /**
     * @param  list<string>  $requested
     * @return list<array{id: string, name: string, type: string}>
     *
     * @throws MailTransportException
     */
    private function targetFolders(ConnectionContext $connection, array $requested): array
    {
        $payload = $this->client->get($connection, 'folders');
        $wanted = $requested === []
            ? self::DEFAULT_FOLDERS
            : array_map(fn ($name) => strtolower((string) $name), $requested);
        $folders = [];

        foreach (is_array($payload['data'] ?? null) ? $payload['data'] : [] as $row) {
            if (! is_array($row) || ! isset($row['folderId'])) {
                continue;
            }

            $type = (string) ($row['folderType'] ?? '');
            $name = $type !== '' ? $type : (string) ($row['folderName'] ?? '');
            $label = strtolower($name);
            $folderName = strtolower((string) ($row['folderName'] ?? ''));

            if (! in_array($label, array_map('strtolower', $wanted), true) && ! in_array($folderName, array_map('strtolower', $wanted), true)) {
                continue;
            }

            $folders[] = [
                'id' => (string) $row['folderId'],
                'name' => $name !== '' ? $name : (string) $row['folderId'],
                'type' => $type,
            ];
        }

        return $folders;
    }

    /**
     * @param  array{id: string, name: string, type: string}  $folder
     * @return list<array<string, mixed>> oldest message id first
     *
     * @throws MailTransportException
     */
    private function listNewerThan(ConnectionContext $connection, array $folder, string $cursor): array
    {
        $pending = [];
        $start = 1;

        for ($page = 0; $page < self::MAX_LIST_PAGES; $page++) {
            $payload = $this->client->get($connection, 'messages/view', [
                'folderId' => $folder['id'],
                'start' => $start,
                'limit' => 50,
                'sortBy' => 'messageId',
                'sortorder' => 'false',
                'includeto' => 'true',
            ]);

            $rows = is_array($payload['data'] ?? null) ? $payload['data'] : [];

            if ($rows === []) {
                break;
            }

            $reachedCursor = false;

            foreach ($rows as $row) {
                if (! is_array($row) || ! isset($row['messageId'])) {
                    continue;
                }

                $id = (string) $row['messageId'];

                if (! $this->idGreater($id, $cursor)) {
                    $reachedCursor = true;

                    continue;
                }

                $pending[$id] = $row;
            }

            if ($reachedCursor || count($rows) < 50) {
                break;
            }

            $start += count($rows);
        }

        uksort($pending, fn (string $left, string $right) => $this->idGreater($left, $right) ? 1 : ($left === $right ? 0 : -1));

        return array_values($pending);
    }

    /**
     * @param  array{id: string, name: string, type: string}  $folder
     * @param  array<string, mixed>  $item
     */
    private function hydrate(ConnectionContext $connection, array $folder, array $item): ?NormalizedMessage
    {
        $messageId = (string) $item['messageId'];
        $folderId = (string) ($item['folderId'] ?? $folder['id']);
        $base = 'folders/'.rawurlencode($folderId).'/messages/'.rawurlencode($messageId);

        $content = $this->client->get($connection, $base.'/content');

        if (($content['missing'] ?? false) === true) {
            return null;
        }

        $headers = $this->headers($connection, $base);
        $from = $headers->address('From')
            ?? EmailAddress::tryParse($this->addressString($item['fromAddress'] ?? null, $item['sender'] ?? null));
        $body = is_array($content['data'] ?? null) ? ($content['data']['content'] ?? null) : null;
        $body = is_string($body) && $body !== '' ? $body : null;
        $isHtml = $body !== null && $body !== strip_tags($body);

        return new NormalizedMessage(
            providerMessageId: $folderId.':'.$messageId,
            direction: $this->direction($connection, $folder, $from),
            from: $from,
            to: $headers->addresses('To') ?: $this->addresses($item['toAddress'] ?? null),
            cc: $headers->addresses('Cc') ?: $this->addresses($item['ccAddress'] ?? null),
            replyTo: $headers->addresses('Reply-To'),
            sentAt: $headers->date() ?? $this->millis($item['sentDateInGMT'] ?? $item['receivedTime'] ?? null),
            subject: $headers->get('Subject') ?? (isset($item['subject']) ? (string) $item['subject'] : null),
            textBody: $isHtml ? null : $body,
            htmlRaw: $isHtml ? $body : null,
            attachments: $this->attachmentRefs($connection, $base, $item),
            rfcMessageId: $headers->raw('Message-ID'),
            inReplyTo: $headers->raw('In-Reply-To'),
            references: $headers->raw('References'),
            folder: $folder['name'],
            bcc: $headers->addresses('Bcc'),
        );
    }

    /**
     * @throws MailTransportException
     */
    private function headers(ConnectionContext $connection, string $base): RfcHeaders
    {
        try {
            $payload = $this->client->get($connection, $base.'/header');
        } catch (MailTransportException) {
            return RfcHeaders::parse('');
        }

        $data = $payload['data'] ?? null;
        $raw = null;

        if (is_string($data)) {
            $raw = $data;
        } elseif (is_array($data)) {
            $raw = $data['header'] ?? $data['headerContent'] ?? $data['content'] ?? null;
        }

        return RfcHeaders::parse(is_string($raw) ? $raw : '');
    }

    /**
     * @param  array<string, mixed>  $item
     * @return list<AttachmentRef>
     */
    private function attachmentRefs(ConnectionContext $connection, string $base, array $item): array
    {
        $flag = $item['hasAttachment'] ?? '0';

        if ($flag === 0 || $flag === '0' || $flag === false || $flag === '') {
            return [];
        }

        try {
            $payload = $this->client->get($connection, $base.'/attachmentinfo');
        } catch (MailTransportException) {
            return [];
        }

        $refs = [];

        foreach (is_array($payload['data'] ?? null) ? $payload['data'] : [] as $attachment) {
            if (! is_array($attachment) || ! isset($attachment['attachmentId'])) {
                continue;
            }

            $refs[] = new AttachmentRef(
                partId: (string) $attachment['attachmentId'],
                filename: (string) ($attachment['attachmentName'] ?? 'attachment-'.$attachment['attachmentId']),
                mimeType: isset($attachment['attachmentType']) ? (string) $attachment['attachmentType'] : null,
                sizeBytes: is_numeric($attachment['attachmentSize'] ?? null) ? (int) $attachment['attachmentSize'] : null,
            );
        }

        return $refs;
    }

    /**
     * @return list<array{storeName: string, attachmentPath: string, attachmentName: string}>
     *
     * @throws MailTransportException
     */
    private function uploadAttachments(ConnectionContext $connection, Draft $draft): array
    {
        $uploaded = [];

        foreach ($draft->attachments as $attachment) {
            $bytes = $this->attachments->read($attachment->storageKey);

            if ($bytes === null) {
                throw new MailTransportException('attachment_unavailable', retryable: false);
            }

            $stored = $this->client->uploadAttachment($connection, $attachment->filename, $bytes, $attachment->mimeType);
            $uploaded[] = [
                'storeName' => (string) $stored['storeName'],
                'attachmentPath' => (string) $stored['attachmentPath'],
                'attachmentName' => (string) ($stored['attachmentName'] ?? $attachment->filename),
            ];
        }

        return $uploaded;
    }

    /**
     * @param  array{id: string, name: string, type: string}  $folder
     */
    private function direction(ConnectionContext $connection, array $folder, ?EmailAddress $from): MessageDirection
    {
        if (strcasecmp($folder['type'], 'Sent') === 0 || strcasecmp($folder['name'], 'Sent') === 0) {
            return MessageDirection::Outbound;
        }

        $own = $from !== null && ($from->equals($connection->identity) || $from->equals($connection->from));

        return $own ? MessageDirection::Outbound : MessageDirection::Inbound;
    }

    /**
     * @param  list<EmailAddress>  $addresses
     */
    private function join(array $addresses): string
    {
        return implode(',', array_map(fn (EmailAddress $address) => $address->address, $addresses));
    }

    /**
     * @return list<EmailAddress>
     */
    private function addresses(mixed $value): array
    {
        if (! is_string($value)) {
            return [];
        }

        $value = trim($value);

        if ($value === '' || strcasecmp($value, 'Not Provided') === 0) {
            return [];
        }

        return EmailAddress::listFrom(preg_split('/\s*,\s*/', $value) ?: []);
    }

    private function addressString(mixed $address, mixed $name): string
    {
        $address = is_string($address) ? trim($address) : '';
        $name = is_string($name) ? trim($name) : '';

        if ($address === '') {
            return '';
        }

        return $name !== '' && ! str_contains($address, '<') ? $name.' <'.$address.'>' : $address;
    }

    private function millis(mixed $value): ?DateTimeImmutable
    {
        if (! is_numeric($value)) {
            return null;
        }

        $seconds = (int) floor(((int) $value) / 1000);

        if ($seconds <= 0) {
            return null;
        }

        return (new DateTimeImmutable('@'.$seconds))->setTimezone(new \DateTimeZone('UTC'));
    }

    private function idGreater(string $left, string $right): bool
    {
        $left = ltrim($left, '0') ?: '0';
        $right = ltrim($right, '0') ?: '0';

        if (strlen($left) !== strlen($right)) {
            return strlen($left) > strlen($right);
        }

        return $left > $right;
    }

    /**
     * @param  list<array{id: string, name: string, type: string}>  $folders
     * @param  array{id: string, name: string, type: string}  $current
     */
    private function laterFolderMayHaveMail(array $folders, array $current): bool
    {
        $seen = false;

        foreach ($folders as $folder) {
            if ($seen) {
                return true;
            }

            $seen = $folder['id'] === $current['id'];
        }

        return false;
    }

    private function healthFrom(MailTransportException $exception): ConnectionHealth
    {
        return match ($exception->errorCode) {
            'rate_limited' => ConnectionHealth::quotaBackoff(null, 'rate_limited'),
            'provider_unreachable', 'provider_error' => ConnectionHealth::unreachable($exception->errorCode),
            default => ConnectionHealth::needsReconnect($exception->errorCode),
        };
    }
}
