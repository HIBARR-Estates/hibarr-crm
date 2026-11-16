<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Http\Controllers\AccountBaseController;
use App\Models\Company;
use App\Services\AgentWorkspace\EarningsPresenter;
use App\Services\AgentWorkspace\ReportWindows;
use App\Services\Reporting\ReportingService;
use App\Support\UserTimezone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Earnings › My report (L7-38): the agent's own counts for a period, with the
 * period before it for comparison. It runs on the classic Agent Reports
 * service, always for the agent's own records. The lists under the cards and
 * the AI summary keep calling the classic /account/agent-reports endpoints,
 * so no report logic is repeated here.
 */
class MyReportController extends AccountBaseController
{
    public function __construct(private ReportingService $reporting)
    {
        parent::__construct();
        $this->pageTitle = 'pages.agent_workspace.nav.earnings';
    }

    public function show(Request $request): Response
    {
        $agent = EarningsPresenter::agentFor(user());
        $range = ReportWindows::normalise($request->query('range'));

        return Inertia::render('AgentWorkspace/Earnings', [
            'view' => 'report',
            'pageTitle' => __('pages.agent_workspace.nav.earnings'),
            'currencySymbol' => EarningsPresenter::currencySymbol(),
            'isAgent' => $agent !== null,
            // The lists and the AI summary below the cards are the classic Agent Reports endpoints, asked for this agent.
            'agentId' => $agent?->id,
            'agentName' => user()->name,
            'range' => $range,
            'windows' => ReportWindows::all($this->now()),
            'kpi' => Inertia::defer(fn () => $agent ? $this->kpi($range) : null, 'kpi'),
        ]);
    }

    /** The cards for one period, fetched when the agent switches the period. */
    public function kpiFor(Request $request): JsonResponse
    {
        abort_if(EarningsPresenter::agentFor(user()) === null, 403);

        $range = $request->query('range');
        abort_unless(in_array($range, ReportWindows::KEYS, true), 422);

        return response()->json($this->kpi($range));
    }

    /**
     * Counts for the period and for the one before it. Notes are two cards
     * (lead notes, deal notes) and carry no comparison, as on the board.
     */
    private function kpi(string $range): array
    {
        $window = ReportWindows::for($range, $this->now());
        $agentIds = $this->reporting->resolveAgentIds(null, 'agent', user());

        $count = function (string $start, string $end) use ($agentIds) {
            $from = Carbon::parse($start);
            $to = Carbon::parse($end);

            return [
                'leads' => $this->reporting->leadMetrics()->count($agentIds, $from, $to),
                'deals_created' => $this->reporting->dealMetrics()->countCreated($agentIds, $from, $to),
                'deals_closed' => $this->reporting->dealMetrics()->countClosed($agentIds, $from, $to),
                'meetings' => $this->reporting->meetingMetrics()->count($agentIds, $from, $to),
            ];
        };

        $from = Carbon::parse($window['start']);
        $to = Carbon::parse($window['end']);

        return [
            'range' => $range,
            'start' => $window['start'],
            'end' => $window['end'],
            'current' => $count($window['start'], $window['end']) + [
                'lead_notes' => $this->reporting->noteMetrics()->leadNotesCount($agentIds, $from, $to),
                'deal_notes' => $this->reporting->noteMetrics()->dealNotesCount($agentIds, $from, $to),
            ],
            'previous' => $count($window['prev_start'], $window['prev_end']),
            'prev_start' => $window['prev_start'],
        ];
    }

    /** Today in the agent's own time zone, so "this week" starts on their Monday. */
    private function now(): Carbon
    {
        $company = company();

        return now(UserTimezone::forViewer(user(), $company instanceof Company ? $company : null));
    }
}
