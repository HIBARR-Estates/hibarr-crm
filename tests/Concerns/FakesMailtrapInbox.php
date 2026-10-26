<?php

namespace Tests\Concerns;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/**
 * Answers Mailtrap Sandbox API calls from an in-test inbox, so adapter tests
 * never touch the network. Lists are newest-first and paged by last_id, like
 * the real API.
 */
trait FakesMailtrapInbox
{
    /** @var array<string, array<int, array<string, mixed>>> inbox id => message id => message */
    private array $mailtrapInboxes = [];

    private int $mailtrapListPageSize = 30;

    protected function configureMailtrap(): void
    {
        config([
            'email.mailtrap.api_token' => 'mt-api-token-very-secret',
            'email.mailtrap.account_id' => '1001',
            'email.mailtrap.api_base_url' => 'https://mailtrap.test',
            'email.mailtrap.sandboxes' => ['a' => '501', 'b' => '502'],
        ]);

        Http::fake(fn (Request $request) => $this->answerMailtrap($request));
    }

    /**
     * @param  array<string, mixed>  $message  headers (name => value), text, html, attachments
     *                                         (list of [id, filename, content_type, bytes, inline?])
     */
    protected function putMailtrapMessage(string $inboxId, int $id, array $message = []): void
    {
        $headers = ($message['headers'] ?? []) + [
            'From' => 'Lead Person <lead@example.test>',
            'To' => 'agent@agency.test',
            'Subject' => "Message {$id}",
            'Date' => 'Thu, 01 Oct 2026 09:30:00 +0000',
            'Message-ID' => "<mt-{$id}@mail.example.test>",
        ];

        $this->mailtrapInboxes[$inboxId][$id] = [
            'headers' => array_filter($headers, fn ($value) => $value !== null),
            'text' => $message['text'] ?? "Body {$id}",
            'html' => $message['html'] ?? null,
            'attachments' => $message['attachments'] ?? [],
        ];
    }

    protected function removeMailtrapMessage(string $inboxId, int $id): void
    {
        unset($this->mailtrapInboxes[$inboxId][$id]);
    }

    private function answerMailtrap(Request $request)
    {
        $path = (string) parse_url($request->url(), PHP_URL_PATH);
        parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

        if (preg_match('#^/api/accounts/1001/inboxes/(\d+)(?:/(.*))?$#', $path, $match) !== 1) {
            if (preg_match('#^/download/(\d+)/(\d+)/(\w+)$#', $path, $download) === 1) {
                $file = $this->mailtrapAttachment($download[1], (int) $download[2], $download[3]);

                return $file ? Http::response($file['bytes'], 200) : Http::response('', 404);
            }

            return Http::response([], 404);
        }

        [$inboxId, $rest] = [$match[1], $match[2] ?? ''];

        if (! isset($this->mailtrapInboxes[$inboxId])) {
            return Http::response(['error' => 'Not Found'], 404);
        }

        $inbox = $this->mailtrapInboxes[$inboxId];

        if ($rest === '') {
            return Http::response(['id' => (int) $inboxId]);
        }

        if ($rest === 'messages') {
            $ids = array_keys($inbox);
            rsort($ids);

            if (isset($query['last_id'])) {
                $ids = array_values(array_filter($ids, fn (int $id) => $id < (int) $query['last_id']));
            }

            return Http::response(array_map(
                fn (int $id) => $this->mailtrapListItem($inboxId, $id),
                array_slice($ids, 0, $this->mailtrapListPageSize),
            ));
        }

        if (preg_match('#^messages/(\d+)(?:/(.+))?$#', $rest, $parts) !== 1 || ! isset($inbox[(int) $parts[1]])) {
            return Http::response(['error' => 'Not Found'], 404);
        }

        $id = (int) $parts[1];
        $message = $inbox[$id];
        $sub = $parts[2] ?? '';

        if (preg_match('#^attachments/(\w+)$#', $sub, $attachment) === 1) {
            $file = $this->mailtrapAttachment($inboxId, $id, $attachment[1]);

            return $file ? Http::response($this->mailtrapAttachmentItem($inboxId, $id, $file)) : Http::response([], 404);
        }

        return match ($sub) {
            '' => Http::response($this->mailtrapListItem($inboxId, $id)),
            'body.eml' => Http::response($this->mailtrapSource($message), 200, ['Content-Type' => 'message/rfc822']),
            'body.txt' => Http::response((string) $message['text'], 200, ['Content-Type' => 'text/plain']),
            'body.html' => Http::response((string) $message['html'], 200, ['Content-Type' => 'text/html']),
            'attachments' => Http::response(array_map(
                fn (array $file) => $this->mailtrapAttachmentItem($inboxId, $id, $file),
                $message['attachments'],
            )),
            default => Http::response([], 404),
        };
    }

    /**
     * The thin list payload: no Message-ID, no Cc, no reply headers.
     *
     * @return array<string, mixed>
     */
    private function mailtrapListItem(string $inboxId, int $id): array
    {
        $message = $this->mailtrapInboxes[$inboxId][$id];

        return [
            'id' => $id,
            'inbox_id' => (int) $inboxId,
            'subject' => $message['headers']['Subject'] ?? null,
            'sent_at' => '2026-10-01T09:30:00.000Z',
            'from_email' => 'list-from@example.test',
            'from_name' => 'List From',
            'to_email' => 'list-to@example.test',
            'text_body_size' => strlen((string) $message['text']),
            'html_body_size' => strlen((string) $message['html']),
        ];
    }

    /**
     * @param  array<string, mixed>  $message
     */
    private function mailtrapSource(array $message): string
    {
        $lines = [];
        foreach ($message['headers'] as $name => $value) {
            $lines[] = "{$name}: {$value}";
        }

        $body = (string) $message['text'];

        foreach ($message['attachments'] as $file) {
            $disposition = ($file['inline'] ?? false) ? 'inline' : 'attachment';
            $body .= "\r\n--boundary\r\nContent-Disposition: {$disposition}; filename=\"{$file['filename']}\"\r\n\r\n".base64_encode($file['bytes']);
        }

        return implode("\r\n", $lines)."\r\n\r\n".$body;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function mailtrapAttachment(string $inboxId, int $messageId, string $attachmentId): ?array
    {
        foreach ($this->mailtrapInboxes[$inboxId][$messageId]['attachments'] ?? [] as $file) {
            if ((string) $file['id'] === $attachmentId) {
                return $file;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $file
     * @return array<string, mixed>
     */
    private function mailtrapAttachmentItem(string $inboxId, int $messageId, array $file): array
    {
        return [
            'id' => $file['id'],
            'message_id' => $messageId,
            'filename' => $file['filename'],
            'attachment_type' => ($file['inline'] ?? false) ? 'inline' : 'attachment',
            'content_type' => $file['content_type'] ?? 'application/octet-stream',
            'content_id' => $file['content_id'] ?? null,
            'attachment_size' => strlen($file['bytes']),
            'download_path' => "/download/{$inboxId}/{$messageId}/{$file['id']}",
        ];
    }
}
