<?php

namespace App\Email\Http\Controllers;

use App\Email\Linking\RecordHistory;
use App\Email\Matching\RecordResolver;
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
}
