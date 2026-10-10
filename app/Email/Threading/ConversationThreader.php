<?php

namespace App\Email\Threading;

use App\Email\Models\EmailConversation;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailRecordLink;
use App\Email\Support\RfcMessageId;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Puts a message in its conversation using the reply graph alone: its
 * Message-ID, In-Reply-To and References. Subject, sender and timing are
 * never looked at, so two unrelated mails with the same subject stay apart.
 *
 * Always within one company, and safe to run again for the same message.
 */
class ConversationThreader
{
    private const REFERENCES_TABLE = 'email_message_references';

    public function thread(EmailMessage $message): EmailConversation
    {
        return DB::transaction(function () use ($message) {
            $pointsTo = $this->referenceHashes($message);
            $this->storeReferences($message, $pointsTo);

            $related = $this->relatedMessages($message, $pointsTo);

            $conversationIds = $related->pluck('conversation_id')
                ->push($message->conversation_id)
                ->filter()
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->sort()
                ->values();

            $conversation = $conversationIds->isEmpty()
                ? EmailConversation::withoutGlobalScopes()->create(['company_id' => $message->company_id])
                : $this->merge((int) $message->company_id, $conversationIds);

            EmailMessage::withoutGlobalScopes()
                ->where('company_id', $message->company_id)
                ->whereIn('id', $related->pluck('id')->push($message->id)->all())
                ->where(fn ($query) => $query
                    ->whereNull('conversation_id')
                    ->orWhere('conversation_id', '!=', $conversation->id))
                ->update(['conversation_id' => $conversation->id]);

            $message->setAttribute('conversation_id', $conversation->id);
            $message->syncOriginalAttribute('conversation_id');
            $message->setRelation('conversation', $conversation);

            return $conversation;
        });
    }

    /**
     * Hashes of the Message-IDs this message names as its ancestors.
     *
     * @return list<string>
     */
    private function referenceHashes(EmailMessage $message): array
    {
        $ids = RfcMessageId::parseList([$message->in_reply_to, ...($message->reference_ids ?? [])]);

        // A message naming itself is not a reply to anything.
        $ids = array_filter($ids, fn (string $id) => $id !== $message->rfc_message_id);

        return array_values(array_map(fn (string $id) => (string) EmailMessage::hashRfcMessageId($id), $ids));
    }

    /**
     * @param  list<string>  $hashes
     */
    private function storeReferences(EmailMessage $message, array $hashes): void
    {
        if ($hashes === []) {
            return;
        }

        DB::table(self::REFERENCES_TABLE)->insertOrIgnore(array_map(fn (string $hash) => [
            'company_id' => $message->company_id,
            'message_id' => $message->id,
            'reference_hash' => $hash,
        ], $hashes));
    }

    /**
     * Every known message tied to this one by the reply graph:
     *  - the ones it replies to or references,
     *  - the ones that reply to or reference it (a reply can arrive first),
     *  - the ones that reference the same ancestor, when that ancestor itself
     *    never reached the CRM.
     *
     * @param  list<string>  $pointsTo
     * @return Collection<int, object{id: int, conversation_id: int|null}>
     */
    private function relatedMessages(EmailMessage $message, array $pointsTo): Collection
    {
        $viaReferences = DB::table(self::REFERENCES_TABLE)
            ->where('company_id', $message->company_id)
            ->whereIn('reference_hash', array_values(array_filter([...$pointsTo, $message->rfc_message_id_hash])))
            ->where('message_id', '!=', $message->id)
            ->select('message_id');

        return EmailMessage::withoutGlobalScopes()
            ->where('company_id', $message->company_id)
            ->whereKeyNot($message->id)
            ->where(fn ($query) => $query
                ->whereIn('id', $viaReferences)
                ->when($pointsTo !== [], fn ($query) => $query->orWhereIn('rfc_message_id_hash', $pointsTo)))
            ->toBase()
            ->get(['id', 'conversation_id']);
    }

    /**
     * A message that ties several conversations together makes them one.
     * The survivor is a conversation already on a lead or deal if there is
     * one, otherwise the oldest; links and audit rows follow it.
     *
     * @param  Collection<int, int>  $conversationIds  Sorted, oldest first.
     */
    private function merge(int $companyId, Collection $conversationIds): EmailConversation
    {
        $conversations = EmailConversation::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereIn('id', $conversationIds->all())
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        if ($conversations->isEmpty()) {
            return EmailConversation::withoutGlobalScopes()->create(['company_id' => $companyId]);
        }

        if ($conversations->count() === 1) {
            return $conversations->first();
        }

        $linkedIds = EmailRecordLink::withoutGlobalScopes()
            ->whereIn('conversation_id', $conversations->modelKeys())
            ->pluck('conversation_id')
            ->all();

        $survivor = $conversations->first(fn (EmailConversation $c) => in_array($c->id, $linkedIds))
            ?? $conversations->first();
        $absorbed = array_values(array_diff($conversations->modelKeys(), [$survivor->id]));

        EmailMessage::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereIn('conversation_id', $absorbed)
            ->update(['conversation_id' => $survivor->id]);

        foreach (EmailRecordLink::withoutGlobalScopes()->whereIn('conversation_id', $absorbed)->get() as $link) {
            $alreadyThere = EmailRecordLink::withoutGlobalScopes()
                ->where('conversation_id', $survivor->id)
                ->where('linkable_type', $link->getRawOriginal('linkable_type'))
                ->where('linkable_id', $link->linkable_id)
                ->exists();

            if ($alreadyThere) {
                $link->delete();
            } else {
                $link->conversation_id = $survivor->id;
                $link->save();
            }
        }

        EmailLinkAudit::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereIn('conversation_id', $absorbed)
            ->update(['conversation_id' => $survivor->id]);

        EmailConversation::withoutGlobalScopes()->whereIn('id', $absorbed)->delete();

        return $survivor;
    }
}
