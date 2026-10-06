<?php

namespace App\Email\Http\Controllers;

use App\Email\Enums\LinkableType;
use App\Email\Exceptions\DuplicateLeadException;
use App\Email\Matching\RecordResolver;
use App\Email\Matching\RecordVisibility;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Review\CreateLeadFromCopy;
use App\Email\Review\ReviewActions;
use App\Email\Review\ReviewQueue;
use App\Models\User;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Throwable;

/**
 * Link, unlink and dismiss for the signed-in user's own mailbox copies. A
 * copy in someone else's mailbox, and a record the user may not see, are
 * both simply not found.
 */
class CopyActionController
{
    public function __construct(
        private readonly ReviewQueue $queue,
        private readonly ReviewActions $actions,
        private readonly RecordResolver $records,
        private readonly RecordVisibility $visibility,
        private readonly CreateLeadFromCopy $createLead,
    ) {}

    public function link(Request $request, string $copy): JsonResponse
    {
        $found = $this->find($request, $copy);
        $record = $this->record($request);

        return $this->respond($this->actions->link($request->user(), $found, $record));
    }

    public function unlink(Request $request, string $copy): JsonResponse
    {
        $found = $this->find($request, $copy);
        $record = $this->record($request);

        return $this->respond($this->actions->unlink($request->user(), $found, $record));
    }

    public function dismiss(Request $request, string $copy): JsonResponse
    {
        $found = $this->find($request, $copy);

        try {
            return $this->respond($this->actions->dismiss($request->user(), $found));
        } catch (DomainException) {
            return response()->json(['message' => 'not_in_review'], 409);
        }
    }

    /**
     * Creates a lead for the other party and links the conversation to it.
     * When a lead already holds the address nothing is created: the answer
     * says so, and names the lead only if the user may see it, so they can
     * link to it instead.
     */
    public function createLead(Request $request, string $copy): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $found = $this->find($request, $copy);

        abort_unless($this->mayAddLeads($user), 403);

        $input = $request->validate(['client_name' => ['nullable', 'string', 'max:255']]);

        try {
            $lead = $this->createLead->handle($user, $found, $input['client_name'] ?? null);
        } catch (DuplicateLeadException $exception) {
            return response()->json([
                'message' => 'duplicate_lead',
                'record_exists' => true,
                'candidates' => $exception->duplicates
                    ->filter(fn ($duplicate) => $this->visibility->canSee($user, $duplicate))
                    ->map(fn ($duplicate) => ['record_type' => LinkableType::Lead->value, 'record_id' => $duplicate->id])
                    ->values()
                    ->all(),
            ], 409);
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return response()->json([
            'copy' => $this->present($found->refresh()),
            'record' => ['record_type' => LinkableType::Lead->value, 'record_id' => $lead->id],
        ], 201);
    }

    private function mayAddLeads(User $user): bool
    {
        try {
            return in_array($user->permission('add_lead'), ['all', 'added'], true);
        } catch (Throwable) {
            return false;
        }
    }

    private function find(Request $request, string $uuid): EmailMailboxCopy
    {
        return $this->queue->owned($request->user())->where('uuid', $uuid)->firstOrFail();
    }

    /** A record in the user's company that they may see; anything else is a 404. */
    private function record(Request $request): Model
    {
        /** @var User $user */
        $user = $request->user();

        $input = $request->validate([
            'record_type' => ['required', 'string', Rule::enum(LinkableType::class)],
            'record_id' => ['required', 'integer', 'min:1'],
        ]);

        $record = $this->records->find($user, $input['record_type'], (int) $input['record_id']);

        abort_if($record === null, 404);

        return $record;
    }

    private function respond(EmailMailboxCopy $copy): JsonResponse
    {
        return response()->json(['copy' => $this->present($copy)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(EmailMailboxCopy $copy): array
    {
        return [
            'id' => $copy->uuid,
            'review_status' => $copy->review_status->value,
            'linked' => $this->actions->isLinked($copy),
        ];
    }
}
