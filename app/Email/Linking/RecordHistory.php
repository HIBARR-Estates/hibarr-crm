<?php

namespace App\Email\Linking;

use App\Email\Authorization\EmailAccess;
use App\Email\Enums\ReviewStatus;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Files\EmailFiles;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailConversation;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailSendAttempt;
use App\Email\Reads\ReadState;
use App\Email\Search\MessageSearch;
use App\Email\Support\RfcMessageId;
use App\Email\Support\SafePreview;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * The email history of a lead or deal as one user sees it: one event per
 * message, however many mailboxes hold a copy of it.
 *
 * Which messages a user gets is EmailAccess's decision, not this class's.
 */
class RecordHistory
{
    public function __construct(
        private readonly EmailAccess $access,
        private readonly EmailFiles $files,
        private readonly MessageSearch $search,
        private readonly ReadState $reads,
    ) {}

    public function for(User $viewer, Model $record, int $perPage): LengthAwarePaginator
    {
        return $this->access->messagesOnRecord($viewer, $record)->paginate($perPage);
    }

    /** The same messages the viewer may read on the record, narrowed to a search term. */
    public function search(User $viewer, Model $record, string $term, int $perPage): LengthAwarePaginator
    {
        return $this->search->filter($this->access->messagesOnRecord($viewer, $record), $term)->paginate($perPage);
    }

    /**
     * Compact Timeline groups: one row per linked conversation the viewer may
     * read, with dated messages for expand and send-attempt status when the
     * viewer's mailbox owns the outbound attempt.
     *
     * @return list<array<string, mixed>>
     */
    public function timelineGroups(User $viewer, Model $record): array
    {
        $messages = $this->access->messagesOnRecord($viewer, $record)
            ->whereNotNull('conversation_id')
            ->orderByDesc('sent_at')
            ->orderByDesc('id')
            ->get();

        if ($messages->isEmpty()) {
            return [];
        }

        $presented = collect($this->present($viewer, $messages))->keyBy('id');
        $sendStatuses = $this->sendStatusesFor($viewer, $messages);

        $conversations = EmailConversation::withoutGlobalScopes()
            ->whereIn('id', $messages->pluck('conversation_id')->unique()->all())
            ->get()
            ->keyBy('id');

        $groups = [];

        foreach ($messages->groupBy('conversation_id') as $conversationId => $thread) {
            /** @var Collection<int, EmailMessage> $thread */
            $conversation = $conversations->get($conversationId);
            if ($conversation === null) {
                continue;
            }

            // groupBy keeps insertion order, but re-sort so "latest" is unambiguous.
            $thread = $thread
                ->sortByDesc(fn (EmailMessage $message) => [
                    $message->sent_at?->getTimestamp() ?? 0,
                    $message->id,
                ])
                ->values();

            $rows = $thread->map(function (EmailMessage $message) use ($presented, $sendStatuses) {
                $event = $presented->get($message->uuid);
                if ($event === null) {
                    return null;
                }

                $status = $sendStatuses->get(RfcMessageId::normalize($message->rfc_message_id) ?? '');

                return [
                    'id' => $event['id'],
                    'subject' => $event['subject'],
                    'sent_at' => $event['sent_at'],
                    'direction' => $event['direction'],
                    'preview' => $event['preview'],
                    'unread' => $event['unread'],
                    'send_status' => $status?->value,
                ];
            })->filter()->values();

            if ($rows->isEmpty()) {
                continue;
            }

            /** @var array<string, mixed> $latest */
            $latest = $rows->first();
            $groupStatus = $this->rollupSendStatus(
                $rows->pluck('send_status')->filter()->values()->all(),
            );

            $groups[] = [
                'id' => $conversation->uuid,
                'subject' => $latest['subject'],
                'latest_sent_at' => $latest['sent_at'],
                'latest_direction' => $latest['direction'],
                'latest_message_id' => $latest['id'],
                'message_count' => $rows->count(),
                'unread_count' => $rows->where('unread', true)->count(),
                'status' => $groupStatus,
                'preview' => $latest['preview'],
                'messages' => $rows->all(),
            ];
        }

        usort($groups, function (array $a, array $b): int {
            return strcmp((string) ($b['latest_sent_at'] ?? ''), (string) ($a['latest_sent_at'] ?? ''));
        });

        return $groups;
    }

