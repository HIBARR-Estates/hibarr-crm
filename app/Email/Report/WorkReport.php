<?php

namespace App\Email\Report;

use App\Email\Enums\ConnectionStatus;
use App\Email\Enums\FollowableType;
use App\Email\Enums\HandoffStatus;
use App\Email\Enums\ReviewStatus;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailFollowUp;
use App\Email\Models\EmailHandoff;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailSendAttempt;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Manager work report: observed stuck states only — not reply scores, not
 * body parsing, and not "unread => overdue". Reading a message does not
 * clear any bucket. Informational inbound never invents an open follow-up.
 */
class WorkReport
{
    /**
     * @return array{
     *     counts: array{
     *         pending_routing: int,
     *         open_follow_ups: int,
     *         unresolved_handoffs: int,
     *         faults: int
     *     },
     *     sections: array{
     *         pending_routing: list<array<string, mixed>>,
     *         open_follow_ups: list<array<string, mixed>>,
     *         unresolved_handoffs: list<array<string, mixed>>,
     *         faults: list<array<string, mixed>>
     *     }
     * }
     */
    public function forCompany(User $viewer): array
    {
        $companyId = (int) $viewer->company_id;

        $pending = $this->pendingRouting($companyId);
        $followUps = $this->openFollowUps($companyId);
        $handoffs = $this->unresolvedHandoffs($companyId);
        $faults = $this->faults($companyId);

        return [
            'counts' => [
                'pending_routing' => count($pending),
                'open_follow_ups' => count($followUps),
                'unresolved_handoffs' => count($handoffs),
                'faults' => count($faults),
            ],
            'sections' => [
                'pending_routing' => $pending,
                'open_follow_ups' => $followUps,
                'unresolved_handoffs' => $handoffs,
                'faults' => $faults,
            ],
        ];
    }

    /**
     * Unlinked copies waiting for routing — not handed-off (that is the
     * handoff bucket) and not dismissed.
     *
     * @return list<array<string, mixed>>
     */
    private function pendingRouting(int $companyId): array
    {
        $copies = EmailMailboxCopy::withoutGlobalScopes()
            ->with(['connection.user', 'message'])
            ->where('company_id', $companyId)
            ->where('review_status', ReviewStatus::Unlinked)
            ->orderBy('id')
            ->get();

        $items = [];

        foreach ($copies as $copy) {
            $since = $copy->created_at ?? $copy->message?->sent_at ?? now();
            $items[] = $this->item(
                id: $copy->uuid,
                kind: 'pending_routing',
                label: $copy->message?->subject ?: null,
                since: $since,
                mailbox: $this->mailbox($copy->connection),
                href: '/email/review/'.$copy->uuid,
            );
        }

        return $items;
    }

