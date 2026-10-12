<?php

namespace App\Email\FollowUps;

use App\Email\Authorization\EmailAccess;
use App\Email\Enums\FollowableType;
use App\Email\Models\EmailFollowUp;
use App\Email\Models\EmailMessage;
use App\Models\User;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Throwable;

/**
 * Attaches an existing task / note / meeting to the exact email message it
 * was created from. Does not create follow-ups on ingest or send.
 */
class FollowUpLinker
{
    public function __construct(private readonly EmailAccess $access) {}

    /**
     * When the create payload includes a source email uuid, verify access and
     * store the link. Missing/blank values are a no-op.
     *
     * @throws DomainException when the uuid is present but not readable
     */
    public function attachFromRequest(User $actor, Model $followable, mixed $sourceEmailMessageId): ?EmailFollowUp
    {
        if ($sourceEmailMessageId === null || $sourceEmailMessageId === '') {
            return null;
        }

        if (! is_string($sourceEmailMessageId) && ! is_numeric($sourceEmailMessageId)) {
            throw new DomainException('invalid_source_email');
        }

        return $this->attach($actor, $followable, (string) $sourceEmailMessageId);
    }

    public function attach(User $actor, Model $followable, string $messageUuid): EmailFollowUp
    {
        $message = $this->access->findMessage($messageUuid);

        if ($message === null || ! $this->access->canViewMessage($actor, $message)) {
            throw new DomainException('source_email_unavailable');
        }

        if ((int) $message->company_id !== (int) $actor->company_id) {
            throw new DomainException('source_email_unavailable');
        }

        $type = FollowableType::forModel($followable);

        return EmailFollowUp::withoutGlobalScopes()->updateOrCreate(
            [
                'followable_type' => $type,
                'followable_id' => $followable->getKey(),
            ],
            [
                'company_id' => $message->company_id,
                'message_id' => $message->id,
                'created_by' => $actor->id,
            ],
        );
    }

    /** Public uuid of the source message, or null. */
    public function sourceUuidFor(Model $followable): ?string
    {
        try {
            $type = FollowableType::forModel($followable);
        } catch (Throwable) {
            return null;
        }

        $messageId = EmailFollowUp::withoutGlobalScopes()
            ->where('followable_type', $type)
            ->where('followable_id', $followable->getKey())
            ->value('message_id');

        if ($messageId === null) {
            return null;
        }

        return EmailMessage::withoutGlobalScopes()->whereKey($messageId)->value('uuid');
    }

    /**
     * Set `source_email_message_id` on each followable from a single batch lookup.
     *
     * @param  iterable<Model>  $followables
     */
    public function decorateSourceUuids(iterable $followables): void
    {
        $map = $this->sourceUuidsFor($followables);

        foreach ($followables as $followable) {
            try {
                $type = FollowableType::forModel($followable);
            } catch (Throwable) {
                continue;
            }

            $followable->setAttribute(
                'source_email_message_id',
                $map[$type->value.':'.$followable->getKey()] ?? null,
            );
        }
    }

    /**
     * @param  iterable<Model>  $followables
     * @return array<string, string|null> keyed by "{type}:{id}" → message uuid
     */
    public function sourceUuidsFor(iterable $followables): array
    {
        $keys = [];

        foreach ($followables as $followable) {
            try {
                $type = FollowableType::forModel($followable);
            } catch (Throwable) {
                continue;
            }
            $keys[$type->value.':'.$followable->getKey()] = [
                'type' => $type,
                'id' => (int) $followable->getKey(),
            ];
        }

        if ($keys === []) {
            return [];
        }

        $byType = Collection::make($keys)->groupBy(fn ($row) => $row['type']->value);
        $links = EmailFollowUp::withoutGlobalScopes()->where(function ($query) use ($byType) {
            foreach ($byType as $type => $rows) {
                $query->orWhere(function ($inner) use ($type, $rows) {
                    $inner->where('followable_type', $type)
                        ->whereIn('followable_id', $rows->pluck('id')->all());
                });
            }
        })->get(['followable_type', 'followable_id', 'message_id']);

        $messageIds = $links->pluck('message_id')->unique()->all();
        $uuids = $messageIds === []
            ? collect()
            : EmailMessage::withoutGlobalScopes()->whereIn('id', $messageIds)->pluck('uuid', 'id');

        $map = [];

        foreach ($links as $link) {
            $map[$link->followable_type->value.':'.$link->followable_id] = $uuids[$link->message_id] ?? null;
        }

        return $map;
    }
}
