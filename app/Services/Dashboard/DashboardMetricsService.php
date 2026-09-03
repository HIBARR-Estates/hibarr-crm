<?php

namespace App\Services\Dashboard;

use App\Enums\MlmCommissionStatus;
use App\Models\CrmEvent;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadSetting;
use App\Models\LeadSource;
use App\Models\MlmCommission;
use App\Models\PartnerFlag;
use App\Models\PipelineStage;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Services\CrmEventService;
use App\Services\MlmCommissionService;
use App\Support\FeatureFlags;
use App\Support\TaskPresenter;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Query layer behind the v2 dashboards.
 *
 * Every method takes an explicit scope (a user id, or a set of lead_agent ids)
 * rather than reading auth() internally — the same query serves the agent view
 * scoped to one person and the manager view scoped to a team, which is what
 * keeps this from becoming four parallel dashboards.
 *
 * Company scoping is automatic via CompanyScope on Lead, Deal, Task and
 * LeadAgent. It is NOT on DealFollowUp or MlmCommission, so anything touching
 * those must constrain by owning user or join through a scoped model.
 *
 * Only metrics the data actually supports are here. Notably absent, and
 * deliberately so: quota/target progress (no targets exist anywhere) and
 * cost-per-lead / channel ROI (no spend data is fed into the CRM).
 */
class DashboardMetricsService
{
    /**
     * Rows shipped per queue bucket. The true totals travel separately in
     * `counts`, so this only bounds the payload, never the numbers on screen.
     */
    private const QUEUE_ROWS = 25;

    /**
     * The date from which lead_follow_up.status is trusted for "was this
     * meeting held". Set to the deploy date of the Mark held button — before
     * it, nothing wrote 'completed' through a working path.
     *
     * Expect the meetings KPI to read low for a few weeks after this date while
     * agents learn the button, and the trend arrow to point down for reasons
     * that are not real. That is the cost of the number becoming true.
     */
    private const STATUS_TRUSTED_FROM = '2026-08-15';

    /**
     * Open referred deals a partner needs before their commission forecast is
     * shown as a number. Below this it is trivially back-derivable to a deal
     * value, which the partner must not see.
     */
    private const FORECAST_MIN_DEALS = 3;

    /**
     * Bounds on the configurable first-contact SLA, in hours. One hour is the
     * tightest that means anything for a human callback; 720 (30 days) is well
     * past the point the metric stops being an SLA. Anything outside falls back
     * to the default rather than being clamped to an edge — an out-of-range
     * value is a mistake, and silently reading it as "1 hour" would flip the
     * whole team red.
     */
    public const SLA_HOURS_MIN = 1;

    public const SLA_HOURS_MAX = 720;

    public const SLA_HOURS_DEFAULT = 24;

    /** Memoised firstContactTrackingSince(); null is a real answer, hence the flag. */
    private ?Carbon $trackingSince = null;

    private bool $trackingSinceResolved = false;

    /**
     * Lead agent ids a manager's view covers: themselves plus their direct reports.
     *
     * ponytail: one level deep via lead_agents.parent_agent_id. The agent_hierarchy
     * closure table would give arbitrary depth but is currently empty (0 rows), so
     * using it would silently return no team at all. Swap to it once it's backfilled.
     */
    public function teamAgentIds(int $userId): array
    {
        $agent = LeadAgent::where('user_id', $userId)->first();

        if (! $agent) {
            return [];
        }

        return LeadAgent::where('id', $agent->id)
            ->orWhere('parent_agent_id', $agent->id)
            ->pluck('id')
            ->all();
    }

    // ── Agent view ───────────────────────────────────────────────

    /**
     * The ranked "what do I do first" list. Ordering is deliberate: things that
     * are already late outrank things that are merely hot.
     *
     * `counts` are the true totals; the row arrays are capped. An agent with 95
     * overdue tasks needs to be told 95 — counting the rows we chose to ship
     * would quietly under-report exactly the people in most trouble.
     */
    public function actionQueue(int $userId): array
    {
        $agentIds = $this->agentIdsForUser($userId);

        return [
            'overdueTasks' => $this->overdueTasks($userId),
            'hotLeads' => $this->hotLeadsNeedingContact($userId),
            // Correct, and permanently empty: stalled-ness is read from
            // pipeline_stages.target_duration_days, which is NULL on every
            // stage today. Configured, not inferred — leave the bucket alone
            // rather than "fixing" it with a guess. noNextStep below is the
            // signal that actually lights up.
            'stalledDeals' => $this->stalledDeals($agentIds),
            'noNextStep' => $this->recordsWithoutNextStep($userId),
            'counts' => [
                'overdueTasks' => $this->overdueTaskQuery($userId)->count(),
                'hotLeads' => $this->hotLeadQuery($userId)->count(),
                'stalledDeals' => $this->stalledDealQuery($agentIds)?->count() ?? 0,
                'noNextStep' => $this->recordsWithoutNextStepCount($userId, $agentIds),
            ],
        ];
    }

    /**
     * Open records the agent owns that nobody has committed a next action on.
     *
     * Replaces the "no activity for N days" guess. Silence is not the same as
     * neglect — a quiet deal may simply be waiting on a notary — but a record
     * with no open next-step task is unambiguous, because somebody had to
     * deliberately not nominate one.
     *
     * @return array<int, array{type: string, id: int, name: string, days_open: int}>
     */
    private function recordsWithoutNextStep(int $userId, int $limit = self::QUEUE_ROWS): array
    {
        $leads = $this->leadsWithoutNextStep($userId)
            ->orderBy('leads.created_at')
            ->limit($limit)
            ->get(['leads.id', 'leads.client_name as name', 'leads.created_at'])
            ->map(fn ($row) => [
                'type' => 'lead',
                'id' => (int) $row->id,
                'name' => $row->name,
                'days_open' => (int) Carbon::parse($row->created_at)->diffInDays(now()),
            ]);

        $deals = $this->dealsWithoutNextStep($this->agentIdsForUser($userId))
            ?->orderBy('deals.created_at')
            ->limit($limit)
            ->get(['deals.id', 'deals.name', 'deals.created_at'])
            ->map(fn ($row) => [
                'type' => 'deal',
                'id' => (int) $row->id,
                'name' => $row->name,
                'days_open' => (int) Carbon::parse($row->created_at)->diffInDays(now()),
            ]) ?? collect();

        return $leads->concat($deals)
            ->sortByDesc('days_open')
            ->take($limit)
            ->values()
            ->all();
    }

    private function recordsWithoutNextStepCount(int $userId, array $agentIds): int
    {
        return $this->leadsWithoutNextStep($userId)->count()
            + ($this->dealsWithoutNextStep($agentIds)?->count() ?? 0);
    }

    private function leadsWithoutNextStep(int $userId)
    {
        return Lead::query()
            ->where('lead_owner', $userId)
            ->whereNull('first_contacted_at')
            ->whereNotExists($this->openNextStepFor('leads.id', Lead::class))
            ->toBase();
    }

    private function dealsWithoutNextStep(array $agentIds)
    {
        if (empty($agentIds)) {
            return null;
        }

        return Deal::query()
            ->whereIn('deals.agent_id', $agentIds)
            ->whereNull('deals.outcome_status')
            ->whereNotExists($this->openNextStepFor('deals.id', Deal::class))
            ->toBase();
    }

    /**
     * Correlated subquery: does this record have an open next-step task?
     *
     * "Open" means not in the done column and not soft-deleted — a completed
     * next step is history, and the record needs a new one.
     */
    private function openNextStepFor(string $column, string $type): callable
    {
        $doneColumnId = TaskboardColumn::completeColumn()?->id;

        return function ($sub) use ($column, $type, $doneColumnId) {
            $sub->selectRaw('1')
                ->from('taskables')
                ->join('tasks', 'tasks.id', '=', 'taskables.task_id')
                ->whereColumn('taskables.taskable_id', $column)
                ->where('taskables.taskable_type', $type)
                ->where('tasks.is_next_step', true)
                ->whereNull('tasks.deleted_at')
                ->when($doneColumnId, fn ($q) => $q->where('tasks.board_column_id', '<>', $doneColumnId));
        };
    }

    /**
     * Overdue tasks, each carrying the CRM record it hangs off.
     *
     * The linked record is what makes the queue readable: 18 of one agent's 23
     * overdue tasks belong to a single lead, so without it the list reads as 23
     * separate problems instead of one.
     *
     * Rows are full tasks via toFrontendArray() rather than a trimmed shape,
     * because the queue opens TaskDetailModal in place — which needs
     * description, priority, assignees and the board column — and because
     * tasks.store/tasks.update return exactly this, so a row and a post-save
     * patch are the same object.
     */
    private function overdueTaskQuery(int $userId)
    {
        return Task::query()
            ->pending()
            ->visibleToUser($userId)
            ->whereNotNull('due_date')
            ->where('due_date', '<', now());
    }

    private function overdueTasks(int $userId): array
    {
        $tasks = $this->overdueTaskQuery($userId)
            ->with(['users:id,name,image', 'boardColumn:id,slug,column_name'])
            ->orderBy('due_date')
            ->limit(self::QUEUE_ROWS)
            ->get();

        $related = $this->relatedRecords($tasks->pluck('id')->all());

        return $tasks
            ->map(fn (Task $task) => $task->toFrontendArray() + [
                'days_overdue' => (int) now()->startOfDay()->diffInDays(
                    Carbon::parse($task->due_date)->startOfDay()
                ),
                'related' => $related[$task->id] ?? null,
            ])
            ->all();
    }

    /**
     * task id => {type, id, name} for the Lead/Deal a task is attached to.
     *
     * ponytail: two lookups rather than a polymorphic eager-load, because
     * `taskables` is a plain pivot with no Eloquent morph relation defined on
     * Task. Only the first attachment per task is used — the UI groups by one
     * owning record, and multi-attach is rare here.
     */
    private function relatedRecords(array $taskIds): array
    {
        if (empty($taskIds)) {
            return [];
        }

        $links = DB::table('taskables')
            ->whereIn('task_id', $taskIds)
            ->whereIn('taskable_type', [Lead::class, Deal::class])
            ->get(['task_id', 'taskable_type', 'taskable_id']);

        $leadNames = Lead::whereIn('id', $links->where('taskable_type', Lead::class)->pluck('taskable_id'))
            ->pluck('client_name', 'id');
        $dealNames = Deal::whereIn('id', $links->where('taskable_type', Deal::class)->pluck('taskable_id'))
            ->pluck('name', 'id');

        $out = [];

        foreach ($links as $link) {
            if (isset($out[$link->task_id])) {
                continue;
            }

            $isLead = $link->taskable_type === Lead::class;
            $name = $isLead
                ? $leadNames->get($link->taskable_id)
                : $dealNames->get($link->taskable_id);

            if ($name === null) {
                continue;
            }

            $out[$link->task_id] = [
                'type' => $isLead ? 'lead' : 'deal',
                'id' => (int) $link->taskable_id,
                'name' => $name,
            ];
        }

        return $out;
    }

