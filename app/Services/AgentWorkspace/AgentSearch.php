<?php

namespace App\Services\AgentWorkspace;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\DealNote;
use App\Models\LeadLifecycleStatus;
use App\Models\LeadNote;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use App\Services\LeadService;
use App\Services\PermissionService;
use App\Services\TaskVisibilityService;
use App\Support\PermissionGates;
use App\Support\TaskPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The agent workspace's search (L7-23 dropdown, L7-24 results). One word,
 * looked for in the six places the boards name, each through the rules that
 * place already has: the Leads index's own search and visibility, the Deals
 * view_deals scope, the Portfolio's published-or-yours rule, the Tasks and
 * meetings visibility scopes. Notes are the agent's own, since there is no
 * shared note-visibility rule to run on.
 */
class AgentSearch
{
    public const GROUPS = ['people', 'deals', 'properties', 'tasks', 'meetings', 'notes'];

    public const MIN_LENGTH = 2;

    /** Longest query looked up; anything beyond is cut, not rejected. */
    public const MAX_LENGTH = 80;

    public function __construct(private LeadService $leads, private ContactDeals $contactDeals) {}

    public static function clean(mixed $query): string
    {
        if (! is_scalar($query)) {
            return '';
        }

        return Str::limit(trim((string) preg_replace('/\s+/u', ' ', (string) $query)), self::MAX_LENGTH, '');
    }

