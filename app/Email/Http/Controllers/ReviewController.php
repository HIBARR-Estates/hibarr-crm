<?php

namespace App\Email\Http\Controllers;

use App\Email\Review\ReviewQueue;
use App\Email\Search\MessageSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The signed-in mailbox owner's private review. A copy in anyone else's
 * mailbox is simply not found.
 */
class ReviewController
{
    private const PER_PAGE = 25;

    private const MAX_PER_PAGE = 50;

    public function __construct(private readonly ReviewQueue $queue) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min(self::MAX_PER_PAGE, max(1, (int) $request->integer('per_page', self::PER_PAGE)));

        // Optional search within the user's own review.
        $term = $request->validate(['q' => ['nullable', 'string', 'min:'.MessageSearch::MIN_LENGTH, 'max:200']])['q'] ?? null;

        $query = $term !== null ? $this->queue->search($request->user(), $term) : $this->queue->for($request->user());
        $page = $query->orderByDesc('id')->paginate($perPage);

        return response()->json([
            'items' => $this->queue->present($request->user(), $page->items(), $term),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function show(Request $request, string $copy): JsonResponse
    {
        $found = $this->queue->for($request->user())->where('uuid', $copy)->firstOrFail();

        return response()->json(['item' => $this->queue->present($request->user(), [$found])[0]]);
    }
}