    /**
     * Hot/warm leads the agent owns that have never been contacted. Uses the
     * first_contacted_at stamp — NULL genuinely means "no agent activity yet".
     */
    private function hotLeadQuery(int $userId)
    {
        return Lead::query()
            ->where('lead_owner', $userId)
            ->whereNull('first_contacted_at')
            ->whereIn('temperature', ['hot', 'warm']);
    }

    private function hotLeadsNeedingContact(int $userId): array
    {
        return $this->hotLeadQuery($userId)
            ->orderByRaw("FIELD(temperature, 'hot', 'warm')")
            ->orderBy('created_at')
            ->limit(self::QUEUE_ROWS)
            ->get(['id', 'client_name', 'temperature', 'created_at'])
            ->map(fn (Lead $lead) => [
                'id' => $lead->id,
                'client_name' => $lead->client_name,
                'temperature' => $lead->temperature?->value,
                'waiting_hours' => (int) $lead->created_at->diffInHours(now()),
            ])
            ->all();
    }

    /**
     * Deals sitting in a stage longer than that stage's configured target.
     * Stages with no target_duration_days are never flagged — configured, not
     * inferred, so the screen can't invent a bottleneck that nobody agreed on.
     */
    private function stalledDealQuery(array $agentIds)
    {
        if (empty($agentIds)) {
            return null;
        }

        return Deal::query()
            ->join('pipeline_stages', 'pipeline_stages.id', '=', 'deals.pipeline_stage_id')
            ->whereIn('deals.agent_id', $agentIds)
            ->whereNull('deals.outcome_status')
            ->whereNotNull('pipeline_stages.target_duration_days')
            ->whereNotNull('deals.stage_entered_at')
            ->whereRaw('deals.stage_entered_at < DATE_SUB(NOW(), INTERVAL pipeline_stages.target_duration_days DAY)');
    }

    public function stalledDeals(array $agentIds): array
    {
        $query = $this->stalledDealQuery($agentIds);

        if (is_null($query)) {
            return [];
        }

        return $query
            ->orderBy('deals.stage_entered_at')
            ->limit(self::QUEUE_ROWS)
            // Joined stage columns are aliases, not Deal attributes.
            ->toBase()
            ->get([
                'deals.id',
                'deals.name',
                'deals.stage_entered_at',
                'pipeline_stages.name as stage_name',
                'pipeline_stages.target_duration_days',
            ])
            ->map(fn ($deal) => [
                'id' => $deal->id,
                'name' => $deal->name,
                'stage_name' => $deal->stage_name,
                'days_in_stage' => (int) Carbon::parse($deal->stage_entered_at)->diffInDays(now()),
                'target_days' => (int) $deal->target_duration_days,
            ])
            ->all();
    }

    /**
     * The week strip: what the agent actually did, not what they were assigned.
     *
     * "Activities logged" from the design has no single home in this schema —
     * `communication_activities` is empty and `deal_histories` only covers the
     * deal side — so the strip counts the three things that are unambiguously
     * recorded (meetings, deals, first contacts) plus the response median.
     */
    public function agentWeek(int $userId): array
    {
        $start = now()->startOfWeek();
        $agentIds = $this->agentIdsForUser($userId);

        $responseMinutes = Lead::query()
            ->where('lead_owner', $userId)
            ->whereNotNull('assigned_at')
            ->whereNotNull('first_contacted_at')
            ->where('first_contacted_at', '>=', $start)
            ->toBase()
            ->selectRaw('TIMESTAMPDIFF(MINUTE, assigned_at, first_contacted_at) as minutes')
            ->pluck('minutes')
            ->all();

        $medianMinutes = $this->median(array_map('intval', $responseMinutes));

        return [
            'weekStart' => $start->toDateString(),
            'meetings' => $this->heldMeetings()
                ->visibleToUser($userId)
                ->where('next_follow_up_date', '>=', $start)
                ->count(),
            'dealsCreated' => Deal::query()
                ->whereIn('agent_id', $agentIds ?: [0])
                ->where('created_at', '>=', $start)
                ->count(),
            'leadsContacted' => Lead::query()
                ->where('lead_owner', $userId)
                ->where('first_contacted_at', '>=', $start)
                ->count(),
            'medianResponseMinutes' => $medianMinutes === null ? null : (int) round($medianMinutes),
        ];
    }

    /**
     * Today's and tomorrow's meetings for the agent.
     *
     * Follow-ups are the meeting record here (`lead_follow_up`); there is no
     * separate Meeting entity. Cancelled ones are dropped, everything else is
     * shown with the status it carries.
     *
     * Rows are full follow-ups, for the same reason overdueTasks() returns full
     * tasks: the panel opens MeetingDetailModal in place.
     */
    public function todaySchedule(int $userId): array
    {
        $followUps = $this->followUpQuery($userId)
            ->whereBetween('next_follow_up_date', [now()->startOfDay(), now()->addDay()->endOfDay()])
            ->orderBy('next_follow_up_date')
            ->limit(12)
            ->get();

        return $this->mapFollowUps($followUps);
    }

    /** Base query shared by todaySchedule() and followUpsDue() — only the date window differs. */
    private function followUpQuery(int $userId)
    {
        return DealFollowUp::query()
            ->visibleToUser($userId)
            ->where('status', '<>', 'cancelled')
            ->with([
                'deal:id,name',
                'lead:id,client_name',
                'meetingType',
                'meetingSummary',
                'addedBy:id,name,image',
            ]);
    }

    /** @return array<int, array<string, mixed>> */
    private function mapFollowUps(Collection $followUps): array
    {
        DealFollowUp::attachParticipantUsers($followUps);

        return $followUps
            ->map(fn (DealFollowUp $followUp) => $followUp->toArray() + [
                'title' => $followUp->deal?->name
                    ?? $followUp->lead?->client_name
                    ?? 'Meeting',
                'subtitle' => $followUp->lead?->client_name,
                'type' => $followUp->meetingType?->name,
                // Named _label, not `location`: the model's own `location` is the
                // raw platform slug (office / zoom / free text) that
                // meetingListAdapter.getPlatformMeta() switches on. Overwriting
                // it with a display string renders every meeting as "Physical".
                'location_label' => $followUp->location ?: ($followUp->meeting_link ? 'Online' : null),
                'at' => $followUp->next_follow_up_date?->toIso8601String(),
                'duration' => $followUp->getEffectiveDuration(),
            ])
            ->all();
    }

    /**
     * The agent's own pipeline: stage counts plus open value.
     *
     * Value stays split by currency for the same reason the leadership view
     * splits it — the stored exchange rates are unmaintained, so one rolled-up
     * total would look authoritative and be wrong.
     */
    public function agentPipeline(int $userId): array
    {
        $agentIds = $this->agentIdsForUser($userId);

        return [
            'funnel' => $this->stageFunnel($agentIds),
            'value' => $this->pipelineValueByCurrency($agentIds),
        ];
    }

    // ── Personal dashboard ─────────────────────────────────────────

    /**
     * How far ahead the personal dashboard looks, in days.
     *
     * One window for the whole page rather than a Today/This week toggle. The
     * queue is a list of work, and a task due the day after tomorrow needs the
     * same glance as one due tonight — splitting them behind a switch hid half
     * the answer and made every panel take a scope argument it barely used.
     *
     * Also the bound that keeps these queries honest: without it the queue
     * scans every task the user can see, and a lead assigned a year ago is not
     * something a dashboard should be paging in.
     */
    public const PERSONAL_WINDOW_DAYS = 7;

