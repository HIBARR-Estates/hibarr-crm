<?php

namespace App\Email\Files;

use App\Email\Data\AttachmentRef;
use App\Email\EmailFeature;
use App\Email\Enums\FileScanStatus;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailFile;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Transport\MailTransportFactory;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Throwable;

/**
 * Email attachments in the CRM: recording what a received message carries,
 * fetching and storing the bytes, taking uploads for sending, and deciding
 * whether a file may be handed out at all.
 *
 * Who may have a file is EmailAccess's decision; this class only knows
 * whether the file itself is fit to give to anyone.
 */
class EmailFiles
{
    /** Environments where the unscanned-files switch is never honoured. */
    private const PRODUCTION_ENVIRONMENTS = ['production', 'codecanyon'];

    public function __construct(
        private readonly EmailFileStorage $storage,
        private readonly MailTransportFactory $transports,
    ) {}

    /**
     * Records the attachments a received message carries. The first mailbox
     * to deliver the message defines them; a second copy adds nothing.
     *
     * @param  list<AttachmentRef>  $attachments
     * @return list<EmailFile> The files newly recorded, still to be fetched.
     */
    public function register(EmailMailboxCopy $copy, EmailMessage $message, array $attachments): array
    {
        if ($attachments === [] || EmailFile::withoutGlobalScopes()->where('message_id', $message->id)->exists()) {
            return [];
        }

        $files = [];

        foreach ($attachments as $attachment) {
            $files[] = EmailFile::withoutGlobalScopes()->create([
                'company_id' => $message->company_id,
                'message_id' => $message->id,
                'connection_id' => $copy->connection_id,
                'part_id' => $attachment->partId,
                'filename' => $this->safeName($attachment->filename),
                'mime_type' => $attachment->mimeType,
                'size_bytes' => $attachment->sizeBytes,
                'content_id' => $attachment->contentId,
                'inline' => $attachment->inline,
            ]);
        }

        return $files;
    }

    /**
     * Fetches a received attachment through the mail transport and stores it.
     * Any failure leaves the file "unavailable"; the message is unaffected.
     */
    public function fetchAndStore(EmailFile $file): EmailFile
    {
        if ($file->isStored() || $file->part_id === null) {
            return $file;
        }

        $connection = $file->connection;
        $providerMessageId = $connection !== null
            ? EmailMailboxCopy::withoutGlobalScopes()
                ->where('connection_id', $connection->id)
                ->where('message_id', $file->message_id)
                ->value('provider_message_id')
            : null;

        // Fail closed: flag, pilot allowlist and an active mailbox, as for sync itself.
        if ($connection === null || $providerMessageId === null
            || ! EmailFeature::enabledFor($connection->user) || ! $connection->isSyncable()) {
            return $this->unavailable($file, 'mailbox_unavailable');
        }

        try {
            $context = $connection->toContext();
            $content = $this->transports->forConnection($context)->getAttachment($context, (string) $providerMessageId, $file->part_id);
        } catch (Throwable) {
            return $this->unavailable($file, 'fetch_failed');
        }

        if ($content === null) {
            return $this->unavailable($file, 'not_at_provider');
        }

        if (($refused = $this->refusal($file->filename, $content->sizeBytes())) !== null) {
            return $this->unavailable($file, $refused);
        }

        try {
            $stored = $this->storage->put($content->bytes, $file->filename);
        } catch (Throwable) {
            return $this->unavailable($file, 'store_failed');
        }

        $file->forceFill([
            'storage_key' => $stored['key'],
            'storage_url' => $stored['url'],
            'size_bytes' => $content->sizeBytes(),
            'mime_type' => $file->mime_type ?? $content->mimeType,
            'scan_status' => FileScanStatus::Pending,
            'error_code' => null,
        ])->save();

        return $file;
    }

    /**
     * Stores a file a user uploaded to send from one of their mailboxes.
     *
     * @throws FileRefused when the size or type limits rule it out, or the gateway does not take it.
     */
    public function upload(User $uploader, EmailConnection $connection, UploadedFile $upload): EmailFile
    {
        $filename = $this->safeName($upload->getClientOriginalName());
        $size = (int) $upload->getSize();

        if (($refused = $this->refusal($filename, $size)) !== null) {
            throw new FileRefused($refused);
        }

        try {
            $stored = $this->storage->putFromPath((string) $upload->getRealPath(), $filename);
        } catch (Throwable) {
            throw new FileRefused('store_failed');
        }

        return EmailFile::withoutGlobalScopes()->create([
            'company_id' => $connection->company_id,
            'connection_id' => $connection->id,
            'uploaded_by' => $uploader->id,
            'filename' => $filename,
            'mime_type' => $upload->getMimeType(),
            'size_bytes' => $size,
            'storage_key' => $stored['key'],
            'storage_url' => $stored['url'],
        ]);
    }

    /**
     * May this file be given out — downloaded or attached to outgoing mail?
     * Stored, and scanned clean. Until a scanner exists nothing is clean, so
     * a dev/staging switch can let unscanned files through; never in production.
     */
    public function isUsable(EmailFile $file): bool
    {
        if (! $file->isStored()) {
            return false;
        }

        return match ($file->scan_status) {
            FileScanStatus::Clean => true,
            FileScanStatus::Pending => (bool) config('email.files.allow_unscanned', false)
                && ! app()->environment(self::PRODUCTION_ENVIRONMENTS),
            default => false,
        };
    }

    /** The bytes of a usable file; null for anything else. */
    public function bytes(EmailFile $file): ?string
    {
        return $this->isUsable($file) ? $this->storage->get((string) $file->storage_url) : null;
    }

    /**
     * What to show about the files on some messages: name, size, type and
     * state. Never where they are stored.
     *
     * @param  list<int>  $messageIds
     * @return Collection<int, list<array<string, mixed>>> keyed by message id
     */
    public function summaries(array $messageIds): Collection
    {
        if ($messageIds === []) {
            return new Collection;
        }

        return EmailFile::withoutGlobalScopes()
            ->whereIn('message_id', $messageIds)
            ->orderBy('id')
            ->get()
            ->groupBy('message_id')
            ->map(fn ($files) => $files->map(fn (EmailFile $file) => $this->summary($file))->values()->all());
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(EmailFile $file): array
    {
        return [
            'id' => $file->uuid,
            'filename' => $file->filename,
            'mime_type' => $file->mime_type,
            'size_bytes' => $file->size_bytes,
            'inline' => $file->inline,
            'scan_status' => $file->scan_status->value,
            'downloadable' => $this->isUsable($file),
        ];
    }

    /** Placeholder limits until the security policy is signed. */
    private function refusal(string $filename, int $sizeBytes): ?string
    {
        if ($sizeBytes <= 0) {
            return 'empty_file';
        }

        if ($sizeBytes > (int) config('email.files.max_bytes', 25 * 1024 * 1024)) {
            return 'too_large';
        }

        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        if (in_array($extension, (array) config('email.files.blocked_extensions', []), true)) {
            return 'type_not_allowed';
        }

        return null;
    }

    private function unavailable(EmailFile $file, string $code): EmailFile
    {
        $file->forceFill(['scan_status' => FileScanStatus::Unavailable, 'error_code' => $code])->save();

        return $file;
    }

    /** A bare file name: no path, no control characters. */
    private function safeName(string $filename): string
    {
        $name = basename(str_replace('\\', '/', $filename));
        $name = trim((string) preg_replace('/[\x00-\x1F\x7F]/', '', $name));

        return $name !== '' ? mb_substr($name, 0, 255) : 'attachment';
    }
}