    /**
     * @param  list<string>  $groups  which groups to fetch rows for (counts are always for every group)
     * @return array{query: string, counts: array<string, int>, total: int, groups: array<string, list<array<string, mixed>>>}
     */
    public function search(string $query, int $limit, array $groups = self::GROUPS): array
    {
        $groups = array_values(array_intersect(self::GROUPS, $groups));
        $counts = array_fill_keys(self::GROUPS, 0);
        $rows = array_fill_keys(self::GROUPS, []);

        if (mb_strlen($query) < self::MIN_LENGTH) {
            return ['query' => $query, 'counts' => $counts, 'total' => 0, 'groups' => $rows];
        }

        $user = user();

        foreach (self::GROUPS as $group) {
            $take = in_array($group, $groups, true) ? $limit : 0;
            // One source failing must not blank the rest of the answer: it is reported, and its group comes back empty.
            try {
                [$counts[$group], $rows[$group]] = $this->{'find'.ucfirst($group)}($query, $take, $user);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return ['query' => $query, 'counts' => $counts, 'total' => array_sum($counts), 'groups' => $rows];
    }

    /** @return array{0: int, 1: list<array<string, mixed>>} */
    private function findPeople(string $query, int $take, User $user): array
    {
        if (! in_array($user->permission('view_lead'), ['all', 'added', 'owned', 'both'], true)) {
            return [0, []];
        }

        $request = Request::create('/', 'GET', ['search' => $query, 'per_page' => max(1, $take), 'sort_by' => 'created_at', 'sort_direction' => 'desc']);
        $page = $this->leads->getPaginatedLeads($request);
        $total = (int) $page->total();
        if ($take === 0) {
            return [$total, []];
        }

        $items = collect($page->items());
        $statuses = LeadLifecycleStatus::query()->get(['id', 'label', 'label_color'])->keyBy('id');
        $deals = $this->contactDeals->openForLeads($items->pluck('id')->map(fn ($id) => (int) $id)->all(), $user);

        return [$total, $items->take($take)->map(function ($lead) use ($statuses, $deals) {
            $status = $statuses[$lead->lead_lifecycle_status_id] ?? null;

            return [
                'id' => (int) $lead->id,
                'name' => $lead->client_name,
                'status' => $status?->label,
                'status_color' => $status?->label_color,
                'phone' => trim((string) ($lead->mobile ?: ($lead->cell ?: $lead->office))),
                'owner_id' => $lead->lead_owner ? (int) $lead->lead_owner : null,
                'owner_name' => $lead->leadOwner?->name,
                'deals' => count($deals[(int) $lead->id] ?? []),
            ];
        })->values()->all()];
    }

    /** @return array{0: int, 1: list<array<string, mixed>>} */
    private function findDeals(string $query, int $take, User $user): array
    {
        if (! in_array($user->permission('view_deals'), ['all', 'added', 'owned', 'both'], true)) {
            return [0, []];
        }

        $builder = Deal::query()->where(function (Builder $q) use ($query) {
            $q->where('deals.name', 'like', $this->like($query))
                ->orWhereHas('contact', fn (Builder $c) => $c->where('client_name', 'like', $this->like($query)));
        });

        PermissionService::applyScope($builder, $user, 'view_deals', [
            'added' => 'deals.added_by',
            'owned' => function ($q, $user) {
                $q->where(function ($query) use ($user) {
                    $query->whereHas('leadAgent', fn ($q) => $q->where('user_id', $user->id))
                        ->orWhereHas('dealParticipants', fn ($q) => $q->where('users.id', $user->id))
                        ->orWhereHas('dealWatchers', fn ($q) => $q->where('users.id', $user->id));
                });
            },
        ]);

        $total = (clone $builder)->count();
        if ($take === 0) {
            return [$total, []];
        }

        $deals = $builder
            ->with(['leadStage:id,name,label_color', 'pipeline:id,name', 'leadAgent.user:id,name', 'currency:id,currency_symbol', 'contact:id,client_name'])
            ->addSelect(['deals.*', 'next_meeting_at' => DealFollowUp::query()
                ->selectRaw('MIN(lead_follow_up.next_follow_up_date)')
                ->whereColumn('lead_follow_up.deal_id', 'deals.id')
                ->where('lead_follow_up.next_follow_up_date', '>=', now())
                ->where(fn ($q) => $q->whereNull('lead_follow_up.status')->orWhereNotIn('lead_follow_up.status', ['cancelled', 'completed'])),
            ])
            ->orderByRaw('deals.outcome_status IS NOT NULL')
            ->orderByDesc('deals.id')
            ->limit($take)
            ->get();

        return [$total, $deals->map(function (Deal $deal) use ($user) {
            $agentUserId = $deal->leadAgent?->user_id ? (int) $deal->leadAgent->user_id : null;
            $mine = $agentUserId === (int) $user->id || (int) $deal->added_by === (int) $user->id;

            return [
                'id' => (int) $deal->id,
                'lead_id' => $deal->lead_id ? (int) $deal->lead_id : null,
                'name' => $deal->name,
                'person' => $deal->contact?->client_name,
                'pipeline' => $deal->pipeline?->name,
                'stage' => $deal->leadStage?->name,
                'stage_color' => $deal->leadStage?->label_color,
                'outcome' => $deal->outcome_status instanceof \BackedEnum ? $deal->outcome_status->value : $deal->outcome_status,
                'value' => $deal->value !== null ? (float) $deal->value : null,
                'currency' => $deal->currency?->currency_symbol,
                'agent_name' => $deal->leadAgent?->user?->name,
                // Seen through the "all deals" permission rather than as the agent's own.
                'read_only' => ! $mine || (bool) $deal->is_locked,
                'next_meeting_at' => $deal->getRawOriginal('next_meeting_at')
                    ? \Carbon\Carbon::parse($deal->getRawOriginal('next_meeting_at'), config('app.timezone'))->toIso8601String()
                    : null,
            ];
        })->values()->all()];
    }

    /** @return array{0: int, 1: list<array<string, mixed>>} */
    private function findProperties(string $query, int $take, User $user): array
    {
        $view = $user->permission('view_product');
        if (! PermissionGates::canManageProperties($user) && ! in_array($view, ['all', 'added', 'owned', 'both', 4, 1], true)) {
            return [0, []];
        }

        $builder = Property::query()->where(function (Builder $q) use ($query) {
            foreach (['title', 'city', 'area'] as $column) {
                $q->orWhere($column, 'like', $this->like($query));
            }
        });

        if (! PermissionGates::canManageProperties($user)) {
            $builder->where(fn ($q) => $q
                ->where('is_published', true)
                ->orWhere('added_by', $user->id)
                ->orWhere('responsible_agent_id', $user->id));
        }

        $total = (clone $builder)->count();
        if ($take === 0) {
            return [$total, []];
        }

        $items = $builder
            ->with(array_merge(PortfolioPresenter::PROPERTY_RELATIONS, PortfolioPresenter::photoRelation()))
            ->orderByDesc('id')
            ->limit($take)
            ->get();

        return [$total, $items->map(fn (Property $p) => PortfolioPresenter::property($p))->values()->all()];
    }

    /** @return array{0: int, 1: list<array<string, mixed>>} */
    private function findTasks(string $query, int $take, User $user): array
    {
        $view = $user->permission('view_tasks');
        if (! in_array($view, ['all', 'added', 'owned', 'both'], true)) {
            return [0, []];
        }

        $builder = Task::query()->pending()->where(fn ($q) => $q->where('tasks.heading', 'like', $this->like($query)));
        if ($view !== 'all') {
            TaskVisibilityService::scopeVisibleToUser($builder, (int) $user->id);
        }

        $total = (clone $builder)->count();
        if ($take === 0) {
            return [$total, []];
        }

        $tasks = $builder
            ->with(TaskPresenter::RELATIONS)
            ->withCount(TaskPresenter::COUNTS)
            ->orderByRaw('tasks.due_date IS NULL')
            ->orderBy('tasks.due_date')
            ->limit($take)
            ->get();

        return [$total, app(\App\Services\Dashboard\DashboardMetricsService::class)->presentTasks($tasks)];
    }

    /** @return array{0: int, 1: list<array<string, mixed>>} */
    private function findMeetings(string $query, int $take, User $user): array
    {
        $builder = DealFollowUp::query()
            ->visibleToUser((int) $user->id)
            ->where('status', '<>', 'cancelled')
            ->where(function (Builder $q) use ($query) {
                $q->whereHas('deal', fn (Builder $d) => $d->where('name', 'like', $this->like($query)))
                    ->orWhereHas('lead', fn (Builder $l) => $l->where('client_name', 'like', $this->like($query)))
                    ->orWhereHas('deal.contact', fn (Builder $c) => $c->where('client_name', 'like', $this->like($query)));
            });

        $total = (clone $builder)->count();
        if ($take === 0) {
            return [$total, []];
        }

        $meetings = $builder
            ->with(['deal:id,name,lead_id', 'deal.contact:id,client_name', 'lead:id,client_name', 'meetingType'])
            ->orderByDesc('next_follow_up_date')
            ->limit($take)
            ->get();

        return [$total, $meetings->map(fn (DealFollowUp $m) => [
            'id' => (int) $m->id,
            'title' => $m->deal?->name ?? $m->lead?->client_name ?? 'Meeting',
            'person' => $m->lead?->client_name ?? $m->deal?->contact?->client_name,
            'type' => $m->meetingType?->name,
            'at' => $m->next_follow_up_date?->toIso8601String(),
            'duration' => $m->getEffectiveDuration(),
            'where' => $m->location ?: ($m->meeting_link ? 'Online' : null),
            'lead_id' => $m->lead_id ? (int) $m->lead_id : ($m->deal?->lead_id ? (int) $m->deal->lead_id : null),
            'deal_id' => $m->deal_id ? (int) $m->deal_id : null,
        ])->values()->all()];
    }

    /** @return array{0: int, 1: list<array<string, mixed>>} */
    private function findNotes(string $query, int $take, User $user): array
    {
        $leadNotes = LeadNote::query()->where('added_by', $user->id)->where('details', 'like', $this->like($query));
        $dealNotes = DealNote::query()->where('added_by', $user->id)->where('details', 'like', $this->like($query));
        $total = (clone $leadNotes)->count() + (clone $dealNotes)->count();
        if ($take === 0) {
            return [$total, []];
        }

        $rows = $leadNotes->with('lead:id,client_name')->latest('id')->limit($take)->get()->map(fn (LeadNote $n) => [
            'id' => (int) $n->id,
            'kind' => 'lead',
            'subject' => $n->lead?->client_name,
            'snippet' => $this->snippet((string) $n->details, $query),
            'at' => $n->created_at?->toIso8601String(),
            'lead_id' => $n->lead_id ? (int) $n->lead_id : null,
            'deal_id' => null,
        ])->concat($dealNotes->with('deal:id,name,lead_id')->latest('id')->limit($take)->get()->map(fn (DealNote $n) => [
            'id' => (int) $n->id,
            'kind' => 'deal',
            'subject' => $n->deal?->name,
            'snippet' => $this->snippet((string) $n->details, $query),
            'at' => $n->created_at?->toIso8601String(),
            'lead_id' => $n->deal?->lead_id ? (int) $n->deal->lead_id : null,
            'deal_id' => $n->deal_id ? (int) $n->deal_id : null,
        ]))->sortByDesc('at')->take($take)->values()->all();

        return [$total, $rows];
    }

    /** A note's text around the match, plain, so the row can show it in quotes. */
    private function snippet(string $html, string $query): string
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($html))));
        $at = mb_stripos($text, $query);
        if ($at === false || mb_strlen($text) <= 90) {
            return Str::limit($text, 90);
        }

        $start = max(0, $at - 30);

        return ($start > 0 ? '…' : '').trim(mb_substr($text, $start, 90)).(mb_strlen($text) > $start + 90 ? '…' : '');
    }

    private function like(string $query): string
    {
        return '%'.addcslashes($query, '\\%_').'%';
    }
}