    /**
     * The signal queue: overdue tasks plus everything falling due inside the
     * window, each carrying the CRM record it hangs off.
     *
     * Rows carry `days_overdue` and `related` (the lead/deal the task hangs
     * off) either way. Behind crm.tasks-workspace-redesign, the row is also
     * run through TaskPresenter::present() — the same shape every other
     * surface (Tasks page, Deal/Lead workspace tabs) already opens in the
     * redesigned task modals — merged with those two extra fields, so this
     * queue's rows can open there too without a second fetch. Off, it's the
     * older toFrontendArray() shape the classic TaskDetailModal expects.
     *
     * Bucketing into overdue / due today / later is left to the client: it is
     * a pure function of due_date, and splitting here would ship three arrays
     * that have to be re-merged to sort.
     *
     * `counts` are the true totals and `tasks` is capped — an employee with 60
     * overdue tasks must be told 60, not the 25 rows we chose to send.
     * `uncovered` is the footer line: open records nobody nominated a next
     * step on, which is why they never earn a row of their own.
     */
    public function personalQueue(int $userId, int $limit = self::QUEUE_ROWS): array
    {
        $today = now()->startOfDay();
        $endOfToday = now()->endOfDay();
        $until = now()->addDays(self::PERSONAL_WINDOW_DAYS)->endOfDay();
        $useRedesignedTasks = FeatureFlags::enabled('crm.tasks-workspace-redesign');

        $pending = fn () => Task::query()
            ->pending()
            ->visibleToUser($userId)
            ->whereNotNull('due_date');

        $tasksQuery = $pending()
            ->where('due_date', '<=', $until)
            ->with($useRedesignedTasks ? TaskPresenter::RELATIONS : ['users:id,name,image', 'boardColumn:id,slug,column_name'])
            ->orderBy('due_date')
            ->limit($limit);

        if ($useRedesignedTasks) {
            $tasksQuery->withCount(TaskPresenter::COUNTS);
        }

        $tasks = $tasksQuery->get();

        $related = $this->relatedRecords($tasks->pluck('id')->all());

        // One aggregate query instead of three separate counts — same
        // `pending()` base, only the due_date bucket differs.
        $dueCounts = $pending()
            ->toBase()
            ->selectRaw(
                'SUM(CASE WHEN due_date < ? THEN 1 ELSE 0 END) as overdue,
                 SUM(CASE WHEN due_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as today,
                 SUM(CASE WHEN due_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as later',
                [$today, $today, $endOfToday, now()->addDay()->startOfDay(), $until]
            )
            ->first();

        return [
            'tasks' => $tasks
                ->map(function (Task $task) use ($related, $today, $useRedesignedTasks) {
                    $due = Carbon::parse($task->due_date)->startOfDay();
                    $base = $useRedesignedTasks ? TaskPresenter::present($task) : $task->toFrontendArray();

                    return $base + [
                        'days_overdue' => $due->lessThan($today) ? (int) $today->diffInDays($due) : 0,
                        'related' => $related[$task->id] ?? null,
                    ];
                })
                ->all(),
            'counts' => [
                // Overdue is deliberately unbounded below: something six months
                // late is the most urgent row on the page, not the least.
                'overdue' => (int) ($dueCounts->overdue ?? 0),
                'today' => (int) ($dueCounts->today ?? 0),
                'later' => (int) ($dueCounts->later ?? 0),
            ],
            'uncovered' => [
                'leads' => $this->leadsWithoutNextStep($userId)->count(),
                'deals' => $this->dealsWithoutNextStep($this->agentIdsForUser($userId))?->count() ?? 0,
            ],
        ];
    }

    /**
     * Open deals grouped by pipeline — count, value and how many have gone
     * untouched for a week.
     *
     * Grouped by pipeline, never by stage: the pipelines carry different stage
     * sets with no shared ordinal (see stageFunnel()'s own note), so a single
     * cross-pipeline funnel would stack unlike things.
     *
     * Value stays split by currency inside each pipeline for the same reason
     * pipelineValueByCurrency() splits it — the stored exchange rates are
     * unmaintained, so one rolled-up total would look authoritative and be
     * wrong. Totals are sorted largest first so the UI can lead with the
     * dominant currency and footnote the rest.
     *
     * "Idle" is deals.updated_at, not a stalled-stage rule: stalled-ness reads
     * pipeline_stages.target_duration_days, which is NULL on every stage today.
     */
    public function openDealsByPipeline(int $userId, int $idleDays = 7): array
    {
        $agentIds = $this->agentIdsForUser($userId);

        if (empty($agentIds)) {
            return [];
        }

        $rows = Deal::query()
            ->join('lead_pipelines', 'lead_pipelines.id', '=', 'deals.lead_pipeline_id')
            ->leftJoin('currencies', 'currencies.id', '=', 'deals.currency_id')
            ->whereNull('deals.outcome_status')
            ->whereIn('deals.agent_id', $agentIds)
            ->groupBy('lead_pipelines.id', 'lead_pipelines.name', 'currencies.currency_code')
            ->toBase()
            ->selectRaw('lead_pipelines.id, lead_pipelines.name, currencies.currency_code')
            ->selectRaw('COUNT(deals.id) as deal_count')
            ->selectRaw('COALESCE(SUM(deals.value), 0) as total')
            ->selectRaw(
                'SUM(CASE WHEN deals.updated_at < ? THEN 1 ELSE 0 END) as idle_count',
                [now()->subDays($idleDays)]
            )
            ->get();

        $pipelines = [];

        foreach ($rows as $row) {
            $id = (int) $row->id;

            $pipelines[$id] ??= [
                'id' => $id,
                'name' => $row->name,
                'deal_count' => 0,
                'idle_count' => 0,
                'totals' => [],
            ];

            // Counts always accrue; only the money needs a currency to label
            // it. A deal with no currency still exists and is still open.
            $pipelines[$id]['deal_count'] += (int) $row->deal_count;
            $pipelines[$id]['idle_count'] += (int) $row->idle_count;

            $currency = $this->currencyCode($row->currency_code);

            if ($currency !== null) {
                $pipelines[$id]['totals'][] = [
                    'currency' => $currency,
                    'total' => (float) $row->total,
                ];
            }
        }

        return collect($pipelines)
            ->map(function (array $pipeline) {
                $pipeline['totals'] = $this->mergeTotals($pipeline['totals']);

                return $pipeline;
            })
            // Ranked by each pipeline's own largest-currency total (totals[0]
            // after the merge above) — the same figure the dashboard bar
            // renders, so list order matches bar order.
            ->sortByDesc(fn (array $pipeline) => $pipeline['totals'][0]['total'] ?? 0)
            ->values()
            ->all();
    }

    /**
     * A usable currency code, or null.
     *
     * Falls back to the company's own default when a record carries none —
     * most deals are quoted in it, so labelling those totals with it is far
     * closer to the truth than the literal string "unknown", which is not a
     * currency and renders as one. Null when the company has no default
     * either, and the caller then shows the count without a value rather than
     * putting a number on screen it cannot name.
     */
    private function currencyCode(?string $code): ?string
    {
        return $code ?: $this->defaultCurrencyCode();
    }

    /** Memoised: company() is session-cached but the relation is not. */
    private ?string $defaultCurrency = null;

    private bool $defaultCurrencyResolved = false;

    private function defaultCurrencyCode(): ?string
    {
        if (! $this->defaultCurrencyResolved) {
            $this->defaultCurrencyResolved = true;
            $this->defaultCurrency = company()?->currency?->currency_code;
        }

        return $this->defaultCurrency;
    }

    /**
     * Fold per-currency rows into one entry each, largest first.
     *
     * Needed because currencyCode() maps NULL onto the company default, so two
     * SQL groups — "EUR" and "no currency" — can arrive as the same currency
     * and would otherwise render as two EUR lines.
     *
     * @param  array<int, array{currency: string, total: float}>  $totals
     * @return array<int, array{currency: string, total: float}>
     */
    private function mergeTotals(array $totals): array
    {
        $merged = [];

        foreach ($totals as $row) {
            $merged[$row['currency']] = ($merged[$row['currency']] ?? 0) + $row['total'];
        }

        arsort($merged);

        return array_map(
            fn ($currency, $total) => ['currency' => $currency, 'total' => (float) $total],
            array_keys($merged),
            $merged
        );
    }

    /**
     * The stat strip: leads just in, and the shape of the week ahead.
     *
     * Leads look back over the window (what arrived), the day looks forward
     * (what is booked) — the two tiles answer different questions and a single
     * direction would make one of them meaningless.
     *
     * There is no target anywhere. Nothing in this schema stores a quota, so
     * one would have to be invented, and a fabricated number on a landing page
     * is worse than a missing one. The deals tile is derived client-side from
     * openDealsByPipeline() rather than re-queried here.
     */
    public function personalStats(int $userId): array
    {
        $since = now()->subDays(self::PERSONAL_WINDOW_DAYS);
        $until = now()->addDays(self::PERSONAL_WINDOW_DAYS)->endOfDay();
        $doneColumnId = TaskboardColumn::completeColumn()?->id;

        $ownedLeads = fn () => Lead::query()->where('lead_owner', $userId);
        $dueTasks = fn () => Task::query()
            ->visibleToUser($userId)
            ->whereNotNull('due_date')
            ->whereBetween('due_date', [now()->startOfDay(), $until]);

        // One aggregate query instead of three — same owned-leads base, only
        // the bucket condition differs.
        $leadCounts = $ownedLeads()
            ->toBase()
            ->selectRaw(
                'SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new,
                 SUM(CASE WHEN first_contacted_at >= ? THEN 1 ELSE 0 END) as contacted,
                 SUM(CASE WHEN first_contacted_at IS NULL THEN 1 ELSE 0 END) as uncontacted',
                [$since, $since]
            )
            ->first();

        // Same collapse for tasksDue/tasksDone, when there's a done column to
        // split on at all — otherwise tasksDue alone is already the one query.
        if ($doneColumnId) {
            $taskCounts = $dueTasks()
                ->toBase()
                ->selectRaw(
                    'COUNT(*) as due, SUM(CASE WHEN tasks.board_column_id = ? THEN 1 ELSE 0 END) as done',
                    [$doneColumnId]
                )
                ->first();
            $tasksDue = (int) ($taskCounts->due ?? 0);
            $tasksDone = (int) ($taskCounts->done ?? 0);
        } else {
            $tasksDue = $dueTasks()->count();
            // null, not 0, when no done column is configured — the tile
            // renders "3 tasks due" rather than a false "0 of 3 done".
            $tasksDone = null;
        }

        return [
            'leads' => [
                'new' => (int) ($leadCounts->new ?? 0),
                'contacted' => (int) ($leadCounts->contacted ?? 0),
                // Not windowed: an uncontacted lead from last month is still
                // uncontacted today, and that is the number worth acting on.
                'uncontacted' => (int) ($leadCounts->uncontacted ?? 0),
            ],
            'day' => [
                'meetings' => $this->followUpQuery($userId)
                    ->whereBetween('next_follow_up_date', [now(), $until])
                    ->count(),
                'tasksDue' => $tasksDue,
                'tasksDone' => $tasksDone,
            ],
        ];
    }

    /**
     * The agenda rail: meetings still ahead of the clock, inside the window.
     *
     * Strictly future. An agenda answers "what is coming", so a meeting that
     * started an hour ago belongs in the queue as a task or in the timeline as
     * history, not at the top of the list of what is next.
     */
    public function upcomingMeetings(int $userId, int $limit = 12): array
    {
        $followUps = $this->followUpQuery($userId)
            ->whereBetween('next_follow_up_date', [
                now(),
                now()->addDays(self::PERSONAL_WINDOW_DAYS)->endOfDay(),
            ])
            ->orderBy('next_follow_up_date')
            ->limit($limit)
            ->get();

        return $this->mapFollowUps($followUps);
    }

    /**
     * Commission this person has earned, for agents only.
     *
     * Returns null when the account has no lead_agent record — that is not an
     * error, it is most employees, and the caller drops the tile rather than
     * rendering a zero that reads as "you earned nothing".
     *
     * `earned` is paid commission stamped inside the month; `pending` is what
     * is booked but not yet paid. Split by currency for the same reason every
     * other total here is — the stored exchange rates are unmaintained, so the
     * caller leads with the dominant currency instead of summing across them.
     */
    public function commissionSummary(int $userId): ?array
    {
        $agentId = LeadAgent::where('user_id', $userId)->value('id');

        if (is_null($agentId)) {
            return null;
        }

        $currentStart = now()->startOfMonth();
        $currentEnd = now()->endOfMonth();
        $previousStart = now()->subMonthNoOverflow()->startOfMonth();
        $previousEnd = now()->subMonthNoOverflow()->endOfMonth();

        // One grouped query computing all three figures per currency, instead
        // of running the same join three times with a different status/date
        // filter. Rows with nothing in any bucket (e.g. an all-reverted
        // currency) are dropped per-bucket below, matching what the old
        // per-status WHERE clauses would have excluded from each result.
        $rows = MlmCommission::query()
            ->join('deals', 'deals.id', '=', 'mlm_commissions.deal_id')
            ->leftJoin('currencies', 'currencies.id', '=', 'deals.currency_id')
            ->where('mlm_commissions.agent_id', $agentId)
            ->groupBy('currencies.currency_code')
            ->toBase()
            ->selectRaw('currencies.currency_code')
            ->selectRaw(
                'SUM(CASE WHEN mlm_commissions.status = ? AND mlm_commissions.paid_at BETWEEN ? AND ? THEN mlm_commissions.amount ELSE 0 END) as earned',
                [MlmCommissionStatus::Paid->value, $currentStart, $currentEnd]
            )
            ->selectRaw(
                'SUM(CASE WHEN mlm_commissions.status = ? AND mlm_commissions.paid_at BETWEEN ? AND ? THEN mlm_commissions.amount ELSE 0 END) as previous',
                [MlmCommissionStatus::Paid->value, $previousStart, $previousEnd]
            )
            ->selectRaw(
                'SUM(CASE WHEN mlm_commissions.status = ? THEN mlm_commissions.amount ELSE 0 END) as pending',
                [MlmCommissionStatus::Pending->value]
            )
            ->get();

        $split = fn (string $field) => $this->mergeTotals(
            $rows->map(fn ($row) => [
                'currency' => $this->currencyCode($row->currency_code),
                'total' => (float) $row->{$field},
            ])
                ->filter(fn (array $row) => $row['currency'] !== null && $row['total'] != 0)
                ->values()
                ->all()
        );

        return [
            'earned' => $split('earned'),
            'previous' => $split('previous'),
            'pending' => $split('pending'),
        ];
    }

    /**
     * The user's own recent activity, from the shared CRM Event Engine —
     * every event `user_id` recorded, newest first.
     *
     * Rows carry CrmEvent::toTimelineArray()'s shape plus the name of the
     * record the event happened on. The event itself stores only model_type
     * and model_id, and "note added" without saying on what is not activity
     * anyone can read.
     */
    public function recentActivity(int $userId, int $companyId, CrmEventService $events, int $limit = 10): array
    {
        $paginated = $events->query([
            'company_id' => $companyId,
            'user_id' => $userId,
            'per_page' => $limit,
        ]);

        $rows = collect($paginated->items())
            ->map(fn (CrmEvent $event) => $event->toTimelineArray())
            ->all();

        $names = $this->activityRecordNames($rows);

        return array_map(
            fn (array $row) => $row + [
                'record' => $names["{$row['model_type']}:{$row['model_id']}"] ?? null,
            ],
            $rows
        );
    }

    /**
     * "App\Models\Deal:12" => {type, id, name}, for the activity feed.
     *
     * Two lookups rather than a polymorphic eager-load, matching
     * relatedRecords() — model_type/model_id is a plain pair on crm_events with
     * no morph relation defined, and only Lead and Deal have a name worth
     * showing on a personal feed.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<string, array{type: string, id: int, name: string}>
     */
    private function activityRecordNames(array $rows): array
    {
        $idsByType = [];

        foreach ($rows as $row) {
            if (in_array($row['model_type'], [Lead::class, Deal::class], true) && $row['model_id']) {
                $idsByType[$row['model_type']][] = (int) $row['model_id'];
            }
        }

        $out = [];

        foreach ([Lead::class => 'client_name', Deal::class => 'name'] as $model => $column) {
            $ids = array_unique($idsByType[$model] ?? []);

            if (empty($ids)) {
                continue;
            }

            foreach ($model::whereIn('id', $ids)->pluck($column, 'id') as $id => $name) {
                $out["{$model}:{$id}"] = [
                    'type' => $model === Lead::class ? 'lead' : 'deal',
                    'id' => (int) $id,
                    'name' => $name,
                ];
            }
        }

        return $out;
    }

    // ── Manager view ─────────────────────────────────────────────

    /**
     * Deals per stage for one pipeline, in that pipeline's own stage order.
     *
     * One pipeline at a time, deliberately. There are 11 pipelines sharing 67
     * stages and several reuse the same stage names ("NEW" appears in most of
     * them), so a merged funnel renders dozens of near-empty bars with repeated
     * labels — unreadable, and it implies a single funnel the business doesn't
     * actually run.
     *
     * Defaults to the pipeline where the scope has the most open deals, and
     * returns the alternatives so the UI can offer a selector without a second
     * round-trip.
     *
     * @return array{pipelines: array, pipeline_id: int|null, stages: array}
     */
    public function stageFunnel(array $agentIds, ?int $pipelineId = null): array
    {
        $pipelineCounts = Deal::query()
            ->join('lead_pipelines', 'lead_pipelines.id', '=', 'deals.lead_pipeline_id')
            ->whereNull('deals.outcome_status')
            ->when(! empty($agentIds), fn ($q) => $q->whereIn('deals.agent_id', $agentIds))
            ->groupBy('lead_pipelines.id', 'lead_pipelines.name')
            ->orderByDesc('deal_count')
            ->toBase()
            ->get([
                'lead_pipelines.id',
                'lead_pipelines.name',
                DB::raw('COUNT(deals.id) as deal_count'),
            ]);

        if ($pipelineCounts->isEmpty()) {
            return ['pipelines' => [], 'pipeline_id' => null, 'stages' => []];
        }

        $available = $pipelineCounts->map(fn ($row) => [
            'id' => (int) $row->id,
            'name' => $row->name,
            'deal_count' => (int) $row->deal_count,
        ])->all();

        // Fall back to the busiest pipeline when the requested one isn't in scope,
        // so a stale ?pipeline= can't render an empty funnel.
        $selectedId = collect($available)->firstWhere('id', $pipelineId)['id']
            ?? $available[0]['id'];

        $stages = PipelineStage::query()
            ->where('pipeline_stages.lead_pipeline_id', $selectedId)
            ->leftJoin('deals', function ($join) use ($agentIds) {
                $join->on('deals.pipeline_stage_id', '=', 'pipeline_stages.id')
                    ->whereNull('deals.outcome_status');

                if (! empty($agentIds)) {
                    $join->whereIn('deals.agent_id', $agentIds);
                }
            })
            ->groupBy('pipeline_stages.id', 'pipeline_stages.name', 'pipeline_stages.priority')
            ->orderBy('pipeline_stages.priority')
            // Aggregate rows, not entities — skip Eloquent hydration.
            ->toBase()
            ->get([
                'pipeline_stages.id',
                'pipeline_stages.name',
                DB::raw('COUNT(deals.id) as deal_count'),
            ])
            ->map(fn ($stage) => [
                'id' => (int) $stage->id,
                'name' => $stage->name,
                'count' => (int) $stage->deal_count,
            ])
            ->all();

        $dwell = $this->medianDaysInStage($agentIds, $selectedId);

        $stages = array_map(fn (array $stage) => $stage + [
            // How long the deals sitting here have been here. A direct
            // measurement, unlike median_days, which infers from past moves.
            'open_median_days' => $dwell[$stage['id']]['open_median_days'] ?? null,
            // Historic transit time. Null below three samples — a median over
            // one or two deals is not a median.
            'median_days' => ($dwell[$stage['id']]['samples'] ?? 0) >= 3
                ? $dwell[$stage['id']]['median_days']
                : null,
            'samples' => $dwell[$stage['id']]['samples'] ?? 0,
        ], $stages);

        return [
            'pipelines' => $available,
            'pipeline_id' => $selectedId,
            'stages' => $stages,
        ];
    }

    /**
     * The five headline numbers, each against the equivalent previous window.
     *
     * Every metric is a count of something stamped in the database — there is
     * deliberately no revenue, quota or cost tile, because none of those exist
     * to count.
     *
     * @return array<string, array{value: float|int, previous: float|int, spark: array, note: string|null}>
     */
    public function teamKpis(array $agentIds, int $days = 30): array
    {
        $ownerIds = $this->ownerIdsFor($agentIds);
        $start = now()->subDays($days)->startOfDay();
        $prevStart = now()->subDays($days * 2)->startOfDay();
        $slaHours = $this->slaHours();

        $leadsByDay = $this->countByDay(
            Lead::query()->whereIn('lead_owner', $ownerIds ?: [0]),
            'leads.created_at',
            $prevStart
        );

        // Leads created before first-contact tracking began could never have been
        // stamped, so counting them as misses reports a team failure that never
        // happened — visible the moment a 365-day window reaches past the
        // cutover. They come out of both halves of the rate, but deliberately
        // not out of newLeads above, which is a plain total.
        $trackingSince = $this->firstContactTrackingSince();

        $slaCohort = fn () => Lead::query()
            ->whereIn('lead_owner', $ownerIds ?: [0])
            ->when($trackingSince, fn ($query, $since) => $query->where('leads.created_at', '>=', $since));

        $slaEligibleByDay = $this->countByDay($slaCohort(), 'leads.created_at', $prevStart);

        // Contacted-within-SLA is measured on the lead's own creation day, so a
        // lead created on day 1 and answered on day 3 counts as a day-1 miss —
        // that is what makes the rate comparable between windows.
        $contactedByDay = $this->countByDay(
            $slaCohort()
                ->whereNotNull('first_contacted_at')
                ->whereRaw("first_contacted_at <= DATE_ADD(leads.created_at, INTERVAL {$slaHours} HOUR)"),
            'leads.created_at',
            $prevStart
        );

        $meetingsByDay = $this->countByDay(
            $this->heldMeetings()->whereIn('lead_follow_up.added_by', $ownerIds ?: [0]),
            'lead_follow_up.next_follow_up_date',
            $prevStart
        );

        $dealsByDay = $this->countByDay(
            Deal::query()->whereIn('deals.agent_id', $agentIds ?: [0]),
            'deals.created_at',
            $prevStart
        );

        $wonByDay = $this->countByDay(
            Deal::query()
                ->whereIn('deals.agent_id', $agentIds ?: [0])
                ->where('deals.outcome_status', 'won'),
            'COALESCE(deals.won_at, deals.updated_at)',
            $prevStart
        );

        $leads = $this->series($leadsByDay, $start, $prevStart, $days);
        $slaEligible = $this->series($slaEligibleByDay, $start, $prevStart, $days);
        $contacted = $this->series($contactedByDay, $start, $prevStart, $days);

        $rate = fn (float $part, float $whole) => $whole > 0 ? round($part / $whole * 100, 1) : null;

        return [
            'newLeads' => $leads + ['note' => null],
            'contactedInSla' => [
                'value' => $rate($contacted['value'], $slaEligible['value']),
                'previous' => $rate($contacted['previous'], $slaEligible['previous']),
                'spark' => array_map(
                    fn ($part, $whole) => $whole > 0 ? round($part / $whole * 100) : 0,
                    $contacted['spark'],
                    $slaEligible['spark']
                ),
                'unit' => '%',
                'note' => (int) ($slaEligible['value'] - $contacted['value'])." missed the {$slaHours}h SLA",
            ],
            'meetings' => $this->series($meetingsByDay, $start, $prevStart, $days)
                + ['note' => $this->meetingsHeldNote()],
            'dealsCreated' => $this->series($dealsByDay, $start, $prevStart, $days) + ['note' => null],
            'dealsWon' => $this->series($wonByDay, $start, $prevStart, $days) + ['note' => null],
        ];
    }

    /**
     * The lifecycle funnel: created → contacted → met → deal → won.
     *
     * Deliberately not the pipeline-stage funnel. Stage transitions live in
     * `deal_histories` but are barely written (a handful of `stage-updated`
     * rows across the whole database), so per-stage timing would be fabricated.
     * These five steps each rest on a timestamp that is actually populated.
     *
     * ponytail: one query over the cohort with correlated subqueries, medians
     * computed in PHP. Fine for a 30–90 day window; if a window ever returns
     * six figures of leads, move the aggregation into SQL.
     */
    public function lifecycleFunnel(array $agentIds, int $days = 90): array
    {
        $ownerIds = $this->ownerIdsFor($agentIds);

        $cohort = Lead::query()
            ->whereIn('lead_owner', $ownerIds ?: [0])
            ->where('leads.created_at', '>=', now()->subDays($days)->startOfDay())
            ->toBase()
            ->get([
                'leads.id',
                'leads.created_at',
                'leads.first_contacted_at',
                DB::raw($this->firstMeetingSubquery().' as met_at'),
                DB::raw('(SELECT MIN(d.created_at) FROM deals d WHERE d.lead_id = leads.id) as deal_at'),
                DB::raw("(SELECT MIN(COALESCE(d.won_at, d.updated_at)) FROM deals d WHERE d.lead_id = leads.id AND d.outcome_status = 'won') as won_at"),
            ]);

        $steps = [
            ['key' => 'created', 'label' => 'Lead created', 'from' => 'created_at', 'to' => 'first_contacted_at', 'drop' => 'never contacted'],
            ['key' => 'contacted', 'label' => 'Contacted', 'from' => 'first_contacted_at', 'to' => 'met_at', 'drop' => 'contacted leads never met'],
            ['key' => 'met', 'label' => 'Meeting held', 'from' => 'met_at', 'to' => 'deal_at', 'drop' => 'meetings produced no deal'],
            ['key' => 'deal', 'label' => 'Deal created', 'from' => 'deal_at', 'to' => 'won_at', 'drop' => 'deals not won'],
            ['key' => 'won', 'label' => 'Deal won', 'from' => 'won_at', 'to' => null, 'drop' => null],
        ];

        $rows = [];

        foreach ($steps as $step) {
            $reached = $cohort->filter(fn ($lead) => $lead->{$step['from']} !== null);
            $count = $reached->count();

            $next = $step['to']
                ? $reached->filter(fn ($lead) => $lead->{$step['to']} !== null)
                : collect();

            $gaps = $step['to']
                ? $next->map(fn ($lead) => Carbon::parse($lead->{$step['from']})
                    ->diffInHours(Carbon::parse($lead->{$step['to']})) / 24)->all()
                : [];

            $median = $this->median($gaps);

            $rows[] = [
                'key' => $step['key'],
                'label' => $step['label'],
                'count' => $count,
                'to_next' => $step['to'] && $count > 0 ? round($next->count() / $count * 100) : null,
                'median_days' => $median === null ? null : round($median, 1),
                'dropped' => $step['to'] ? $count - $next->count() : null,
                'drop_label' => $step['drop'],
            ];
        }

        return ['days' => $days, 'steps' => $rows];
    }

    /**
     * How long first contact actually takes, as a distribution rather than a mean.
     *
     * A mean hides the shape that matters: most leads answered quickly plus a
     * handful never picked up reads identically to a uniformly slow team.
     */
    public function responseDistribution(array $agentIds, int $days = 30): array
    {
        $ownerIds = $this->ownerIdsFor($agentIds);
        $since = now()->subDays($days)->startOfDay();

        $minutes = Lead::query()
            ->whereIn('lead_owner', $ownerIds ?: [0])
            ->whereNotNull('first_contacted_at')
            ->where('leads.created_at', '>=', $since)
            ->toBase()
            ->selectRaw('TIMESTAMPDIFF(MINUTE, leads.created_at, leads.first_contacted_at) as m')
            ->pluck('m')
            ->map(fn ($m) => max(0, (int) $m))
            ->all();

        $worstOpen = Lead::query()
            ->whereIn('lead_owner', $ownerIds ?: [0])
            ->whereNull('first_contacted_at')
            ->where('leads.created_at', '>=', $since)
            ->min('leads.created_at');

        $buckets = [
            ['label' => '<1h', 'max' => 60],
            ['label' => '1-4h', 'max' => 240],
            ['label' => '4-24h', 'max' => 1440],
            ['label' => '1-3d', 'max' => 4320],
            ['label' => '3d+', 'max' => null],
        ];

        $counts = array_map(
            fn ($bucket, $index) => [
                'label' => $bucket['label'],
                'count' => count(array_filter($minutes, function ($m) use ($buckets, $index, $bucket) {
                    $floor = $index === 0 ? -1 : $buckets[$index - 1]['max'];

                    return $m > $floor && ($bucket['max'] === null || $m <= $bucket['max']);
                })),
                // The last two buckets are already an SLA miss at the 24h default.
                'severity' => match ($bucket['label']) {
                    '<1h' => 'good',
                    '1-4h', '4-24h' => 'ok',
                    '1-3d' => 'warn',
                    default => 'bad',
                },
            ],
            $buckets,
            array_keys($buckets)
        );

        return [
            'total' => count($minutes),
            'buckets' => $counts,
            'median_minutes' => ($median = $this->median($minutes)) === null ? null : (int) round($median),
            'p90_minutes' => ($p90 = $this->percentile($minutes, 90)) === null ? null : (int) round($p90),
            'worst_open_hours' => $worstOpen
                ? (int) Carbon::parse($worstOpen)->diffInHours(now())
                : null,
        ];
    }

    /**
     * Sources ranked by what they actually produce, not just how loud they are.
     *
     * Still no cost column: no spend data reaches the CRM for any channel, so
     * cost-per-lead here would imply a parity between sources that isn't real.
     */
    public function sourceQuality(array $agentIds = [], int $days = 90): array
    {
        $ownerIds = $this->ownerIdsFor($agentIds);
        $since = now()->subDays($days)->startOfDay();

        return LeadSource::query()
            ->leftJoin('leads', function ($join) use ($ownerIds, $since, $agentIds) {
                $join->on('leads.source_id', '=', 'lead_sources.id')
                    ->whereNull('leads.deleted_at')
                    ->where('leads.created_at', '>=', $since);

                if (! empty($agentIds)) {
                    $join->whereIn('leads.lead_owner', $ownerIds ?: [0]);
                }
            })
            ->groupBy('lead_sources.id', 'lead_sources.type')
            ->orderByDesc('total')
            ->toBase()
            ->get([
                'lead_sources.id',
                'lead_sources.type as name',
                DB::raw('COUNT(leads.id) as total'),
                DB::raw('SUM(leads.first_contacted_at IS NOT NULL) as contacted'),
                DB::raw("SUM(EXISTS(SELECT 1 FROM deals d WHERE d.lead_id = leads.id AND d.outcome_status = 'won')) as won"),
            ])
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => $row->name,
                'count' => (int) $row->total,
                'contacted' => (int) $row->contacted,
                'won' => (int) $row->won,
            ])
            ->all();
    }

