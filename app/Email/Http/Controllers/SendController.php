<?php

namespace App\Email\Http\Controllers;

use App\Email\Authorization\EmailAccess;
use App\Email\Data\Draft;
use App\Email\Data\DraftAttachment;
use App\Email\Data\EmailAddress;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Exceptions\EmailUnavailableException;
use App\Email\Files\EmailFiles;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailFile;
use App\Email\Models\EmailSendAttempt;
use App\Email\Models\EmailSignature;
use App\Email\Sending\SendAttemptService;
use App\Email\Sending\SignatureAppender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Compose and send from a connected mailbox. From / Reply-To always come from
 * the connection; the client may not spoof them.
 */
class SendController
{
    public function __construct(
        private readonly EmailAccess $access,
        private readonly SendAttemptService $sends,
        private readonly EmailFiles $files,
        private readonly SignatureAppender $signatures,
    ) {}

    public function store(Request $request): JsonResponse
    {
        $input = $request->validate([
            'connection_id' => ['required', 'uuid'],
            'to' => ['nullable', 'array'],
            'to.*' => ['string', 'max:255'],
            'cc' => ['nullable', 'array'],
            'cc.*' => ['string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:998'],
            'text_body' => ['nullable', 'string', 'max:500000'],
            'html_body' => ['nullable', 'string', 'max:500000'],
            'attachment_ids' => ['nullable', 'array', 'max:20'],
            'attachment_ids.*' => ['uuid'],
            'include_signature' => ['nullable', 'boolean'],
            'in_reply_to' => ['nullable', 'string', 'max:998'],
            'references' => ['nullable', 'array'],
            'references.*' => ['string', 'max:998'],
        ]);

        $connection = $this->access->ownConnection($request->user(), $input['connection_id']);

        abort_if($connection === null, 404);

        $to = EmailAddress::listFrom($input['to'] ?? []);
        $cc = EmailAddress::listFrom($input['cc'] ?? []);

        $attachments = $this->resolveAttachments($connection, $input['attachment_ids'] ?? []);

        $textBody = $input['text_body'] ?? null;
        $htmlBody = $input['html_body'] ?? null;

        if ($input['include_signature'] ?? true) {
            $signature = EmailSignature::withoutGlobalScopes()
                ->where('connection_id', $connection->id)
                ->where('company_id', $connection->company_id)
                ->first();

            $bodies = $this->signatures->apply($signature, $textBody, $htmlBody);
            $textBody = $bodies['text'];
            $htmlBody = $bodies['html'];
        }

        $draft = new Draft(
            from: new EmailAddress($connection->from_email),
            to: $to,
            cc: $cc,
            replyTo: $connection->reply_to_email !== null
                ? new EmailAddress($connection->reply_to_email)
                : null,
            subject: (string) ($input['subject'] ?? ''),
            textBody: $textBody,
            htmlBody: $htmlBody,
            attachments: $attachments,
            inReplyTo: $input['in_reply_to'] ?? null,
            references: $input['references'] ?? null,
        );

        try {
            $attempt = $this->sends->send($connection, $draft, $request->user());
        } catch (EmailUnavailableException $exception) {
            throw ValidationException::withMessages([
                'connection_id' => $exception->reason,
            ]);
        }

        return response()->json([
            'attempt' => $this->present($attempt),
        ], $attempt->status === SendAttemptStatus::Sent ? 201 : 200);
    }

    /**
     * @param  list<string>  $uuids
     * @return list<DraftAttachment>
     */
    private function resolveAttachments(EmailConnection $connection, array $uuids): array
    {
        if ($uuids === []) {
            return [];
        }

        $files = EmailFile::withoutGlobalScopes()
            ->where('company_id', $connection->company_id)
            ->where('connection_id', $connection->id)
            ->whereIn('uuid', $uuids)
            ->get()
            ->keyBy('uuid');

        $attachments = [];

        foreach ($uuids as $uuid) {
            $file = $files->get($uuid);

            if ($file === null || $file->storage_key === null || ! $this->files->isUsable($file)) {
                throw ValidationException::withMessages([
                    'attachment_ids' => 'validation_attachment_unavailable',
                ]);
            }

            $attachments[] = new DraftAttachment(
                storageKey: $file->storage_key,
                filename: $file->filename,
                mimeType: $file->mime_type,
                sizeBytes: $file->size_bytes,
            );
        }

        return $attachments;
    }

    /**
     * @return array<string, mixed>
     */
    private function present(EmailSendAttempt $attempt): array
    {
        $draft = $attempt->draft();

        return [
            'id' => $attempt->uuid,
            // Provider acceptance is "sent" — never "delivered".
            'status' => $attempt->status->value,
            'error_code' => $attempt->error_code,
            'sent_at' => $attempt->sent_at?->toIso8601String(),
            'is_reply' => $draft->isReply(),
            'draft' => [
                'to' => array_map(fn (EmailAddress $a) => $a->address, $draft->to),
                'cc' => array_map(fn (EmailAddress $a) => $a->address, $draft->cc),
                'subject' => $draft->subject,
                'text_body' => $draft->textBody,
                'html_body' => $draft->htmlBody,
                'in_reply_to' => $draft->inReplyTo,
                'references' => $draft->references,
                'attachment_count' => count($draft->attachments),
            ],
        ];
    }
}
