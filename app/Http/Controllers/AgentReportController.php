<?php

namespace App\Http\Controllers;

use App\Contracts\AiSummaryInterface;
use App\Exports\AgentReportExport;
use App\Http\Requests\ReportFilterRequest;
use App\Models\LeadAgent;
use App\Models\Team;
use App\Services\Reporting\ReportingService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class AgentReportController extends AccountBaseController
{
    public function __construct(
        private ReportingService $reportingService,
        private AiSummaryInterface $aiSummary,
    ) {
        parent::__construct();
        $this->pageTitle = 'Agent Reports';

        $this->middleware(function ($request, $next) {
            $user = user();
            $viewType = $request->input('view_type', 'agent');
            $agentId = $request->input('agent_id');

            $permission = $user->permission('view_lead_report');

            // Non-admins: cannot use department view or view other agents
            if ($permission !== 'all') {
                if ($viewType === 'department') {
                    abort(403);
                }

                if ($agentId) {
                    $ownAgent = LeadAgent::where('user_id', $user->id)->first();

                    if (!$ownAgent || (int) $agentId !== $ownAgent->id) {
                        abort(403);
                    }
                }
            }

            return $next($request);
        });
    }

    /**
     * Main Inertia page — renders the Reports/Index page with KPI summary.
     */
    public function index(ReportFilterRequest $request)
    {
        $validated = $request->validated();
        $user = user();

        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);
        $viewType = $validated['view_type'];
        $agentId = $validated['agent_id'] ?? null;

        $agentIds = $this->reportingService->resolveAgentIds($agentId, $viewType, $user);

        $kpiSummary = $this->reportingService->getKpiSummary($start, $end, $agentIds);

        // Build agent list for the admin switcher
        $agents = [];
        $permission = $user->permission('view_lead_report');

        if ($permission === 'all') {
            $agents = LeadAgent::with('user:id,name,image')
                ->where('status', 'enabled')
                ->get()
                ->map(fn ($a) => [
                    'id' => $a->id,
                    'name' => $a->user?->name ?? 'Unknown',
                    'image' => $a->user?->image_url ?? null,
                ]);
        }

        // Get departments for admin
        $departments = [];

        if ($permission === 'all') {
            $departments = Team::select('id', 'team_name')->orderBy('team_name')->get();
        }

        // Current agent context
        $currentAgent = null;

        if ($viewType === 'agent' && !empty($agentIds)) {
            $agent = LeadAgent::with('user:id,name')->find($agentIds[0]);
            $currentAgent = $agent ? ['id' => $agent->id, 'name' => $agent->user?->name] : null;
        }

        $departmentName = $viewType === 'department'
            ? $this->reportingService->getDepartmentName($user)
            : null;

        return Inertia::render('Reports/Index', [
            'pageTitle' => 'Agent Reports',
            'kpiSummary' => $kpiSummary,
            'filters' => [
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
                'agent_id' => $agentId,
                'view_type' => $viewType,
            ],
            'agents' => $agents,
            'departments' => $departments,
            'currentAgent' => $currentAgent,
            'departmentName' => $departmentName,
            'canViewAll' => $permission === 'all',
        ]);
    }

    /**
     * Paginated lead list (JSON).
     */
    public function leads(ReportFilterRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $agentIds = $this->resolveIds($validated);
        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);

        $data = $this->reportingService->leadMetrics()->list(
            $agentIds, $start, $end, (int) $request->input('per_page', 15)
        );

        return response()->json($data);
    }

    /**
     * Paginated deals created list (JSON).
     */
    public function dealsCreated(ReportFilterRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $agentIds = $this->resolveIds($validated);
        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);

        $data = $this->reportingService->dealMetrics()->listCreated(
            $agentIds, $start, $end, (int) $request->input('per_page', 15)
        );

        return response()->json($data);
    }

    /**
     * Paginated deals closed list (JSON).
     */
    public function dealsClosed(ReportFilterRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $agentIds = $this->resolveIds($validated);
        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);

        $data = $this->reportingService->dealMetrics()->listClosed(
            $agentIds, $start, $end, (int) $request->input('per_page', 15)
        );

        return response()->json($data);
    }

    /**
     * Paginated meetings list (JSON).
     */
    public function meetings(ReportFilterRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $agentIds = $this->resolveIds($validated);
        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);

        $data = $this->reportingService->meetingMetrics()->list(
            $agentIds, $start, $end, (int) $request->input('per_page', 15)
        );

        return response()->json($data);
    }

    /**
     * Paginated deal notes list (JSON).
     */
    public function dealNotes(ReportFilterRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $agentIds = $this->resolveIds($validated);
        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);

        $data = $this->reportingService->noteMetrics()->listDealNotes(
            $agentIds, $start, $end, (int) $request->input('per_page', 15)
        );

        return response()->json($data);
    }

    /**
     * Paginated lead notes list (JSON).
     */
    public function leadNotes(ReportFilterRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $agentIds = $this->resolveIds($validated);
        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);

        $data = $this->reportingService->noteMetrics()->listLeadNotes(
            $agentIds, $start, $end, (int) $request->input('per_page', 15)
        );

        return response()->json($data);
    }

    /**
     * Trigger AI summary generation (manual, cached per session).
     */
    public function aiSummary(ReportFilterRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $agentIds = $this->resolveIds($validated);
        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);
        $viewType = $validated['view_type'];

        // Build a cache key unique to this user + filters
        $cacheKey = 'ai_summary:' . user()->id . ':' . md5(implode(',', $agentIds) . $start . $end);

        $summary = Cache::get($cacheKey);

        if (!$summary) {
            $notesText = $this->reportingService->noteMetrics()
                ->getBodiesForAi($agentIds, $start, $end);

            $context = $viewType === 'department'
                ? ($this->reportingService->getDepartmentName(user()) ?? 'Department')
                : ($this->resolveAgentName($agentIds) ?? 'Agent');

            $summary = $this->aiSummary->summarize(
                $notesText,
                $context,
                $start->toFormattedDateString(),
                $end->toFormattedDateString()
            );

            // Cache for the duration of the session (1 hour fallback)
            Cache::put($cacheKey, $summary, now()->addHour());
        }

        return response()->json(['summary' => $summary]);
    }

    /**
     * Export report as CSV/Excel.
     */
    public function export(ReportFilterRequest $request)
    {
        $validated = $request->validated();
        $agentIds = $this->resolveIds($validated);
        $start = Carbon::parse($validated['start_date']);
        $end = Carbon::parse($validated['end_date']);
        $format = $request->input('format', 'xlsx');

        $export = new AgentReportExport(
            $this->reportingService,
            $agentIds,
            $start,
            $end
        );

        $filename = 'agent-report-' . $start->format('Y-m-d') . '-to-' . $end->format('Y-m-d');

        if ($format === 'pdf') {
            return Excel::download($export, $filename . '.pdf', \Maatwebsite\Excel\Excel::DOMPDF);
        }

        return Excel::download($export, $filename . '.xlsx');
    }

    /**
     * Helper to resolve agent IDs from validated request data.
     */
    private function resolveIds(array $validated): array
    {
        return $this->reportingService->resolveAgentIds(
            $validated['agent_id'] ?? null,
            $validated['view_type'],
            user()
        );
    }

    private function resolveAgentName(array $agentIds): ?string
    {
        if (empty($agentIds)) {
            return null;
        }

        $agent = LeadAgent::with('user:id,name')->find($agentIds[0]);

        return $agent?->user?->name;
    }
}
