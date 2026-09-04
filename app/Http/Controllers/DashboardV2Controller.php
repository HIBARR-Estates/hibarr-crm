<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\TaskboardColumn;
use App\Models\TaskCategory;
use App\Services\CrmEventService;
use App\Services\Dashboard\DashboardMetricsService;
use App\Services\Dashboard\TeamDownlineService;
use App\Services\MeetingVisibilityService;
use App\Services\MlmCommissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * The v2 dashboards: a personal landing page plus the role-scoped views.
 *
 * Behind crm.personal-dashboard, the personal dashboard (?view=personal, or no
 * ?view= at all) is the default for everyone. The role-scoped views are
 * additional, unlocked independently by their own view_*_dashboard permission
 * — a user may hold several (leadership commonly holds agent + leadership) and
 * gets a switcher into them, but holding one never hides the personal view.
 * Partner is gated twice: on the permission, and on the account actually having
 * referral data, because the permission alone cannot express "is a partner".
 * Team is gated twice as well: on view_team_dashboard, and on the
 * crm.team-dashboard flag — it is the first surface to show commission across a
 * whole hierarchy, so it rolls out per manager rather than all at once.
 *
 * Every panel is deferred. The synchronous payload is just enough to draw the
 * shell and the switcher, matching the pattern in DealController@show.
 */
class DashboardV2Controller extends AccountBaseController
{
    /** Permission name => view key. Order defines switcher order and the default. */
    private const VIEWS = [
        'view_agent_dashboard' => 'agent',
        'view_manager_dashboard' => 'manager',
        'view_team_dashboard' => 'team',
        'view_leadership_dashboard' => 'leadership',
        'view_partner_dashboard' => 'partner',
    ];