    /**
     * Median days a deal spends in each stage, keyed by stage id.
     *
     * crm_events is the only stage-change record that is actually written:
     * deal_histories holds a couple of rows database-wide, because the paths
     * that move stages either use saveQuietly(), mass-update past the observer,
     * or used to throw on a null user. Three writers emit deal_stage_changed
     * with different metadata key names, but all three write from_stage_id and
     * to_stage_id, and only the ids are read here — so the whole divergence
     * collapses to one (int) cast.
     *
     * Closed dwells (event → next event) and open dwells (stage_entered_at →
     * now) are reported separately and never mixed. An open dwell is
     * right-censored: folding it in drags every figure down by exactly the
     * amount that makes a slow stage look fast.
     *
     * ponytail: the event set is loaded into PHP (~150 rows today) and the
     * arithmetic done there. Move it into SQL past a few tens of thousands.
     *
     * @return array<int, array{median_days: float|null, samples: int, open_count: int, open_median_days: float|null}>
     */
    public function medianDaysInStage(array $agentIds, ?int $pipelineId = null): array
    {
        $dealIds = Deal::query()
            ->when(! empty($agentIds), fn ($q) => $q->whereIn('deals.agent_id', $agentIds))
            ->when($pipelineId, fn ($q) => $q->where('deals.lead_pipeline_id', $pipelineId))
            ->toBase()
            ->pluck('deals.id');

        if ($dealIds->isEmpty()) {
            return [];
        }

        $dwellDays = [];

        // ── Closed dwells, from consecutive stage-change events ──────
        $events = DB::table('crm_events')
            ->join('crm_event_types', 'crm_event_types.id', '=', 'crm_events.event_type_id')
            ->where('crm_event_types.slug', 'deal_stage_changed')
            ->where('crm_events.model_type', Deal::class)
            ->whereIn('crm_events.model_id', $dealIds)
            ->orderBy('crm_events.model_id')
            ->orderBy('crm_events.occurred_at')
            ->get(['crm_events.model_id', 'crm_events.metadata', 'crm_events.occurred_at'])
            ->groupBy('model_id');

        foreach ($events as $dealEvents) {
            $rows = $dealEvents->values();

            foreach ($rows as $index => $event) {
                $stageId = $this->stageIdFromEvent($event->metadata, 'to_stage_id');
                $next = $rows[$index + 1] ?? null;

                if (is_null($stageId) || is_null($next)) {
                    continue;
                }

                $dwellDays[$stageId][] = Carbon::parse($event->occurred_at)
                    ->diffInHours(Carbon::parse($next->occurred_at)) / 24;
            }
        }

        // ── Open dwells, from the stage the deal is sitting in now ───
        $open = Deal::query()
            ->whereIn('deals.id', $dealIds)
            ->whereNull('deals.outcome_status')
            ->whereNotNull('deals.stage_entered_at')
            ->whereNotNull('deals.pipeline_stage_id')
            ->toBase()
            ->get(['deals.pipeline_stage_id', 'deals.stage_entered_at'])
            ->groupBy('pipeline_stage_id');

        $stageIds = collect($dwellDays)->keys()->merge($open->keys())->unique();

        return $stageIds->mapWithKeys(function ($stageId) use ($dwellDays, $open) {
            $closed = $dwellDays[$stageId] ?? [];
            $openDwells = ($open[$stageId] ?? collect())
                ->map(fn ($row) => Carbon::parse($row->stage_entered_at)->diffInHours(now()) / 24)
                ->all();

            $median = $this->median($closed);
            $openMedian = $this->median($openDwells);

            return [(int) $stageId => [
                'median_days' => $median === null ? null : round($median, 1),
                'samples' => count($closed),
                'open_count' => count($openDwells),
                'open_median_days' => $openMedian === null ? null : round($openMedian, 1),
            ]];
        })->all();
    }