    /**
     * Explicit open tasks linked to an email. Notes/meetings are not "open
     * follow-ups" here. Mere inbound never creates a row.
     *
     * @return list<array<string, mixed>>
     */
    private function openFollowUps(int $companyId): array
    {
        if (! Schema::hasTable('tasks')) {
            return [];
        }

        $links = EmailFollowUp::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('followable_type', FollowableType::Task)
            ->orderBy('id')
            ->get();

        if ($links->isEmpty()) {
            return [];
        }

        $taskIds = $links->pluck('followable_id')->unique()->all();
        // Query the table directly — Task's default eager loads need the full CRM schema.
        $tasks = DB::table('tasks')->whereIn('id', $taskIds)->get()->keyBy('id');

        $messageIds = $links->pluck('message_id')->unique()->all();
        $messages = EmailMessage::withoutGlobalScopes()
            ->whereIn('id', $messageIds)
            ->get()
            ->keyBy('id');

        $mailboxes = $this->mailboxesForMessages($companyId, $messageIds);
        $hasCompletedOn = Schema::hasColumn('tasks', 'completed_on');
        $items = [];

        foreach ($links as $link) {
            $task = $tasks->get($link->followable_id);

            if ($task === null) {
                continue;
            }

            if ($hasCompletedOn && ($task->completed_on ?? null) !== null) {
                continue;
            }

            $message = $messages->get($link->message_id);
            $since = $link->created_at ?? $task->created_at ?? now();

            $items[] = $this->item(
                id: 'task:'.$task->id,
                kind: 'open_follow_up',
                label: $task->heading ?: ($message?->subject),
                since: $since,
                mailbox: $mailboxes[$link->message_id] ?? null,
                href: '/account/tasks/'.$task->id,
            );
        }

        return $items;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function unresolvedHandoffs(int $companyId): array
    {
        $handoffs = EmailHandoff::withoutGlobalScopes()
            ->with(['copy.connection.user', 'copy.message', 'fromUser', 'toUser'])
            ->where('company_id', $companyId)
            ->where('status', HandoffStatus::Pending)
            ->orderBy('id')
            ->get();

        $items = [];

        foreach ($handoffs as $handoff) {
            $copy = $handoff->copy;
            $since = $handoff->created_at ?? now();
            $label = $copy?->message?->subject;
            $type = $handoff->type->value;

            $items[] = $this->item(
                id: $handoff->uuid,
                kind: 'unresolved_handoff',
                label: $label,
                since: $since,
                mailbox: $this->mailbox($copy?->connection),
                href: $copy !== null ? '/email/review/'.$copy->uuid : '/email/review',
                extra: [
                    'handoff_type' => $type,
                    'from_user' => $handoff->fromUser !== null
                        ? ['id' => $handoff->fromUser->id, 'name' => $handoff->fromUser->name]
                        : null,
                    'to_user' => $handoff->toUser !== null
                        ? ['id' => $handoff->toUser->id, 'name' => $handoff->toUser->name]
                        : null,
                ],
            );
        }

        return $items;
    }

    /**
     * Sync/connection faults and failed/uncertain sends. Waiting-on-quota is
     * routine backoff — not a fault on this report.
     *
     * @return list<array<string, mixed>>
     */
    private function faults(int $companyId): array
    {
        $items = [];

        $connections = EmailConnection::withoutGlobalScopes()
            ->with('user')
            ->where('company_id', $companyId)
            ->whereIn('status', [ConnectionStatus::Error, ConnectionStatus::NeedsReconnect])
            ->orderBy('id')
            ->get();

        foreach ($connections as $connection) {
            $since = $connection->updated_at ?? $connection->last_sync_at ?? $connection->created_at ?? now();
            $items[] = $this->item(
                id: 'connection:'.$connection->uuid,
                kind: 'sync_fault',
                label: $connection->last_error_code ?: $connection->status->value,
                since: $since,
                mailbox: $this->mailbox($connection),
                href: null,
                extra: [
                    'connection_status' => $connection->status->value,
                    'error_code' => $connection->last_error_code,
                ],
            );
        }

        $attempts = EmailSendAttempt::withoutGlobalScopes()
            ->with('connection.user')
            ->where('company_id', $companyId)
            ->whereIn('status', [SendAttemptStatus::Failed, SendAttemptStatus::Checking])
            ->orderBy('id')
            ->get();

        foreach ($attempts as $attempt) {
            $since = $attempt->last_attempted_at ?? $attempt->updated_at ?? $attempt->created_at ?? now();
            $subject = is_array($attempt->draft_payload)
                ? ($attempt->draft_payload['subject'] ?? null)
                : null;

            $items[] = $this->item(
                id: 'send:'.$attempt->uuid,
                kind: 'delivery_fault',
                label: $subject ?: ($attempt->error_code ?: $attempt->status->value),
                since: $since,
                mailbox: $this->mailbox($attempt->connection),
                href: null,
                extra: [
                    'send_status' => $attempt->status->value,
                    'error_code' => $attempt->error_code,
                ],
            );
        }

        return $items;
    }

    /**
     * Prefer the mailbox owner's own copy of the message for accountability.
     *
     * @param  list<int>  $messageIds
     * @return array<int, array{connection_id: string, email: string, owner_id: int|null, owner_name: string|null}>
     */
    private function mailboxesForMessages(int $companyId, array $messageIds): array
    {
        if ($messageIds === []) {
            return [];
        }

        $copies = EmailMailboxCopy::withoutGlobalScopes()
            ->with('connection.user')
            ->where('company_id', $companyId)
            ->whereIn('message_id', $messageIds)
            ->orderBy('id')
            ->get();

        $map = [];

        foreach ($copies as $copy) {
            if (isset($map[$copy->message_id])) {
                continue;
            }
            $map[$copy->message_id] = $this->mailbox($copy->connection);
        }

        return $map;
    }

    /**
     * @return array{connection_id: string, email: string, owner_id: int|null, owner_name: string|null}|null
     */
    private function mailbox(?EmailConnection $connection): ?array
    {
        if ($connection === null) {
            return null;
        }

        return [
            'connection_id' => $connection->uuid,
            'email' => $connection->identity_email,
            'owner_id' => $connection->user_id,
            'owner_name' => $connection->user?->name,
        ];
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function item(
        string $id,
        string $kind,
        ?string $label,
        mixed $since,
        ?array $mailbox,
        ?string $href,
        array $extra = [],
    ): array {
        $moment = $since instanceof Carbon ? $since : Carbon::parse((string) $since);

        return $extra + [
            'id' => $id,
            'kind' => $kind,
            'label' => $label !== null && trim($label) !== '' ? $label : null,
            'since' => $moment->toIso8601String(),
            'age_seconds' => max(0, $moment->diffInSeconds(now())),
            'mailbox' => $mailbox,
            'href' => $href,
        ];
    }
}