    /**
     * One linked conversation on the record for the drawer: every message the
     * viewer may read, oldest first, with bodies and exchanged attachments.
     *
     * @return array<string, mixed>|null
     */
    public function conversation(User $viewer, Model $record, string $conversationUuid, ?string $focusMessageUuid = null): ?array
    {
        $conversation = EmailConversation::withoutGlobalScopes()
            ->where('uuid', $conversationUuid)
            ->where('company_id', $record->getAttribute('company_id'))
            ->first();

        if ($conversation === null) {
            return null;
        }

        $messages = $this->access->messagesOnRecord($viewer, $record)
            ->where('conversation_id', $conversation->id)
            ->orderBy('sent_at')
            ->orderBy('id')
            ->get();

        if ($messages->isEmpty()) {
            return null;
        }

        return $this->presentConversation($viewer, $conversation, $messages, $focusMessageUuid);
    }

    /**
     * Resolve a drawer deep link by message uuid on this record.
     *
     * @return array<string, mixed>|null
     */
    public function conversationByMessage(User $viewer, Model $record, string $messageUuid): ?array
    {
        $message = $this->access->messagesOnRecord($viewer, $record)
            ->where('uuid', $messageUuid)
            ->first();

        if ($message === null || $message->conversation_id === null) {
            return null;
        }

        $conversation = EmailConversation::withoutGlobalScopes()->find($message->conversation_id);

        if ($conversation === null) {
            return null;
        }

        $messages = $this->access->messagesOnRecord($viewer, $record)
            ->where('conversation_id', $conversation->id)
            ->orderBy('sent_at')
            ->orderBy('id')
            ->get();

        if ($messages->isEmpty()) {
            return null;
        }

        return $this->presentConversation($viewer, $conversation, $messages, $messageUuid);
    }

    /**
     * Headers and a plain-text preview. The headers are the message's own, so
     * every To/Cc participant shows — not just the viewer's mailbox. With a
     * search term, each event also carries the text around the match.
     *
     * @param  iterable<EmailMessage>  $messages
     * @return list<array<string, mixed>>
     */
    public function present(User $viewer, iterable $messages, ?string $term = null): array
    {
        $messages = collect($messages);

        // A user can hold one message more than once (two mailboxes, or moved copies); the first stands for it.
        $copies = $this->ownProjectedCopies($viewer)
            ->whereIn('message_id', $messages->pluck('id')->all())
            ->orderBy('id')
            ->get()
            ->unique('message_id')
            ->keyBy('message_id');

        $conversations = EmailConversation::withoutGlobalScopes()
            ->whereIn('id', $messages->pluck('conversation_id')->filter()->unique()->all())
            ->pluck('uuid', 'id');

        $files = $this->files->summaries($messages->pluck('id')->all());
        $unread = $this->reads->unreadAmong($viewer, $messages->pluck('id')->map(fn ($id) => (int) $id)->all());

        return $messages->map(function (EmailMessage $message) use ($copies, $conversations, $files, $term, $unread) {
            /** @var EmailMailboxCopy|null $copy */
            $copy = $copies->get($message->id);

            return ($term !== null ? ['snippet' => $this->search->snippet($message, $term)] : []) + [
                'id' => $message->uuid,
                'conversation_id' => $conversations->get($message->conversation_id),
                'copy_id' => $copy?->uuid,
                'unread' => in_array((int) $message->id, $unread, true),
                'direction' => $copy?->direction->value,
                'from' => $message->from_email !== null
                    ? ['address' => $message->from_email, 'name' => $message->from_name]
                    : null,
                'to' => $message->to_recipients ?? [],
                'cc' => $message->cc_recipients ?? [],
                'subject' => $message->subject,
                'sent_at' => $message->sent_at?->toIso8601String(),
                'preview' => SafePreview::from($message->text_body, $message->html_raw),
                'has_attachments' => (bool) $message->has_attachments,
                'files' => $files->get($message->id, []),
            ];
        })->values()->all();
    }