    /**
     * Pull a stage id out of a deal_stage_changed event's metadata.
     *
     * DealObserver writes it as a string, DealAutomationService as an int, and
     * they disagree on the *name* keys (from_stage_name vs from_stage) — which
     * this never reads, because stage names come from pipeline_stages anyway.
     */
    private function stageIdFromEvent(?string $metadata, string $key): ?int
    {
        $decoded = json_decode((string) $metadata, true);

        return isset($decoded[$key]) ? (int) $decoded[$key] : null;
    }

    /**
     * Per-agent detail with the one column a manager acts on: what's slipping.
     *
     * The team median contact rate rides along so the UI can mark it on each
     * bar — an agent at 75% means nothing until you know the team sits at 68%.
     *
     * @return array{rows: array, median_contact_rate: float|null, sla_hours: int}
     */
    public function teamAgents(array $agentIds, int $days = 30): array
    {
        if (empty($agentIds)) {
            return ['rows' => [], 'median_contact_rate' => null, 'sla_hours' => $this->slaHours()];
        }

        $agents = LeadAgent::with('user:id,name,image')->whereIn('id', $agentIds)->get();
        $slaHours = $this->slaHours();
        $since = now()->subDays($days)->startOfDay();
        $ownerIds = $agents->pluck('user_id')->filter()->all() ?: [0];

        // Same exclusion as teamKpis, but as a second counter rather than a
        // filter: `total` is displayed as the agent's lead count, so narrowing
        // the query would quietly under-report their workload. Only the rate's
        // denominator drops the leads that predate tracking.
        $trackingSince = $this->firstContactTrackingSince();
        $eligible = $trackingSince
            ? "leads.created_at >= '{$trackingSince->toDateTimeString()}'"
            : '1';

        $leadStats = Lead::query()
            ->whereIn('lead_owner', $ownerIds)
            ->where('leads.created_at', '>=', $since)
            ->groupBy('lead_owner')
            ->toBase()
            ->get([
                'lead_owner',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM({$eligible}) as sla_eligible"),
                DB::raw("SUM({$eligible} AND first_contacted_at IS NOT NULL AND first_contacted_at <= DATE_ADD(leads.created_at, INTERVAL {$slaHours} HOUR)) as in_sla"),
            ])
            ->keyBy('lead_owner');

        // Open breaches are counted without the window: a lead that has been
        // waiting 200 days is the manager's problem today, not last month's.
        $openBreaches = Lead::query()
            ->whereIn('lead_owner', $ownerIds)
            ->whereNull('first_contacted_at')
            ->where('leads.created_at', '<', now()->subHours($slaHours))
            ->when($this->firstContactTrackingSince(), fn ($q, $since) => $q->where('leads.created_at', '>=', $since))
            ->groupBy('lead_owner')
            ->toBase()
            ->get(['lead_owner', DB::raw('COUNT(*) as total')])
            ->keyBy('lead_owner');

        $dealStats = Deal::query()
            ->whereIn('agent_id', $agentIds)
            ->groupBy('agent_id')
            ->toBase()
            ->get([
                'agent_id',
                DB::raw('SUM(outcome_status IS NULL) as open_deals'),
                DB::raw("SUM(outcome_status = 'won') as won_all_time"),
                DB::raw("SUM(created_at >= '{$since->toDateTimeString()}') as created_in_window"),
                DB::raw("SUM(outcome_status = 'won' AND COALESCE(won_at, updated_at) >= '{$since->toDateTimeString()}') as won_in_window"),
            ])
            ->keyBy('agent_id');

        $meetings = $this->heldMeetings()
            ->whereIn('lead_follow_up.added_by', $ownerIds)
            ->where('lead_follow_up.next_follow_up_date', '>=', $since)
            ->groupBy('lead_follow_up.added_by')
            ->toBase()
            ->get(['lead_follow_up.added_by', DB::raw('COUNT(*) as total')])
            ->keyBy('added_by');

        $stalledByAgent = $this->stalledDealCountsByAgent($agentIds);

        $rows = $agents->map(function (LeadAgent $agent) use (
            $leadStats, $openBreaches, $dealStats, $meetings, $stalledByAgent
        ) {
            $leads = $leadStats->get($agent->user_id);
            $deals = $dealStats->get($agent->id);
            $total = (int) ($leads->total ?? 0);
            // Judgeable leads only — see the sla_eligible note above.
            $judgeable = (int) ($leads->sla_eligible ?? 0);
            $breaches = (int) ($openBreaches->get($agent->user_id)->total ?? 0);
            $agentStalled = (int) ($stalledByAgent[$agent->id] ?? 0);

            return [
                'agent_id' => $agent->id,
                'user_id' => $agent->user_id,
                'name' => $agent->user?->name ?? 'Unknown',
                'image' => $agent->user?->image_url,
                'open_deals' => (int) ($deals->open_deals ?? 0),
                'leads' => $total,
                // NULL, not 0 — an agent with no judgeable leads has no contact
                // rate, which is different from having a rate of zero.
                'contact_rate' => $judgeable > 0
                    ? round((int) ($leads->in_sla ?? 0) / $judgeable * 100)
                    : null,
                'meetings' => (int) ($meetings->get($agent->user_id)->total ?? 0),
                'deals' => (int) ($deals->created_in_window ?? 0),
                'won' => (int) ($deals->won_in_window ?? 0),
                'sla_breaches' => $breaches,
                'stalled_deals' => $agentStalled,
            ];
        })->values();

        return [
            'rows' => $rows
                // Worst contact rate first: the table is a triage list, not a ranking.
                ->sortBy(fn ($row) => [$row['sla_breaches'] > 0 ? 0 : 1, $row['contact_rate'] ?? 999])
                ->values()
                ->all(),
            'median_contact_rate' => $this->median(
                $rows->pluck('contact_rate')->filter(fn ($r) => $r !== null)->all()
            ),
            'sla_hours' => $slaHours,
            'stalled_total' => array_sum($stalledByAgent),
        ];
    }

