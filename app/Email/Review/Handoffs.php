<?php

namespace App\Email\Review;

use App\Email\Authorization\EmailAccess;
use App\Email\EmailFeature;
use App\Email\Enums\HandoffStatus;
use App\Email\Enums\HandoffType;
use App\Email\Enums\LinkAuditAction;
use App\Email\Enums\ReviewStatus;
use App\Email\Models\EmailHandoff;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMailboxCopy;
use App\Models\User;
use DomainException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Explicit handoff / escalate of a review copy to another allowlisted user.
 * Never changes lead_owner and never moves mailbox ownership. Pending requests
 * stay visible to the sender until accept or reject.
 */
class Handoffs
{
    public function __construct(private readonly EmailAccess $access) {}

    public function request(
        User $from,
        EmailMailboxCopy $copy,
        User $to,
        HandoffType $type,
        ?string $note = null,
    ): EmailHandoff {
        if (! $this->access->canViewCopy($from, $copy)) {
            throw new DomainException('not_owner');
        }

        if ($copy->review_status !== ReviewStatus::Unlinked) {
            throw new DomainException('not_in_review');
        }

        if ($this->pendingForCopy($copy) !== null) {
            throw new DomainException('already_pending');
        }

        if (! $this->canReceive($from, $to)) {
            throw new DomainException('recipient_cannot_accept');
        }

        return DB::transaction(function () use ($from, $copy, $to, $type, $note) {
            $copy->review_status = ReviewStatus::HandedOff;
            $copy->save();

            $handoff = EmailHandoff::withoutGlobalScopes()->create([
                'company_id' => $copy->company_id,
                'mailbox_copy_id' => $copy->id,
                'conversation_id' => $copy->message?->conversation_id,
                'from_user_id' => $from->id,
                'to_user_id' => $to->id,
                'type' => $type,
                'status' => HandoffStatus::Pending,
                'note' => $note !== null && trim($note) !== '' ? trim($note) : null,
            ]);

            EmailLinkAudit::withoutGlobalScopes()->create([
                'company_id' => $copy->company_id,
                'action' => $type === HandoffType::Escalate
                    ? LinkAuditAction::Escalate
                    : LinkAuditAction::Handoff,
                'conversation_id' => $copy->message?->conversation_id,
                'mailbox_copy_id' => $copy->id,
                'actor_id' => $from->id,
                'meta' => [
                    'handoff_id' => $handoff->uuid,
                    'to_user_id' => $to->id,
                    'type' => $type->value,
                ],
            ]);

            return $handoff;
        });
    }

    public function accept(User $recipient, EmailHandoff $handoff): EmailHandoff
    {
        $this->assertPendingRecipient($recipient, $handoff);

        if (! $this->canAccept($recipient)) {
            throw new DomainException('recipient_cannot_accept');
        }

        return DB::transaction(function () use ($recipient, $handoff) {
            $handoff->status = HandoffStatus::Accepted;
            $handoff->resolved_at = now();
            $handoff->resolved_by = $recipient->id;
            $handoff->save();

            EmailLinkAudit::withoutGlobalScopes()->create([
                'company_id' => $handoff->company_id,
                'action' => LinkAuditAction::Accept,
                'conversation_id' => $handoff->conversation_id,
                'mailbox_copy_id' => $handoff->mailbox_copy_id,
                'actor_id' => $recipient->id,
                'meta' => [
                    'handoff_id' => $handoff->uuid,
                    'type' => $handoff->type->value,
                ],
            ]);

            return $handoff->refresh();
        });
    }

    /**
     * Reject returns the copy to the sender's private review. The mailbox
     * copy never leaves the sender — reject only clears the pending request.
     */
    public function reject(User $recipient, EmailHandoff $handoff): EmailHandoff
    {
        $this->assertPendingRecipient($recipient, $handoff);

        return DB::transaction(function () use ($recipient, $handoff) {
            $handoff->status = HandoffStatus::Rejected;
            $handoff->resolved_at = now();
            $handoff->resolved_by = $recipient->id;
            $handoff->save();

            $copy = EmailMailboxCopy::withoutGlobalScopes()->find($handoff->mailbox_copy_id);

            if ($copy !== null && $copy->review_status === ReviewStatus::HandedOff) {
                $copy->review_status = ReviewStatus::Unlinked;
                $copy->save();
            }

            EmailLinkAudit::withoutGlobalScopes()->create([
                'company_id' => $handoff->company_id,
                'action' => LinkAuditAction::Reject,
                'conversation_id' => $handoff->conversation_id,
                'mailbox_copy_id' => $handoff->mailbox_copy_id,
                'actor_id' => $recipient->id,
                'meta' => [
                    'handoff_id' => $handoff->uuid,
                    'type' => $handoff->type->value,
                ],
            ]);

            return $handoff->refresh();
        });
    }

