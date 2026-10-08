<?php

namespace App\Email\Http\Controllers;

use App\Email\Authorization\EmailAccess;
use App\Email\Matching\RecordVisibility;
use App\Email\Review\Handoffs;
use App\Email\Review\ReviewQueue;
use App\Email\Search\MessageSearch;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Throwable;

/**
 * The signed-in mailbox owner's private review. A copy in anyone else's
 * mailbox is simply not found. Browser / Inertia visits get the queue page;
 * JSON callers keep the list/show API shape from E-15.
 */
class ReviewController
{
    private const PER_PAGE = 25;

    private const MAX_PER_PAGE = 50;

    public function __construct(
        private readonly ReviewQueue $queue,
        private readonly RecordVisibility $visibility,
        private readonly Handoffs $handoffs,
        private readonly EmailAccess $access,
    ) {}

    public function index(Request $request): JsonResponse|InertiaResponse
    {
        $perPage = min(self::MAX_PER_PAGE, max(1, (int) $request->integer('per_page', self::PER_PAGE)));

        // Optional search within the user's own review.
        $term = $request->validate(['q' => ['nullable', 'string', 'min:'.MessageSearch::MIN_LENGTH, 'max:200']])['q'] ?? null;

        $query = $term !== null ? $this->queue->search($request->user(), $term) : $this->queue->for($request->user());
        $page = $query->orderByDesc('id')->paginate($perPage);

        $items = $this->queue->present($request->user(), $page->items(), $term);
        $meta = [
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
        ];

        if ($this->wantsPage($request)) {
            return $this->page($request->user(), $items, $meta, $term, null);
        }

        return response()->json(['items' => $items, 'meta' => $meta]);
    }

    public function show(Request $request, string $copy): JsonResponse|InertiaResponse
    {
        $found = $this->queue->for($request->user())->where('uuid', $copy)->firstOrFail();
        $item = $this->queue->present($request->user(), [$found])[0];

        if ($this->wantsPage($request)) {
            $page = $this->queue->for($request->user())->orderByDesc('id')->paginate(self::PER_PAGE);
            $items = $this->queue->present($request->user(), $page->items());

            // Deep link may land on an item outside the first page — keep it in the list.
            if (! collect($items)->contains(fn (array $row) => $row['id'] === $item['id'])) {
                array_unshift($items, $item);
            }

            return $this->page($request->user(), $items, [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ], null, $item['id']);
        }

        return response()->json(['item' => $item]);
    }

    /**
     * Leads the signed-in user may attach a review copy to. Never returns a
     * lead they cannot see — attach still re-checks on the link action.
     */
    public function candidates(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $term = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']])['q'];
        $like = '%'.$term.'%';

        $leads = Lead::withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->whereNull('deleted_at')
            ->where(function ($query) use ($like) {
                $query->where('client_name', 'like', $like)
                    ->orWhere('client_email', 'like', $like);
            })
            ->orderBy('id')
            ->limit(40)
            ->get(['id', 'company_id', 'client_name', 'client_email', 'lead_owner', 'added_by']);

        $items = $leads
            ->filter(fn (Lead $lead) => $this->visibility->canSee($user, $lead))
            ->take(10)
            ->map(fn (Lead $lead) => [
                'record_type' => 'lead',
                'record_id' => $lead->id,
                'label' => $lead->client_name ?: $lead->client_email ?: ('#'.$lead->id),
                'email' => $lead->client_email,
            ])
            ->values()
            ->all();

        return response()->json(['items' => $items]);
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array{current_page: int, last_page: int, per_page: int, total: int}  $meta
     */
    private function page(User $user, array $items, array $meta, ?string $q, ?string $focusId): InertiaResponse
    {
        return Inertia::render('Email/ReviewQueue', [
            'items' => $items,
            'meta' => $meta,
            'q' => $q,
            'focusId' => $focusId,
            'canCreateLead' => $this->mayAddLeads($user),
            'canViewWorkReport' => $this->access->canViewWorkReport($user),
            'incomingHandoffs' => $this->handoffs->presentIncoming($user),
        ]);
    }

    private function mayAddLeads(User $user): bool
    {
        try {
            return in_array($user->permission('add_lead'), ['all', 'added'], true);
        } catch (Throwable) {
            return false;
        }
    }

    /** Browser and Inertia visits get the page; axios / getJson keep the API. */
    private function wantsPage(Request $request): bool
    {
        if ($request->header('X-Inertia')) {
            return true;
        }

        if ($request->expectsJson()) {
            return false;
        }

        return $request->acceptsHtml();
    }
}