    /**
     * @param  Collection<int, EmailMessage>  $messages
     * @return array<string, mixed>
     */
    private function presentConversation(
        User $viewer,
        EmailConversation $conversation,
        Collection $messages,
        ?string $focusMessageUuid,
    ): array {
        $copies = $this->ownProjectedCopies($viewer)
            ->with('connection')
            ->whereIn('message_id', $messages->pluck('id')->all())
            ->orderBy('id')
            ->get()
            ->unique('message_id')
            ->keyBy('message_id');

        $filesByMessage = $this->files->summaries($messages->pluck('id')->all());
        $unread = $this->reads->unreadAmong($viewer, $messages->pluck('id')->map(fn ($id) => (int) $id)->all());

        $presented = $messages->map(function (EmailMessage $message) use ($copies, $filesByMessage, $unread, $conversation) {
            /** @var EmailMailboxCopy|null $copy */
            $copy = $copies->get($message->id);
            $mailbox = $copy?->connection;

            $row = [
                'id' => $message->uuid,
                'conversation_id' => $conversation->uuid,
                'copy_id' => $copy?->uuid,
                'unread' => in_array((int) $message->id, $unread, true),
                'direction' => $copy?->direction->value,
                'from' => $message->from_email !== null
                    ? ['address' => $message->from_email, 'name' => $message->from_name]
                    : null,
                'to' => $message->to_recipients ?? [],
                'cc' => $message->cc_recipients ?? [],
                'subject' => $message->subject,
                'sent_at' => $message->sent_at?->toIso8601String(),
                'text_body' => $message->text_body,
                // Sanitized HTML only — never html_raw.
                'html_body' => $message->html_safe,
                'has_attachments' => (bool) $message->has_attachments,
                'files' => $filesByMessage->get($message->id, []),
                'mailbox' => $mailbox !== null
                    ? [
                        'id' => $mailbox->uuid,
                        'email' => $mailbox->identity_email,
                    ]
                    : null,
                'rfc_message_id' => $message->rfc_message_id,
                'in_reply_to' => $message->in_reply_to,
                'references' => $message->reference_ids ?? [],
            ];

            // Bcc is copy-local: only when this viewer's mailbox knows it.
            if ($copy !== null && is_array($copy->bcc_recipients) && $copy->bcc_recipients !== []) {
                $row['bcc'] = $copy->bcc_recipients;
            }

            return $row;
        })->values()->all();

        $focus = $focusMessageUuid;
        if ($focus === null || ! collect($presented)->contains(fn (array $m) => $m['id'] === $focus)) {
            $focus = $presented[array_key_last($presented)]['id'] ?? null;
        }

        $exchanged = [];
        foreach ($presented as $message) {
            foreach ($message['files'] as $file) {
                $exchanged[] = $file + [
                    'message_id' => $message['id'],
                    'sent_at' => $message['sent_at'],
                    'subject' => $message['subject'],
                ];
            }
        }

        return [
            'conversation' => [
                'id' => $conversation->uuid,
                'subject' => $presented[0]['subject'] ?? null,
                'message_count' => count($presented),
            ],
            'messages' => $presented,
            'exchanged_attachments' => $exchanged,
            'focus_message_id' => $focus,
        ];
    }

    private function ownProjectedCopies(User $viewer)
    {
        return $this->access->ownCopies($viewer)->where('review_status', ReviewStatus::None);
    }

    /**
     * @param  Collection<int, EmailMessage>  $messages
     * @return Collection<string, SendAttemptStatus>
     */
    private function sendStatusesFor(User $viewer, Collection $messages): Collection
    {
        $rawIds = $messages
            ->pluck('rfc_message_id')
            ->filter(fn ($id) => is_string($id) && $id !== '')
            ->unique()
            ->values();

        if ($rawIds->isEmpty()) {
            return collect();
        }

        // Match both stored shapes: some rows keep the bare id, others `<id@host>`.
        $lookupIds = $rawIds
            ->merge($rawIds->map(fn (string $id) => RfcMessageId::normalize($id))->filter())
            ->unique()
            ->values()
            ->all();

        $connectionIds = EmailConnection::withoutGlobalScopes()
            ->where('user_id', $viewer->id)
            ->where('company_id', $viewer->company_id)
            ->pluck('id')
            ->all();

        if ($connectionIds === []) {
            return collect();
        }

        return EmailSendAttempt::withoutGlobalScopes()
            ->where('company_id', $viewer->company_id)
            ->whereIn('connection_id', $connectionIds)
            ->whereIn('rfc_message_id', $lookupIds)
            ->orderByDesc('id')
            ->get()
            ->unique(fn (EmailSendAttempt $attempt) => RfcMessageId::normalize($attempt->rfc_message_id) ?? $attempt->rfc_message_id)
            ->mapWithKeys(function (EmailSendAttempt $attempt) {
                $key = RfcMessageId::normalize($attempt->rfc_message_id);

                return $key !== null ? [$key => $attempt->status] : [];
            });
    }

    /**
     * @param  list<string>  $statuses
     */
    private function rollupSendStatus(array $statuses): ?string
    {
        if ($statuses === []) {
            return null;
        }

        foreach ([
            SendAttemptStatus::Failed->value,
            SendAttemptStatus::Checking->value,
            SendAttemptStatus::WaitingQuota->value,
            SendAttemptStatus::Sending->value,
            SendAttemptStatus::Sent->value,
        ] as $priority) {
            if (in_array($priority, $statuses, true)) {
                return $priority;
            }
        }

        return null;
    }
}
