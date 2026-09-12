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
use App\Support\DashboardDateRange;
use App\Support\FeatureFlags;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * The v2 dashboards: a personal landing page plus the role-scoped views.
 *
 * Behind crm.personal-dashboard, the personal dashboard (?view=personal, or no
 * ?view= at all) is the default for everyone. The role-scoped views are
 * additional, unlocked independently by their own view_*_dashboard permission
 * — a user may hold several (a manager commonly holds team + downline) and
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
        'view_manager_dashboard' => 'manager',
        'view_team_dashboard' => 'team',
        'view_leadership_dashboard' => 'leadership',
        'view_partner_dashboard' => 'partner',
    ];

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
        $range = DashboardDateRange::fromRequest($request);

        return Inertia::render('Dashboard/V2/DashboardV2', [
            'availableViews' => $availableViews,
            'activeView' => $activeView,
            'personalDashboardEnabled' => $personalDashboardEnabled,
            // The resolved window, not the raw query string: a custom range
            // the picker sends back has already been validated by the time the
            // page renders it, so the two can never disagree.
            'range' => $range->toArray(),
            'now' => now()->toIso8601String(),
            // Every view wears the same greeting header as the personal
            // dashboard, so the name travels with the role views too.
            'userName' => $user->name,
            ...$this->deferredFor($activeView, $userId, $metrics, $pipelineId, $range),
        ]);
    }

    /**
     * The default landing page behind the flag: what one person owes now.
     *
     * Everyone gets it first; anyone who also holds a view_*_dashboard
     * permission gets the same switcher the role views carry, into
     * ?view=manager|team|leadership|partner.
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
            // The full permission- and flag-gated list, same as the role views
            // get. Which of them become tabs — and which are shown greyed as
            // not-yet-offered — is buildSwitcher's call on the frontend, so
            // both pages render the same switcher. Narrowing it here instead
            // would make the personal dashboard's switcher disagree with the
            // one on the view it switches to.
            'availableViews' => $availableViews,
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
     * Only the active view's data is deferred — switching views is a fresh visit
     * with ?view=, so we never pay for panels nobody is looking at.
     */
    private function deferredFor(
        string $view,
        int $userId,
        DashboardMetricsService $metrics,
        ?int $pipelineId = null,
        ?DashboardDateRange $range = null
    ): array {
        $range ??= DashboardDateRange::preset(DashboardDateRange::DEFAULT_DAYS);

        // The manager view's panels still take a day count. Handing them the
        // resolved range's length keeps one picker driving both views without
        // rewriting metrics this change isn't touching.
        $days = $range->days();
        // Resolved once per request rather than inside every closure: each view
        // fans out to several panels that all need the same scope.
        $team = fn () => $metrics->teamAgentIds($userId);

        return match ($view) {
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

            'team' => $this->teamPanels($userId, $range),

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
     * The team view's panels: the headline row, the graph, the charts, recent
     * activity.
     *
     * Five groups so each piece paints as soon as its own cost is paid, rather
     * than the slowest panel holding up the rest:
     *  - 'summary': the tile row minus forecast — cheap aggregates only.
     *  - 'network': the graph and the forecast tile together. Both run
     *    MlmCommissionService::preview() over every open deal in the team, and
     *    TeamDownlineService memoises that within one request — split across
     *    groups (separate requests, separate instances) it would be paid twice.
     *  - 'trend' / 'growth' / 'recent': independent aggregates, each its own
     *    query, none needing what the others compute.
     *
     * @return array<string, mixed>
     */
    private function teamPanels(int $userId, DashboardDateRange $range): array
    {
        $team = app(TeamDownlineService::class);

        // Deferred rather than resolved here: an account with no lead_agent row
        // has no team, and the lookup belongs behind the same skeleton as the
        // data it anchors.
        $root = fn () => $team->rootAgent($userId);

        return [
            'teamSummary' => Inertia::defer(
                fn () => ($agent = $root()) ? $team->summary($agent, $range) : null,
                'summary'
            ),
            'teamForecast' => Inertia::defer(
                fn () => ($agent = $root()) ? $team->teamForecast($agent) : null,
                'network'
            ),
            'teamTree' => Inertia::defer(
                fn () => ($agent = $root()) ? $team->tree($agent, $range) : null,
                'network'
            ),
            'teamCommissionTrend' => Inertia::defer(
                fn () => ($agent = $root()) ? $team->commissionTrend($agent, $range) : null,
                'trend'
            ),
            'teamGrowth' => Inertia::defer(
                fn () => ($agent = $root()) ? $team->growth($agent, $range) : null,
                'growth'
            ),
            'teamRecentCommissions' => Inertia::defer(
                fn () => ($agent = $root()) ? $team->recentCommissions($agent) : null,
                'recent'
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
