<?php

namespace App\Email\Http\Controllers;

use App\Email\Authorization\EmailAccess;
use App\Email\Linking\RecordHistory;
use App\Email\Matching\RecordResolver;
use App\Email\Reads\ReadState;
use App\Email\Search\MessageSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Email history of one lead or deal for the signed-in user. A record they
 * may not see is simply not found.
 */
class RecordHistoryController
{
    private const PER_PAGE = 50;

    private const MAX_PER_PAGE = 100;

    public function __construct(
        private readonly RecordResolver $records,
        private readonly RecordHistory $history,
        private readonly ReadState $reads,
        private readonly EmailAccess $access,
    ) {}

    public function index(Request $request, string $type, string $id): JsonResponse
    {
        $record = $this->records->find($request->user(), $type, (int) $id);

        abort_if($record === null, 404);

        $perPage = min(self::MAX_PER_PAGE, max(1, (int) $request->integer('per_page', self::PER_PAGE)));

        $page = $this->history->for($request->user(), $record, $perPage);

        return response()->json([
            'events' => $this->history->present($request->user(), $page->items()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * Compact Timeline groups: one conversation per row (latest, count, status)
     * with dated messages for expand. Not a flat history list.
     */
    public function timeline(Request $request, string $type, string $id): JsonResponse
    {
        $record = $this->records->find($request->user(), $type, (int) $id);

        abort_if($record === null, 404);

        return response()->json([
            'groups' => $this->history->timelineGroups($request->user(), $record),
        ]);
    }

    /** Search within the mail the user may read on this record: participants, subject, body, file names. */
    public function search(Request $request, string $type, string $id): JsonResponse
    {
        $record = $this->records->find($request->user(), $type, (int) $id);

        abort_if($record === null, 404);

        $term = $request->validate(['q' => ['required', 'string', 'min:'.MessageSearch::MIN_LENGTH, 'max:200']])['q'];
        $perPage = min(self::MAX_PER_PAGE, max(1, (int) $request->integer('per_page', self::PER_PAGE)));

        $page = $this->history->search($request->user(), $record, $term, $perPage);

        return response()->json([
            'events' => $this->history->present($request->user(), $page->items(), $term),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /** Full conversation for the record email drawer (oldest → newest). */
    public function conversation(Request $request, string $type, string $id, string $conversation): JsonResponse
    {
        $record = $this->records->find($request->user(), $type, (int) $id);

        abort_if($record === null, 404);

        $focus = $request->validate(['message' => ['nullable', 'uuid']])['message'] ?? null;
        $payload = $this->history->conversation($request->user(), $record, $conversation, $focus);

        abort_if($payload === null, 404);

        $this->markFocusRead($request, $payload);

        return response()->json($payload);
    }

    /** Deep link: open the conversation that contains this message on the record. */
    public function message(Request $request, string $type, string $id, string $message): JsonResponse
    {
        $record = $this->records->find($request->user(), $type, (int) $id);

        abort_if($record === null, 404);

        $payload = $this->history->conversationByMessage($request->user(), $record, $message);

        abort_if($payload === null, 404);

        $this->markFocusRead($request, $payload);

        return response()->json($payload);
    }

    /** @param  array<string, mixed>  $payload */
    private function markFocusRead(Request $request, array $payload): void
    {
        $focusId = $payload['focus_message_id'] ?? null;
        if (! is_string($focusId)) {
            return;
        }

        $message = $this->access->findMessage($focusId);
        if ($message !== null && $this->access->canViewMessage($request->user(), $message)) {
            $this->reads->markRead($request->user(), $message);
        }
    }
}
