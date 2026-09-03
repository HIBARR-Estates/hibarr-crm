<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\TaskboardColumn;
use App\Services\CrmEventService;
use App\Services\Dashboard\DashboardMetricsService;
use App\Services\MlmCommissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * The v2 role-scoped dashboards.
 *
 * One controller, four scoped views. Which views a user can see comes from the
 * view_*_dashboard permissions, which are granted independently — a user may hold
 * several (leadership commonly holds agent + leadership) and gets a switcher.
 * Partner is gated twice: on the permission, and on the account actually having
 * referral data, because the permission alone cannot express "is a partner".
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

        // Holding no v2 permission is the normal state for most accounts, not an
        // error. Behind the flag, that's exactly who the personal dashboard is
        // for — a plain employee with none of the view_*_dashboard permissions —
        // so they land there instead of bouncing to the legacy dashboard.
        if (empty($availableViews)) {
            if (FeatureFlags::enabled('crm.personal-dashboard')) {
                return $this->personalDashboard($userId, (int) $user->company_id, $metrics);
            }

            return redirect()->route('dashboard');
        }

        $activeView = in_array($request->query('view'), $availableViews, true)
            ? $request->query('view')
            : $availableViews[0];

        $pipelineId = $request->integer('pipeline') ?: null;
        $days = $this->period($request);

        return Inertia::render('Dashboard/V2/DashboardV2', [
            'availableViews' => $availableViews,
            'activeView' => $activeView,
            'period' => $days,
            'now' => now()->toIso8601String(),
            ...$this->deferredFor($activeView, $userId, $metrics, $pipelineId, $days),
        ]);
    }

    /**
     * The task-oriented landing page for a plain employee — someone with none
     * of the view_*_dashboard permissions, so no role-scoped view applies.
     *
     * Deliberately not one of VIEWS: it has no switcher, no period picker, and
     * isn't scoped to a team or company, so it doesn't belong in deferredFor()'s
     * per-view match. It reuses this controller's existing "where does a user
     * with no v2 permission land" decision rather than adding a second one.
     */
    private function personalDashboard(int $userId, int $companyId, DashboardMetricsService $metrics)
    {
        return Inertia::render('Dashboard/V2/PersonalDashboard', [
            'now' => now()->toIso8601String(),
            'todaysTasks' => Inertia::defer(fn () => $metrics->todaysTasks($userId), 'tasks'),
            'taskBoardColumns' => Inertia::defer(
                fn () => TaskboardColumn::orderBy('priority')
                    ->get(['id', 'slug', 'column_name', 'label_color', 'priority']),
                'tasks'
            ),
            'followUpsDue' => Inertia::defer(fn () => $metrics->followUpsDue($userId), 'followups'),
            'recentActivity' => Inertia::defer(
                fn () => $metrics->recentActivity($userId, $companyId, app(CrmEventService::class)),
                'activity'
            ),
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