    /** Selectable windows, in days. */
    private const PERIODS = [30, 90, 365];

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.dashboard';
    }

    public function index(Request $request, DashboardMetricsService $metrics)
    {
        $user = user();
        $userId = (int) $user->id;
        $availableViews = $this->availableViews();
        $requestedView = $request->query('view');
        $personalDashboardEnabled = FeatureFlags::enabled('crm.personal-dashboard');

        // Behind the flag, the personal dashboard is the default landing for
        // everyone, not just accounts with no view_*_dashboard permission —
        // holding one only adds role-scoped views to the switcher, it doesn't
        // gate this one. A request for a role view falls through below.
        if ($personalDashboardEnabled && ($requestedView === null || $requestedView === 'personal')) {
            return $this->personalDashboard($user, $metrics, $availableViews);
        }

        // Holding no v2 permission is the normal state for most accounts, not an
        // error. With the flag off (or a stale ?view= link), that's where a
        // plain employee bounces to instead.
        if (empty($availableViews)) {
            return redirect()->route('dashboard');
        }

        $activeView = in_array($requestedView, $availableViews, true)
            ? $requestedView
            : $availableViews[0];

        $pipelineId = $request->integer('pipeline') ?: null;
        $days = $this->period($request);

        return Inertia::render('Dashboard/V2/DashboardV2', [
            'availableViews' => $availableViews,
            'activeView' => $activeView,
            'personalDashboardEnabled' => $personalDashboardEnabled,
            'period' => $days,
            'now' => now()->toIso8601String(),
            ...$this->deferredFor($activeView, $userId, $metrics, $pipelineId, $days),
        ]);
    }

    /**
     * The default landing page behind the flag: what one person owes now.
     *
     * Everyone gets it first; anyone who also holds a view_*_dashboard
     * permission gets a switcher into those role-scoped views via
     * ?view=agent|manager|team|leadership|partner.
     *
     * Deliberately not one of VIEWS: it is scoped to a person rather than a
     * team or company, and takes no window parameter at all — one fixed
     * PERSONAL_WINDOW_DAYS look-ahead, not the role views' ?days= picker.
     *
     * Every panel is deferred and grouped so the shell paints immediately: the
     * queue and its board columns land together (a row cannot render its status
     * control without them), the rest arrive independently.
     */
    private function personalDashboard(
        $user,
        DashboardMetricsService $metrics,
        array $availableViews
    ) {
        $userId = (int) $user->id;

        return Inertia::render('Dashboard/V2/PersonalDashboard', [
            'now' => now()->toIso8601String(),
            // Only the team view is offered alongside My work. Company and
            // Partner answer questions this page isn't asking, and a four-way
            // switcher on a personal landing page buries the one view a
            // manager actually crosses to.
            'availableViews' => array_values(array_intersect($availableViews, ['manager'])),
            // Ships so the page's copy and the queries can't drift apart.
            'windowDays' => DashboardMetricsService::PERSONAL_WINDOW_DAYS,
            'userName' => $user->name,
            // The stat strip's badges link into the Leads/Deals/Tasks lists
            // scoped to this user, so the frontend needs the id explicitly
            // rather than reaching into a shared auth prop.
            'userId' => $userId,
            'queue' => Inertia::defer(fn () => $metrics->personalQueue($userId), 'queue'),
            // Same group as the queue: TaskDetailModal cannot render its status
            // control without these, so they must land together.
            'taskBoardColumns' => Inertia::defer(
                fn () => TaskboardColumn::orderBy('priority')
                    ->get(['id', 'slug', 'column_name', 'label_color', 'priority']),
                'queue'
            ),
            'stats' => Inertia::defer(fn () => $metrics->personalStats($userId), 'stats'),
            // null for anyone without a lead_agent record — the tile is
            // dropped rather than showing a zero that reads as "you earned
            // nothing".
            'commission' => Inertia::defer(fn () => $metrics->commissionSummary($userId), 'stats'),
            'agenda' => Inertia::defer(fn () => $metrics->upcomingMeetings($userId), 'agenda'),
            'pipelines' => Inertia::defer(fn () => $metrics->openDealsByPipeline($userId), 'pipelines'),
            // Feeds the agenda's "book a meeting" empty-state action — same
            // permission-scoped queries and shape MeetingsController's own
            // Schedule Meeting drawer already uses.
            'userDeals' => Inertia::defer(
                fn () => MeetingVisibilityService::schedulableDealsQuery()->get(),
                'meetingOptions'
            ),
            'userLeads' => Inertia::defer(
                fn () => MeetingVisibilityService::schedulableLeadsQuery()
                    ->get()
                    ->map(fn (Lead $lead) => [
                        'id' => $lead->id,
                        'name' => $lead->company_name
                            ? "{$lead->client_name} ({$lead->company_name})"
                            : $lead->client_name,
                    ]),
                'meetingOptions'
            ),
            // Only consumed by the redesigned task edit form's category
            // picker (crm.tasks-workspace-redesign) — same query
            // LeadContactController's task-edit integration already ships.
            'taskCategories' => Inertia::defer(fn () => TaskCategory::allCategories(), 'queue'),
            // "Activity on your records" panel is hidden for now (not useful
            // in its current state) — drop the request+query along with it.
            // Re-add when the panel comes back:
            // 'recentActivity' => Inertia::defer(
            //     fn () => $metrics->recentActivity($userId, $companyId, app(CrmEventService::class)),
            //     'activity'
            // ),
        ]);
    }

    /**
     * Window for the team and partner views. Whitelisted rather than clamped —
     * the value reaches raw date arithmetic in the metrics service.
     */
    private function period(Request $request): int
    {
        $days = $request->integer('days');

        return in_array($days, self::PERIODS, true) ? $days : 30;
    }

    /**
     * Only the active view's data is deferred — switching views is a fresh visit
     * with ?view=, so we never pay for panels nobody is looking at.
     */
    private function deferredFor(
        string $view,
        int $userId,
        DashboardMetricsService $metrics,
        ?int $pipelineId = null,
        int $days = 30
    ): array {
        // Resolved once per request rather than inside every closure: each view
        // fans out to several panels that all need the same scope.
        $team = fn () => $metrics->teamAgentIds($userId);

        return match ($view) {
            'agent' => [
                'actionQueue' => Inertia::defer(fn () => $metrics->actionQueue($userId), 'queue'),
                'agentWeek' => Inertia::defer(fn () => $metrics->agentWeek($userId), 'stats'),
                'todaySchedule' => Inertia::defer(fn () => $metrics->todaySchedule($userId), 'schedule'),
                'agentPipeline' => Inertia::defer(fn () => $metrics->agentPipeline($userId), 'pipeline'),
                // Same group as actionQueue: TaskDetailModal cannot render its
                // status control without these, so they must land together.
                'taskBoardColumns' => Inertia::defer(
                    fn () => TaskboardColumn::orderBy('priority')
                        ->get(['id', 'slug', 'column_name', 'label_color', 'priority']),
                    'queue'
                ),
            ],

            'manager' => [
                'teamKpis' => Inertia::defer(fn () => $metrics->teamKpis($team(), $days), 'kpis'),
                'lifecycleFunnel' => Inertia::defer(
                    fn () => $metrics->lifecycleFunnel($team(), max($days, 90)),
                    'funnel'
                ),
                'responseDistribution' => Inertia::defer(
                    fn () => $metrics->responseDistribution($team(), $days),
                    'funnel'
                ),
                'sourceQuality' => Inertia::defer(
                    fn () => $metrics->sourceQuality($team(), max($days, 90)),
                    'sources'
                ),
                'teamAgents' => Inertia::defer(fn () => $metrics->teamAgents($team(), $days), 'team'),
                'openPartnerFlags' => Inertia::defer(
                    fn () => $metrics->openPartnerFlags($team()),
                    'team'
                ),
            ],

            'team' => $this->teamPanels($userId, $days),

            'leadership' => [
                'trend' => Inertia::defer(fn () => $metrics->trend(), 'trend'),
                'marketSegments' => Inertia::defer(fn () => $metrics->marketSegments(), 'segments'),
                'pipelineValue' => Inertia::defer(fn () => $metrics->pipelineValueByCurrency(), 'segments'),
                'sourceBreakdown' => Inertia::defer(fn () => $metrics->sourceBreakdown(), 'segments'),
            ],

            'partner' => [
                'partnerStats' => Inertia::defer(
                    fn () => $this->forPartner($userId, fn ($id) => $metrics->partnerStats($id)),
                    'partner'
                ),
                'partnerFunnel' => Inertia::defer(
                    fn () => $this->forPartner($userId, fn ($id) => $metrics->partnerFunnel($id)),
                    'partner'
                ),
                'partnerTrend' => Inertia::defer(
                    fn () => $this->forPartner($userId, fn ($id) => $metrics->partnerTrend($id)),
                    'referrals'
                ),
                'partnerReferrals' => Inertia::defer(
                    fn () => $this->forPartner($userId, fn ($id) => $metrics->partnerReferrals($id)),
                    'referrals'
                ),
                'partnerForecast' => Inertia::defer(
                    fn () => $this->forPartner(
                        $userId,
                        fn ($id) => $metrics->partnerForecast($id, app(MlmCommissionService::class))
                    ),
                    'partner'
                ),
            ],

            default => [],
        };
    }

    /**
     * The team view's panels: the tree, rolled up by generation and by agent.
     *
     * Split into three groups rather than one so the tiles paint while the
     * tables are still resolving. The two tables share a group deliberately:
     * both need the commission forecast, which runs the commission engine over
     * the tree's open deals, and TeamDownlineService memoises it for the
     * request — landing them separately would pay for it twice.
     *
     * @return array<string, mixed>
     */
    private function teamPanels(int $userId, int $days): array
    {
        $downline = app(TeamDownlineService::class);

        // Deferred rather than resolved here: an account with no lead_agent row
        // has no tree, and the lookup belongs behind the same skeleton as the
        // data it anchors.
        $root = fn () => $downline->rootAgent($userId);

        return [
            'downlineSummary' => Inertia::defer(
                fn () => ($agent = $root()) ? $downline->summary($agent, $days) : null,
                'downline'
            ),
            'downlineLevels' => Inertia::defer(
                fn () => ($agent = $root()) ? $downline->levelRollup($agent, $days) : null,
                'rollup'
            ),
            'downlineAgents' => Inertia::defer(
                fn () => ($agent = $root()) ? $downline->agentRollup($agent, $days) : null,
                'rollup'
            ),
        ];
    }

    /**
     * No agent record means nothing was ever attributed to this account. Return
     * null rather than falling back to a wider scope — this view sits outside
     * the trust boundary, so an unscoped query is the one thing it must not do.
     */
    private function forPartner(int $userId, callable $fn)
    {
        $agent = LeadAgent::where('user_id', $userId)->first();

        return $agent ? $fn($agent->id) : null;
    }

    /** @return array<int, string> */
    private function availableViews(): array
    {
        $user = user();

        return collect(self::VIEWS)
            ->filter(fn ($view, $permission) => $user->permission($permission) === 'all')
            // Permission says "may see the partner view"; this says "has one".
            ->reject(fn ($view) => $view === 'partner' && ! $this->hasPartnerData((int) $user->id))
            // The flag is the second gate on the team view — see the class
            // docblock. Rejecting here rather than in the switcher alone means
            // a hand-typed ?view=team with the flag off falls through to the
            // first view the user does hold, not to an ungated render.
            ->reject(fn ($view) => $view === 'team' && ! FeatureFlags::enabled('crm.team-dashboard'))
            ->values()
            ->all();
    }

    /**
     * Whether this account has anything behind the partner view.
     *
     * A Partner tab with nothing behind it is worse than no tab: it renders the
     * "no partner record" empty state to a staff account and implies the surface
     * exists for them. Two exists() queries, and only for accounts that hold the
     * permission at all.
     */
    private function hasPartnerData(int $userId): bool
    {
        $agentId = LeadAgent::where('user_id', $userId)->value('id');

        if (is_null($agentId)) {
            return false;
        }

        return Lead::where('referred_by_agent_id', $agentId)->exists()
            || MlmCommission::where('agent_id', $agentId)->exists();
    }
}
