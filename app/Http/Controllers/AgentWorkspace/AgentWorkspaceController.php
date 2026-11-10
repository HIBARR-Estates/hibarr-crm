<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Http\Controllers\AccountBaseController;
use App\Models\Company;
use App\Models\TaskboardColumn;
use App\Models\TaskCategory;
use App\Services\Dashboard\DashboardMetricsService;
use App\Support\UserTimezone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
    /**
     * Longest span one agenda request may cover: a month grid shows six
     * weeks at most (the days before the 1st and after the last).
     */
    public const AGENDA_MAX_DAYS = 42;

    /** Rows per kind in one agenda response; a month of a busy agent fits well inside. */
    public const AGENDA_ROWS = 300;

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
            'schedule' => Inertia::defer(function () use ($metrics, $userId) {
                $zone = $this->viewerZone();
                $start = now($zone)->startOfDay();
                $end = now($zone)->endOfDay();

                return [
                    'meetings' => $metrics->meetingsBetween($userId, $start, $end),
                    'tasks' => $metrics->personalTasksBetween($userId, $start, $end),
                ];
            }, 'schedule'),
        ]);
    }

    /**
     * Today › Agenda: the viewer's meetings and pending tasks for the days
     * the agenda shows (a list of seven days, a week or a month grid).
     *
     * A JSON read rather than a deferred prop: moving between weeks or
     * months is client-side, and the page caches each range and fetches the
     * next one ahead, so going forward or back is instant. Dates are days in
     * the viewer's own zone, like Today's schedule.
     */
    public function agenda(Request $request, DashboardMetricsService $metrics): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $zone = $this->viewerZone();
        $from = Carbon::createFromFormat('Y-m-d', $validated['from'], $zone)->startOfDay();
        $to = Carbon::createFromFormat('Y-m-d', $validated['to'], $zone)->endOfDay();

        if ($from->diffInDays($to) >= self::AGENDA_MAX_DAYS) {
            return response()->json([
                'message' => __('pages.agent_workspace.agenda.range_too_long', ['days' => self::AGENDA_MAX_DAYS]),
            ], 422);
        }

        $userId = (int) user()->id;

        return response()->json([
            'meetings' => $metrics->meetingsBetween($userId, $from, $to, self::AGENDA_ROWS),
            'tasks' => $metrics->personalTasksBetween($userId, $from, $to, self::AGENDA_ROWS),
        ]);
    }

    /** The zone the viewer reads days in: theirs, else the company's. */
    private function viewerZone(): string
    {
        $company = company();

        return UserTimezone::forViewer(user(), $company instanceof Company ? $company : null);
    }
}