    /** Stalled-deal counts keyed by agent, for the needs-attention column. */
    private function stalledDealCountsByAgent(array $agentIds): array
    {
        if (empty($agentIds)) {
            return [];
        }

        return Deal::query()
            ->join('pipeline_stages', 'pipeline_stages.id', '=', 'deals.pipeline_stage_id')
            ->whereIn('deals.agent_id', $agentIds)
            ->whereNull('deals.outcome_status')
            ->whereNotNull('pipeline_stages.target_duration_days')
            ->whereNotNull('deals.stage_entered_at')
            ->whereRaw('deals.stage_entered_at < DATE_SUB(NOW(), INTERVAL pipeline_stages.target_duration_days DAY)')
            ->groupBy('deals.agent_id')
            ->toBase()
            ->get(['deals.agent_id', DB::raw('COUNT(*) as total')])
            ->mapWithKeys(fn ($row) => [(int) $row->agent_id => (int) $row->total])
            ->all();
    }

    // ── Leadership view ──────────────────────────────────────────

    /**
     * Company-wide month-over-month movement. Team-level only — no agent names
     * reach this view.
     */
    public function trend(int $months = 12): array
    {
        $since = now()->subMonths($months - 1)->startOfMonth();

        $leads = Lead::query()
            ->where('created_at', '>=', $since)
            ->groupBy('period')
            ->toBase()
            ->get([
                DB::raw("DATE_FORMAT(created_at, '%Y-%m') as period"),
                DB::raw('COUNT(*) as total'),
            ])
            ->keyBy('period');

        $won = Deal::query()
            ->where('outcome_status', 'won')
            ->where('updated_at', '>=', $since)
            ->groupBy('period')
            ->toBase()
            ->get([
                DB::raw("DATE_FORMAT(updated_at, '%Y-%m') as period"),
                DB::raw('COUNT(*) as total'),
            ])
            ->keyBy('period');

        return collect(range(0, $months - 1))
            ->map(function (int $offset) use ($months, $leads, $won) {
                $period = now()->subMonths($months - 1 - $offset)->format('Y-m');

                return [
                    'period' => $period,
                    'leads' => (int) ($leads->get($period)->total ?? 0),
                    'won' => (int) ($won->get($period)->total ?? 0),
                ];
            })
            ->all();
    }

