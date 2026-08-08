<?php

namespace App\Services\Dashboard;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadSetting;
use App\Models\LeadSource;
use App\Models\MlmCommission;
use App\Models\PipelineStage;
use App\Models\Task;
use App\Models\TaskboardColumn;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Query layer behind the v2 dashboards.
 *
 * Every method takes an explicit scope (a user id, or a set of lead_agent ids)
 * rather than reading auth() internally — the same query serves the agent view
 * scoped to one person and the manager view scoped to a team, which is what
 * keeps this from becoming four parallel dashboards.
 *
 * Company scoping is automatic via CompanyScope on the models.
 *
 * Only metrics the data actually supports are here. Notably absent, and
 * deliberately so: quota/target progress (no targets exist anywhere) and
 * cost-per-lead / channel ROI (no spend data is fed into the CRM).
 */
class DashboardMetricsService
{
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

        if (!$agent) {
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
     */
    public function actionQueue(int $userId): array
    {
        return [
            'overdueTasks' => $this->overdueTasks($userId),
            'hotLeads' => $this->hotLeadsNeedingContact($userId),
            'stalledDeals' => $this->stalledDeals($this->agentIdsForUser($userId)),
        ];
    }

    private function overdueTasks(int $userId): array
    {
        return Task::query()
            ->pending()
            ->visibleToUser($userId)
            ->whereNotNull('due_date')
            ->where('due_date', '<', now())
            ->orderBy('due_date')
            ->limit(25)
            ->get(['id', 'heading', 'due_date'])
            ->map(fn (Task $task) => [
                'id' => $task->id,
                'heading' => $task->heading,
                'due_date' => $task->due_date,
                'days_overdue' => (int) now()->startOfDay()->diffInDays(
                    Carbon::parse($task->due_date)->startOfDay()
                ),
            ])
            ->all();
    }

    /**
     * Hot/warm leads the agent owns that have never been contacted. Uses the
     * first_contacted_at stamp — NULL genuinely means "no agent activity yet".
     */
    private function hotLeadsNeedingContact(int $userId): array
    {
        return Lead::query()
            ->where('lead_owner', $userId)
            ->whereNull('first_contacted_at')
            ->whereIn('temperature', ['hot', 'warm'])
            ->orderByRaw("FIELD(temperature, 'hot', 'warm')")
            ->orderBy('created_at')
            ->limit(25)
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
    public function stalledDeals(array $agentIds): array
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
            ->orderBy('deals.stage_entered_at')
            ->limit(25)
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
     * The agent's own small numbers. No quota — none exists in the system.
     */
    public function agentStats(int $userId): array
    {
        $agentIds = $this->agentIdsForUser($userId);
        $doneColumnId = TaskboardColumn::completeColumn()?->id;

        $base = fn () => Deal::query()->whereIn('agent_id', $agentIds ?: [0]);

        return [
            'openDeals' => $base()->whereNull('outcome_status')->count(),
            'wonThisMonth' => $base()
                ->where('outcome_status', 'won')
                ->where('updated_at', '>=', now()->startOfMonth())
                ->count(),
            'closingThisWeek' => $base()
                ->whereNull('outcome_status')
                ->whereBetween('close_date', [now()->startOfWeek(), now()->endOfWeek()])
                ->count(),
            'openTasks' => Task::query()
                ->when($doneColumnId, fn ($q) => $q->where('board_column_id', '<>', $doneColumnId))
                ->visibleToUser($userId)
                ->count(),
        ];
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
            ->when(!empty($agentIds), fn ($q) => $q->whereIn('deals.agent_id', $agentIds))
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

                if (!empty($agentIds)) {
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

        return [
            'pipelines' => $available,
            'pipeline_id' => $selectedId,
            'stages' => $stages,
        ];
    }

    /**
     * Per-agent comparison — the coaching surface.
     *
     * avg_response_hours is only meaningful for leads stamped since first-contact
     * tracking went live; leads with a NULL stamp are excluded rather than counted
     * as instant or infinite.
     */
    public function leaderboard(array $agentIds): array
    {
        if (empty($agentIds)) {
            return [];
        }

        $agents = LeadAgent::with('user:id,name,image')
            ->whereIn('id', $agentIds)
            ->get();

        $dealStats = Deal::query()
            ->whereIn('agent_id', $agentIds)
            ->groupBy('agent_id')
            ->toBase()
            ->get([
                'agent_id',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(outcome_status = 'won') as won"),
                DB::raw("SUM(outcome_status = 'lost') as lost"),
                DB::raw('SUM(outcome_status IS NULL) as open_deals'),
            ])
            ->keyBy('agent_id');

        $responseStats = Lead::query()
            ->whereNotNull('first_contacted_at')
            ->whereNotNull('assigned_at')
            ->whereIn('lead_owner', $agents->pluck('user_id')->filter()->all() ?: [0])
            ->groupBy('lead_owner')
            ->toBase()
            ->get([
                'lead_owner',
                DB::raw('AVG(TIMESTAMPDIFF(HOUR, assigned_at, first_contacted_at)) as avg_hours'),
            ])
            ->keyBy('lead_owner');

        return $agents->map(function (LeadAgent $agent) use ($dealStats, $responseStats) {
            $deals = $dealStats->get($agent->id);
            $won = (int) ($deals->won ?? 0);
            $lost = (int) ($deals->lost ?? 0);
            $decided = $won + $lost;
            $response = $responseStats->get($agent->user_id);

            return [
                'agent_id' => $agent->id,
                'name' => $agent->user?->name ?? 'Unknown',
                'image' => $agent->user?->image_url,
                'won' => $won,
                'lost' => $lost,
                'open' => (int) ($deals->open_deals ?? 0),
                // NULL, not 0, when nothing has been decided yet — an agent with no
                // closed deals has no win rate, which is different from a 0% one.
                'win_rate' => $decided > 0 ? round($won / $decided * 100, 1) : null,
                'avg_response_hours' => $response ? round((float) $response->avg_hours, 1) : null,
            ];
        })->sortByDesc('won')->values()->all();
    }

    /**
     * Leads past the first-contact SLA and still untouched.
     *
     * Excludes leads created before first-contact tracking existed: for those a
     * NULL stamp means "unknown", not "never contacted", and counting them would
     * make every agent look permanently in breach.
     */
    public function slaBreaches(array $agentIds): array
    {
        $slaHours = (int) (LeadSetting::value('first_contact_sla_hours') ?: 24);
        $trackingSince = $this->firstContactTrackingSince();

        $ownerIds = LeadAgent::whereIn('id', $agentIds)->pluck('user_id')->filter()->all();

        $query = Lead::query()
            ->whereNull('first_contacted_at')
            ->where('created_at', '<', now()->subHours($slaHours))
            ->when($trackingSince, fn ($q) => $q->where('created_at', '>=', $trackingSince))
            ->when(!empty($ownerIds), fn ($q) => $q->whereIn('lead_owner', $ownerIds));

        return [
            'sla_hours' => $slaHours,
            'count' => (clone $query)->count(),
            'leads' => $query
                ->orderBy('created_at')
                ->limit(25)
                ->get(['id', 'client_name', 'created_at', 'temperature'])
                ->map(fn (Lead $lead) => [
                    'id' => $lead->id,
                    'client_name' => $lead->client_name,
                    'temperature' => $lead->temperature?->value,
                    'waiting_hours' => (int) $lead->created_at->diffInHours(now()),
                ])
                ->all(),
        ];
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
    public function pipelineValueByCurrency(): array
    {
        return Deal::query()
            ->leftJoin('currencies', 'currencies.id', '=', 'deals.currency_id')
            ->whereNull('deals.outcome_status')
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

                if (!empty($agentIds)) {
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
                DB::raw("SUM(leads.lead_lifecycle_status_id IS NOT NULL AND leads.first_contacted_at IS NOT NULL) as contacted"),
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

        return [
            'referredLeads' => $totalReferred,
            'convertedLeads' => $converted,
            'conversionRate' => $totalReferred > 0
                ? round($converted / $totalReferred * 100, 1)
                : null,
            'commissionsByStatus' => $commissions,
        ];
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
        $earliest = Lead::whereNotNull('first_contacted_at')->min('first_contacted_at');

        return $earliest ? Carbon::parse($earliest) : null;
    }
}
