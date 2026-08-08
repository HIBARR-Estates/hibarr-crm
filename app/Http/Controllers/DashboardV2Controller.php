<?php

namespace App\Http\Controllers;

use App\Models\LeadAgent;
use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * The v2 role-scoped dashboards.
 *
 * One controller, four scoped views. Which views a user can see comes from the
 * view_*_dashboard permissions, which are granted independently — a user may hold
 * several (leadership commonly holds agent + leadership) and gets a switcher.
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

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.dashboard';
    }

    public function index(Request $request, DashboardMetricsService $metrics)
    {
        $user = user();
        $availableViews = $this->availableViews();

        if (empty($availableViews)) {
            abort(403, 'No dashboard view is available for this account.');
        }

        $activeView = in_array($request->query('view'), $availableViews, true)
            ? $request->query('view')
            : $availableViews[0];

        $userId = (int) $user->id;
        $pipelineId = $request->integer('pipeline') ?: null;

        return Inertia::render('Dashboard/V2/DashboardV2', [
            'availableViews' => $availableViews,
            'activeView' => $activeView,
            ...$this->deferredFor($activeView, $userId, $metrics, $pipelineId),
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
        ?int $pipelineId = null
    ): array {
        return match ($view) {
            'agent' => [
                'actionQueue' => Inertia::defer(fn () => $metrics->actionQueue($userId), 'queue'),
                'agentStats' => Inertia::defer(fn () => $metrics->agentStats($userId), 'stats'),
            ],

            'manager' => [
                'stageFunnel' => Inertia::defer(
                    fn () => $metrics->stageFunnel($metrics->teamAgentIds($userId), $pipelineId),
                    'pipeline'
                ),
                'leaderboard' => Inertia::defer(
                    fn () => $metrics->leaderboard($metrics->teamAgentIds($userId)),
                    'team'
                ),
                'slaBreaches' => Inertia::defer(
                    fn () => $metrics->slaBreaches($metrics->teamAgentIds($userId)),
                    'team'
                ),
                'stalledDeals' => Inertia::defer(
                    fn () => $metrics->stalledDeals($metrics->teamAgentIds($userId)),
                    'pipeline'
                ),
            ],

            'leadership' => [
                'trend' => Inertia::defer(fn () => $metrics->trend(), 'trend'),
                'marketSegments' => Inertia::defer(fn () => $metrics->marketSegments(), 'segments'),
                'pipelineValue' => Inertia::defer(fn () => $metrics->pipelineValueByCurrency(), 'segments'),
                'sourceBreakdown' => Inertia::defer(fn () => $metrics->sourceBreakdown(), 'segments'),
            ],

            'partner' => [
                'partnerStats' => Inertia::defer(function () use ($userId, $metrics) {
                    $agent = LeadAgent::where('user_id', $userId)->first();

                    // No agent record means nothing was ever attributed to them.
                    // Return empty rather than falling back to a wider scope.
                    return $agent ? $metrics->partnerStats($agent->id) : null;
                }, 'partner'),
            ],

            default => [],
        };
    }

    /** @return array<int, string> */
    private function availableViews(): array
    {
        $user = user();

        return collect(self::VIEWS)
            ->filter(fn ($view, $permission) => $user->permission($permission) === 'all')
            ->values()
            ->all();
    }
}