    /**
     * Market segmentation by the lead's primary language.
     *
     * primary_language is sparsely populated (backfilled from the first entry of
     * the multi-value languages array), so "unknown" is surfaced as its own
     * segment rather than hidden — an honest gap beats a confident wrong split.
     */
    public function marketSegments(): array
    {
        return Lead::query()
            ->groupBy('segment')
            ->orderByDesc('total')
            ->toBase()
            ->get([
                DB::raw("COALESCE(NULLIF(primary_language, ''), 'unknown') as segment"),
                DB::raw('COUNT(*) as total'),
            ])
            ->map(fn ($row) => [
                'segment' => $row->segment,
                'count' => (int) $row->total,
            ])
            ->all();
    }

    /**
     * Open pipeline value grouped by currency — never summed into one number.
     *
     * Deals now snapshot exchange_rate, but historical rows were backfilled with
     * today's rate and currencies.exchange_rate is unmaintained (EUR and GBP both
     * sit at 1.0). A single rolled-up total would look authoritative and be wrong,
     * so the UI shows the split and says so.
     */
    public function pipelineValueByCurrency(array $agentIds = []): array
    {
        return Deal::query()
            ->leftJoin('currencies', 'currencies.id', '=', 'deals.currency_id')
            ->whereNull('deals.outcome_status')
            ->when(! empty($agentIds), fn ($q) => $q->whereIn('deals.agent_id', $agentIds))
            ->groupBy('currencies.id', 'currencies.currency_code')
            ->orderByDesc('total')
            ->toBase()
            ->get([
                DB::raw("COALESCE(currencies.currency_code, 'unknown') as currency_code"),
                DB::raw('SUM(deals.value) as total'),
                DB::raw('COUNT(deals.id) as deal_count'),
            ])
            ->map(fn ($row) => [
                'currency' => $row->currency_code,
                'total' => (float) $row->total,
                'deal_count' => (int) $row->deal_count,
            ])
            ->all();
    }

    public function sourceBreakdown(array $agentIds = []): array
    {
        return LeadSource::query()
            ->leftJoin('leads', function ($join) use ($agentIds) {
                $join->on('leads.source_id', '=', 'lead_sources.id')
                    ->whereNull('leads.deleted_at');

                if (! empty($agentIds)) {
                    $ownerIds = LeadAgent::whereIn('id', $agentIds)->pluck('user_id')->filter()->all();
                    $join->whereIn('leads.lead_owner', $ownerIds ?: [0]);
                }
            })
            ->groupBy('lead_sources.id', 'lead_sources.type')
            ->orderByDesc('total')
            ->toBase()
            ->get([
                'lead_sources.id',
                'lead_sources.type as name',
                DB::raw('COUNT(leads.id) as total'),
                DB::raw('SUM(leads.lead_lifecycle_status_id IS NOT NULL AND leads.first_contacted_at IS NOT NULL) as contacted'),
            ])
            ->map(fn ($row) => [
                'id' => $row->id,
                'name' => $row->name,
                'count' => (int) $row->total,
                'contacted' => (int) $row->contacted,
            ])
            ->all();
    }

    // ── Partner view ─────────────────────────────────────────────