    public function pendingForCopy(EmailMailboxCopy $copy): ?EmailHandoff
    {
        return EmailHandoff::withoutGlobalScopes()
            ->where('mailbox_copy_id', $copy->id)
            ->where('status', HandoffStatus::Pending)
            ->first();
    }

    /**
     * Pending handoffs this user sent — their copies stay in review until
     * accept/reject so the request remains visible.
     *
     * @return Collection<int, int>
     */
    public function pendingCopyIdsFrom(User $sender): Collection
    {
        return EmailHandoff::withoutGlobalScopes()
            ->where('company_id', $sender->company_id)
            ->where('from_user_id', $sender->id)
            ->where('status', HandoffStatus::Pending)
            ->pluck('mailbox_copy_id');
    }

    /**
     * Incoming pending requests for the recipient. Request-card shape only —
     * no body, no raw HTML (access matrix: pending recipient sees the card).
     *
     * @return list<array<string, mixed>>
     */
    public function presentIncoming(User $recipient): array
    {
        $handoffs = EmailHandoff::withoutGlobalScopes()
            ->with(['copy.message', 'fromUser'])
            ->where('company_id', $recipient->company_id)
            ->where('to_user_id', $recipient->id)
            ->where('status', HandoffStatus::Pending)
            ->orderByDesc('id')
            ->get();

        $items = [];

        foreach ($handoffs as $handoff) {
            $message = $handoff->copy?->message;

            $items[] = [
                'id' => $handoff->uuid,
                'type' => $handoff->type->value,
                'status' => $handoff->status->value,
                'note' => $handoff->note,
                'created_at' => $handoff->created_at?->toIso8601String(),
                'from_user' => $handoff->fromUser !== null
                    ? ['id' => $handoff->fromUser->id, 'name' => $handoff->fromUser->name]
                    : null,
                'copy_id' => $handoff->copy?->uuid,
                'subject' => $message?->subject,
                'from' => $message?->from_email !== null
                    ? ['address' => $message->from_email, 'name' => $message->from_name]
                    : null,
                'sent_at' => $message?->sent_at?->toIso8601String(),
                // Card only — no body preview until policy opens accepted access.
                'preview' => null,
            ];
        }

        return $items;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function presentForCopy(User $viewer, EmailMailboxCopy $copy): ?array
    {
        $handoff = $this->pendingForCopy($copy);

        if ($handoff === null) {
            return null;
        }

        if ((int) $handoff->from_user_id !== (int) $viewer->id
            && (int) $handoff->to_user_id !== (int) $viewer->id) {
            return null;
        }

        $to = User::withoutGlobalScopes()->find($handoff->to_user_id);

        return [
            'id' => $handoff->uuid,
            'type' => $handoff->type->value,
            'status' => $handoff->status->value,
            'note' => $handoff->note,
            'to_user' => $to !== null
                ? ['id' => $to->id, 'name' => $to->name]
                : null,
        ];
    }

    public function findOwnedPending(User $recipient, string $uuid): ?EmailHandoff
    {
        return EmailHandoff::withoutGlobalScopes()
            ->where('uuid', $uuid)
            ->where('company_id', $recipient->company_id)
            ->where('to_user_id', $recipient->id)
            ->where('status', HandoffStatus::Pending)
            ->first();
    }

    /**
     * Colleagues the actor may hand off to: same company, allowlisted, not
     * themselves, and able to accept (not a partner).
     *
     * @return list<array{id: int, name: string, email: string|null}>
     */
    public function colleagues(User $actor, string $term): array
    {
        $like = '%'.$term.'%';

        $users = User::withoutGlobalScopes()
            ->where('company_id', $actor->company_id)
            ->where('id', '!=', $actor->id)
            ->where(function ($query) use ($like) {
                $query->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like);
            })
            ->orderBy('name')
            ->limit(40)
            ->get(['id', 'company_id', 'name', 'email']);

        $items = [];

        foreach ($users as $user) {
            if (! $this->canReceive($actor, $user)) {
                continue;
            }

            $items[] = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ];

            if (count($items) >= 10) {
                break;
            }
        }

        return $items;
    }

    public function canAccept(User $user): bool
    {
        return $this->access->canAcceptHandoff($user);
    }

    public function canReceive(User $from, User $to): bool
    {
        return (int) $from->id !== (int) $to->id
            && (int) $from->company_id === (int) $to->company_id
            && $to->company_id !== null
            && EmailFeature::enabledFor($to)
            && $this->access->canAcceptHandoff($to);
    }

    private function assertPendingRecipient(User $recipient, EmailHandoff $handoff): void
    {
        if ($handoff->status !== HandoffStatus::Pending) {
            throw new DomainException('not_pending');
        }

        if ((int) $handoff->to_user_id !== (int) $recipient->id
            || (int) $handoff->company_id !== (int) $recipient->company_id) {
            throw new DomainException('not_recipient');
        }
    }
}
