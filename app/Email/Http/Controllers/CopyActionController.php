<?php

namespace App\Email\Http\Controllers;

use App\Email\Enums\LinkableType;
use App\Email\Matching\RecordVisibility;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Review\ReviewActions;
use App\Email\Review\ReviewQueue;
use App\Models\Lead;
use App\Models\User;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        private readonly RecordVisibility $visibility,
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

        $class = LinkableType::from($input['record_type'])->modelClass();

        $record = $class::withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->when($class === Lead::class, fn ($query) => $query->whereNull('deleted_at'))
            ->find((int) $input['record_id']);

        abort_if($record === null || ! $this->visibility->canSee($user, $record), 404);

        return $record;
    }

    private function respond(EmailMailboxCopy $copy): JsonResponse
    {
        return response()->json([
            'copy' => [
                'id' => $copy->uuid,
                'review_status' => $copy->review_status->value,
                'linked' => $this->actions->isLinked($copy),
            ],
        ]);
    }
}
