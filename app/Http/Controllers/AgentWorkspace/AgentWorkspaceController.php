<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Http\Controllers\AccountBaseController;
use App\Models\Company;
use App\Models\TaskboardColumn;
use App\Models\TaskCategory;
use App\Services\Dashboard\DashboardMetricsService;
use App\Support\UserTimezone;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The agent workspace at /agent. Access is checked by the route middleware
 * (EnsureAgentWorkspaceAccess); every page renders inside the persistent
 * AgentWorkspaceLayout, so only page-specific props are sent here and
 * everything beyond the first paint is deferred.
 */
class AgentWorkspaceController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'pages.agent_workspace.today.title';
    }

    /**
     * Today › My work. Runs on the personal dashboard's own data
     * (DashboardMetricsService), split into three deferred groups that load in
     * parallel after the first paint: the task queue, the stat chips, and
     * today's schedule.
     */
    public function today(DashboardMetricsService $metrics): Response
    {
        $user = user();
        $userId = (int) $user->id;

        return Inertia::render('AgentWorkspace/Today', [
            'pageTitle' => __('pages.agent_workspace.today.title'),
            'userName' => $user->name,
            'userId' => $userId,
            'now' => now()->toIso8601String(),
            'windowDays' => DashboardMetricsService::PERSONAL_WINDOW_DAYS,

            // Same group as the queue: the task modal cannot render its status
            // control or category picker without these.
            'queue' => Inertia::defer(fn () => $metrics->personalQueue($userId), 'queue'),
            'taskBoardColumns' => Inertia::defer(
                fn () => TaskboardColumn::orderBy('priority')
                    ->get(['id', 'slug', 'column_name', 'label_color', 'priority']),
                'queue'
            ),
            'taskCategories' => Inertia::defer(fn () => TaskCategory::allCategories(), 'queue'),

            'stats' => Inertia::defer(fn () => $metrics->personalStats($userId), 'stats'),
            // null for anyone without a lead_agent record: the chip is dropped
            // rather than showing a zero that reads as "you earned nothing".
            'commission' => Inertia::defer(fn () => $metrics->commissionSummary($userId), 'stats'),
            'openDeals' => Inertia::defer(fn () => $metrics->openDealsByPipeline($userId), 'stats'),

            // The viewer's own calendar day, not the server's: the schedule
            // answers "what is on today" for the person reading it.
            'schedule' => Inertia::defer(function () use ($metrics, $user, $userId) {
                $company = company();
                $zone = UserTimezone::forViewer($user, $company instanceof Company ? $company : null);
                $start = now($zone)->startOfDay();
                $end = now($zone)->endOfDay();

                return [
                    'meetings' => $metrics->meetingsBetween($userId, $start, $end),
                    'tasks' => $metrics->personalTasksBetween($userId, $start, $end),
                ];
            }, 'schedule'),
        ]);
    }
}