    /**
     * An external partner's own numbers only.
     *
     * Scoped to leads they introduced (referred_by_agent_id) and commissions
     * addressed to them. Deliberately returns no deal values, no contact PII, and
     * nothing about other partners — this view sits outside the trust boundary,
     * so the scoping is enforced here rather than hidden in the UI.
     */
    public function partnerStats(int $leadAgentId): array
    {
        $referred = Lead::query()->where('referred_by_agent_id', $leadAgentId);

        $converted = (clone $referred)
            ->whereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('deals')
                    ->whereColumn('deals.lead_id', 'leads.id')
                    ->where('deals.outcome_status', 'won');
            })
            ->count();

        $commissions = MlmCommission::query()
            ->where('agent_id', $leadAgentId)
            ->groupBy('status')
            ->toBase()
            ->get(['status', DB::raw('SUM(amount) as total')])
            ->mapWithKeys(fn ($row) => [
                ($row->status?->value ?? $row->status) => (float) $row->total,
            ])
            ->all();

        $totalReferred = (clone $referred)->count();

        // Referral → notary, measured on the won stamp. Only won deals have an
        // end date, so unconverted referrals can't distort the median.
        $closeDays = (clone $referred)
            ->toBase()
            ->get([
                DB::raw("(SELECT MIN(COALESCE(d.won_at, d.updated_at)) FROM deals d WHERE d.lead_id = leads.id AND d.outcome_status = 'won') as won_at"),
                'leads.created_at',
            ])
            ->filter(fn ($row) => $row->won_at !== null)
            ->map(fn ($row) => Carbon::parse($row->created_at)->diffInHours(Carbon::parse($row->won_at)) / 24)
            ->all();

        $inProgress = (clone $referred)
            ->whereExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('deals')
                    ->whereColumn('deals.lead_id', 'leads.id')
                    ->whereNull('deals.outcome_status');
            })
            ->count();

        return [
            'referredLeads' => $totalReferred,
            'inProgressLeads' => $inProgress,
            'convertedLeads' => $converted,
            'conversionRate' => $totalReferred > 0
                ? round($converted / $totalReferred * 100, 1)
                : null,
            'medianDaysToClose' => ($median = $this->median($closeDays)) === null
                ? null
                : (int) round($median),
            'commissionsByStatus' => $commissions,
        ];
    }

    /**
     * Open partner flags on leads this team owns.
     *
     * A notification with nowhere to answer it is not a workflow, so the
     * manager view carries the queue.
     */
    public function openPartnerFlags(array $agentIds): array
    {
        $ownerIds = $this->ownerIdsFor($agentIds);

        if (empty($ownerIds)) {
            return [];
        }

        return PartnerFlag::query()
            ->open()
            ->whereIn('lead_id', Lead::query()
                ->whereIn('lead_owner', $ownerIds)
                ->toBase()
                ->select('leads.id'))
            ->with(['partner.user:id,name', 'lead:id,client_name,lead_owner'])
            ->orderBy('created_at')
            ->limit(self::QUEUE_ROWS)
            ->get()
            ->map(fn (PartnerFlag $flag) => [
                'id' => $flag->id,
                'partner' => $flag->partner?->user?->name,
                'client' => $flag->lead?->client_name,
                'reason' => $flag->reason,
                'message' => $flag->message,
                'status' => $flag->status,
                'days_open' => (int) $flag->created_at->diffInDays(now()),
            ])
            ->all();
    }

    /**
     * What this partner's open referred deals would pay them if every one closed.
     *
     * Runs the real commission engine per deal and keeps only this agent's
     * legs, so the forecast cannot drift from what eventually gets written.
     *
     * Returns a single sum and a count, never a per-deal figure: a partner
     * knows their own rate, so one exposed leg is an exposed deal value — the
     * one thing this view must not leak. Below three deals the sum is
     * suppressed for the same reason.
     *
     * KNOWN LIMITATION, not a bug: this returns zero today. distribute() pays
     * deals.agent_id and their agent_hierarchy ancestors, and never reads
     * leads.referred_by_agent_id — referral is not a concept the commission
     * engine has. agent_hierarchy is also empty, so upline legs pay nothing at
     * all. The tile renders an em dash and says so. It starts producing real
     * numbers the day referral attribution reaches the engine and the hierarchy
     * is populated; no dashboard change is needed then.
     *
     * ponytail: N previews for N open referred deals (single digits today).
     * Batch the level and hierarchy lookups if a partner ever carries hundreds.
     *
     * @return array{deal_count: int, amount: float|null, suppressed: bool}
     */
    public function partnerForecast(int $leadAgentId, MlmCommissionService $commissions): array
    {
        $deals = Deal::query()
            ->whereNull('deals.outcome_status')
            ->whereIn('deals.lead_id', Lead::query()
                ->where('referred_by_agent_id', $leadAgentId)
                ->toBase()
                ->select('leads.id'))
            ->get();

        $amount = $deals->sum(
            fn (Deal $deal) => collect($commissions->preview($deal))
                ->where('agent_id', $leadAgentId)
                ->sum('amount')
        );

        // Two open deals plus a known rate is one subtraction away from a deal
        // value, so the number only appears once it is genuinely aggregated.
        $suppressed = $deals->count() > 0 && $deals->count() < self::FORECAST_MIN_DEALS;

        return [
            'deal_count' => $deals->count(),
            'amount' => $suppressed ? null : round((float) $amount, 2),
            'suppressed' => $suppressed,
        ];
    }

    /**
     * Referrals submitted against referrals completed, by month.
     *
     * Two separate series rather than a conversion line: completions lag
     * submissions by months, so plotting a ratio per month would read as a
     * collapse every time the partner has a strong intake month.
     */
    public function partnerTrend(int $leadAgentId, int $months = 12): array
    {
        $since = now()->subMonths($months - 1)->startOfMonth();

        $submitted = Lead::query()
            ->where('referred_by_agent_id', $leadAgentId)
            ->where('leads.created_at', '>=', $since)
            ->groupBy('period')
            ->toBase()
            ->get([
                DB::raw("DATE_FORMAT(leads.created_at, '%Y-%m') as period"),
                DB::raw('COUNT(*) as total'),
            ])
            ->keyBy('period');

        $completed = Lead::query()
            ->where('referred_by_agent_id', $leadAgentId)
            ->join('deals', 'deals.lead_id', '=', 'leads.id')
            ->where('deals.outcome_status', 'won')
            ->whereRaw('COALESCE(deals.won_at, deals.updated_at) >= ?', [$since])
            ->groupBy('period')
            ->toBase()
            ->get([
                DB::raw("DATE_FORMAT(COALESCE(deals.won_at, deals.updated_at), '%Y-%m') as period"),
                DB::raw('COUNT(DISTINCT leads.id) as total'),
            ])
            ->keyBy('period');

        return collect(range(0, $months - 1))
            ->map(function (int $offset) use ($months, $submitted, $completed) {
                $date = now()->subMonths($months - 1 - $offset);
                $period = $date->format('Y-m');

                return [
                    'period' => $period,
                    'label' => $date->format('M'),
                    'submitted' => (int) ($submitted->get($period)->total ?? 0),
                    'completed' => (int) ($completed->get($period)->total ?? 0),
                ];
            })
            ->all();
    }

    /**
     * Where a partner's referrals stand — stage counts only, no client detail.
     */
    public function partnerFunnel(int $leadAgentId): array
    {
        $rows = Lead::query()
            ->where('referred_by_agent_id', $leadAgentId)
            ->toBase()
            ->get([
                'leads.id',
                'leads.first_contacted_at',
                DB::raw($this->firstMeetingSubquery().' as met_at'),
                DB::raw('(SELECT COUNT(*) FROM deals d WHERE d.lead_id = leads.id AND d.outcome_status IS NULL) as open_deals'),
                DB::raw("(SELECT COUNT(*) FROM deals d WHERE d.lead_id = leads.id AND d.outcome_status = 'won') as won_deals"),
            ]);

        return [
            ['label' => 'Submitted', 'count' => $rows->count()],
            ['label' => 'Contacted', 'count' => $rows->whereNotNull('first_contacted_at')->count()],
            ['label' => 'Meeting held', 'count' => $rows->whereNotNull('met_at')->count()],
            ['label' => 'Deal open', 'count' => $rows->where('open_deals', '>', 0)->count()],
            ['label' => 'Completed', 'count' => $rows->where('won_deals', '>', 0)->count()],
        ];
    }

    /**
     * A partner's open referrals, one row each.
     *
     * Names are abbreviated server-side ("Sarah Al-Rashid" → "S. Al-Rashid")
     * and no email, phone or deal value is selected at all — the partner sits
     * outside the trust boundary, so the redaction happens in the query rather
     * than by the UI choosing not to render a field it was handed.
     */
    public function partnerReferrals(int $leadAgentId, int $stalledAfterDays = 30): array
    {
        return Lead::query()
            ->where('referred_by_agent_id', $leadAgentId)
            ->whereNotExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('deals')
                    ->whereColumn('deals.lead_id', 'leads.id')
                    ->where('deals.outcome_status', 'won');
            })
            ->leftJoin('users', 'users.id', '=', 'leads.lead_owner')
            // Same query, no extra round trip: the row needs to know whether
            // this partner already flagged it, and what came back.
            ->leftJoin('partner_flags', function ($join) use ($leadAgentId) {
                $join->on('partner_flags.lead_id', '=', 'leads.id')
                    ->where('partner_flags.lead_agent_id', $leadAgentId)
                    ->whereIn('partner_flags.status', [
                        PartnerFlag::STATUS_OPEN,
                        PartnerFlag::STATUS_ACKNOWLEDGED,
                    ]);
            })
            ->orderBy('leads.created_at')
            ->limit(50)
            ->toBase()
            ->get([
                'leads.id',
                'leads.client_name',
                'leads.created_at',
                'leads.updated_at',
                'leads.first_contacted_at',
                'users.name as agent_name',
                'partner_flags.status as flag_status',
                'partner_flags.response as flag_response',
                DB::raw($this->firstMeetingSubquery().' as met_at'),
                DB::raw('(SELECT COUNT(*) FROM deals d WHERE d.lead_id = leads.id AND d.outcome_status IS NULL) as open_deals'),
            ])
            ->map(function ($row) use ($stalledAfterDays) {
                $lastUpdate = Carbon::parse($row->updated_at);
                $idleDays = (int) $lastUpdate->diffInDays(now());

                $stage = match (true) {
                    $row->open_deals > 0 => 'Deal open',
                    $row->met_at !== null => 'Meeting held',
                    $row->first_contacted_at !== null => 'Contacted',
                    default => 'Not contacted',
                };

                return [
                    'id' => $row->id,
                    'client' => $this->abbreviateName($row->client_name),
                    'stage' => $stage,
                    'stalled' => $idleDays >= $stalledAfterDays,
                    'agent' => $this->abbreviateName($row->agent_name),
                    'days_open' => (int) Carbon::parse($row->created_at)->diffInDays(now()),
                    'idle_days' => $idleDays,
                    'flag_status' => $row->flag_status,
                    'flag_response' => $row->flag_response,
                ];
            })
            ->all();
    }

    // ── Internals ────────────────────────────────────────────────

    private function agentIdsForUser(int $userId): array
    {
        return LeadAgent::where('user_id', $userId)->pluck('id')->all();
    }

    /**
     * The moment first-contact tracking started, so SLA figures don't reach back
     * into leads that never had a chance to be stamped.
     */
    private function firstContactTrackingSince(): ?Carbon
    {
        // Memoised: three panels ask for this in one request and it is a MIN
        // over the whole leads table each time.
        if (! $this->trackingSinceResolved) {
            $earliest = Lead::whereNotNull('first_contacted_at')->min('first_contacted_at');
            $this->trackingSince = $earliest ? Carbon::parse($earliest) : null;
            $this->trackingSinceResolved = true;
        }

        return $this->trackingSince;
    }

    /**
     * Hours an agent has to make first contact. Configurable per company on the
     * lead settings screen; 24 is the fallback when nothing is set.
     */
    private function slaHours(): int
    {
        return self::clampSlaHours(LeadSetting::value('first_contact_sla_hours'));
    }

    /**
     * Kept next to the only reader so the bound and the default cannot drift
     * from what the settings form validates against.
     */
    public static function clampSlaHours($hours): int
    {
        $hours = (int) $hours;

        return $hours >= self::SLA_HOURS_MIN && $hours <= self::SLA_HOURS_MAX
            ? $hours
            : self::SLA_HOURS_DEFAULT;
    }

    /** The user ids behind a set of lead_agent ids — leads are owned by users. */
    private function ownerIdsFor(array $agentIds): array
    {
        if (empty($agentIds)) {
            return [];
        }

        return LeadAgent::whereIn('id', $agentIds)->pluck('user_id')->filter()->all();
    }

    /**
     * Meetings that have actually happened.
     *
     * From the day the dashboard gained a "Mark held" button,
     * lead_follow_up.status is authoritative: a past-dated meeting nobody
     * marked held did not happen. Before that day nothing wrote 'completed'
     * through a working path — the two endpoints that tried both had bugs that
     * made them fail outright — so past-and-not-cancelled is the only reading
     * the older data supports.
     *
     * One constant rather than two parallel metrics: a dashboard showing two
     * different meeting counts is a dashboard nobody trusts. Every surface that
     * shows this says which side of the line it is reading.
     *
     * `lead_follow_up` carries no CompanyScope, so callers must constrain it —
     * by owning user (visibleToUser / added_by) or by joining a scoped model.
     */
    private function heldMeetings()
    {
        return DealFollowUp::query()
            ->whereNotNull('lead_follow_up.next_follow_up_date')
            ->where('lead_follow_up.next_follow_up_date', '<=', now())
            ->where(fn ($q) => $q
                ->where(fn ($old) => $old
                    ->where('lead_follow_up.next_follow_up_date', '<', self::STATUS_TRUSTED_FROM)
                    ->where('lead_follow_up.status', '<>', 'cancelled'))
                ->orWhere(fn ($new) => $new
                    ->where('lead_follow_up.next_follow_up_date', '>=', self::STATUS_TRUSTED_FROM)
                    ->where('lead_follow_up.status', 'completed')));
    }

    /** Human-readable form of the cutover, for panel notes. */
    public function meetingsHeldNote(): string
    {
        return 'Marked held; before '
            .Carbon::parse(self::STATUS_TRUSTED_FROM)->format('j M Y')
            .', past and not cancelled';
    }

    /**
     * Correlated subquery for a lead's first held meeting, reached either
     * directly (`lead_id`) or through one of its deals.
     */
    private function firstMeetingSubquery(): string
    {
        return "(SELECT MIN(f.next_follow_up_date)
                 FROM lead_follow_up f
                 LEFT JOIN deals fd ON fd.id = f.deal_id
                 WHERE f.status <> 'cancelled'
                   AND f.next_follow_up_date <= NOW()
                   AND (f.lead_id = leads.id OR fd.lead_id = leads.id))";
    }

    /**
     * Daily counts, keyed Y-m-d. The caller buckets them.
     *
     * $expression is interpolated, so it must stay a literal from this file —
     * never a request value.
     */
    private function countByDay($query, string $expression, Carbon $from): Collection
    {
        return $query
            ->whereRaw("{$expression} >= ?", [$from])
            ->groupBy('day')
            ->toBase()
            ->get([
                DB::raw("DATE({$expression}) as day"),
                DB::raw('COUNT(*) as total'),
            ])
            ->mapWithKeys(fn ($row) => [(string) $row->day => (int) $row->total]);
    }

    /**
     * Collapse a day => count map into this window's total, the previous
     * window's total, and a short sparkline.
     *
     * @return array{value: int, previous: int, spark: array<int, int>}
     */
    private function series(
        Collection $byDay,
        Carbon $start,
        Carbon $prevStart,
        int $days,
        int $buckets = 6
    ): array {
        $value = 0;
        $previous = 0;
        $spark = array_fill(0, $buckets, 0);
        $perBucket = max(1, (int) ceil($days / $buckets));

        foreach ($byDay as $day => $count) {
            $date = Carbon::parse($day)->startOfDay();

            if ($date < $prevStart) {
                continue;
            }

            if ($date < $start) {
                $previous += $count;

                continue;
            }

            $value += $count;

            $index = min($buckets - 1, intdiv((int) $start->diffInDays($date), $perBucket));
            $spark[$index] += $count;
        }

        return ['value' => $value, 'previous' => $previous, 'spark' => $spark];
    }

    /** @param array<int, float|int> $values */
    private function median(array $values): ?float
    {
        return $this->percentile($values, 50);
    }

    /**
     * Nearest-rank percentile. Nothing in this file needs interpolation, and
     * nearest-rank always returns a value that actually occurred.
     *
     * @param  array<int, float|int>  $values
     */
    private function percentile(array $values, float $percentile): ?float
    {
        $values = array_values(array_filter($values, fn ($v) => $v !== null));

        if (empty($values)) {
            return null;
        }

        sort($values);

        $rank = (int) ceil($percentile / 100 * count($values));

        return (float) $values[max(0, $rank - 1)];
    }

    /**
     * "Sarah Al-Rashid" → "S. Al-Rashid". Used on the partner view, where the
     * full client name is more than the partner is entitled to see.
     */
    private function abbreviateName(?string $name): ?string
    {
        $parts = array_values(array_filter(explode(' ', trim((string) $name))));

        if (count($parts) < 2) {
            return $parts[0] ?? null;
        }

        return mb_substr($parts[0], 0, 1).'. '.implode(' ', array_slice($parts, 1));
    }
}
