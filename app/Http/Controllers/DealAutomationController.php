<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\DealAutomationLog;
use App\Models\EmailTemplate;
use App\Models\Lead;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use App\Models\User;
use App\Services\AutomationFieldCatalog;
use App\Support\AutomationV2Feature;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DealAutomationController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.dealAutomations';
        $this->activeSettingMenu = 'deal_automations';
        $this->middleware(function ($request, $next) {
            return user()->permission('manage_company_setting') !== 'all' ? redirect()->route('profile-settings.index') : $next($request);
        });
    }

    /**
     * List automations with conditions/actions eager-loaded — used by the
     * React Settings/Automation UI. No Blade view owns this route name (the
     * classic list page is SettingsController::deal_automations), so a
     * non-JSON hit just redirects there.
     */
    public function index(Request $request)
    {
        if ($request->wantsJson() || $request->expectsJson()) {
            abort_403(! AutomationV2Feature::enabled());
        }

        $automations = DealAutomation::with(['conditions', 'actions.targetStage', 'actions.emailTemplate'])
            ->orderBy('priority')
            ->orderBy('name')
            ->get();

        if ($request->wantsJson() || $request->expectsJson()) {
            return Reply::dataOnly(['status' => 'success', 'data' => $automations]);
        }

        return redirect()->route('company-settings.deal_automations');
    }

    public function create()
    {
        $this->automation = new DealAutomation(['subject_type' => DealAutomation::SUBJECT_DEAL]);
        $this->shareFormData();

        return view('company-settings.deal-automation.edit', $this->data);
    }

    public function store(Request $request)
    {
        $this->assertLegacyAutomationRequest($request);

        $subjectType = $request->subject_type === DealAutomation::SUBJECT_LEAD
            ? DealAutomation::SUBJECT_LEAD
            : DealAutomation::SUBJECT_DEAL;

        $request->validate($this->validationRules($subjectType));

        DB::beginTransaction();

        try {
            $automation = DealAutomation::create([
                'name' => $request->name,
                'subject_type' => $subjectType,
                'pipeline_id' => $subjectType === DealAutomation::SUBJECT_DEAL ? ($request->pipeline_id ?: null) : null,
                'trigger' => $request->trigger ?: null,
                'date_field' => $this->resolvedTriggerDateField($request),
                'date_recurrence' => $this->resolvedTriggerDateRecurrence($request),
                'wait_duration_value' => $this->resolvedWaitDurationValue($request),
                'wait_duration_unit' => $this->resolvedWaitDurationUnit($request),
                'active' => $request->input('active') ? 1 : 0,
                'priority' => $request->priority,
            ]);

            $this->syncConditions($automation, $request);
            $this->syncActions($automation, $request, $subjectType);

            DB::commit();

            if ($request->wantsJson() || $request->expectsJson()) {
                return Reply::successWithData(__('messages.recordSaved'), [
                    'data' => $automation->load(['conditions', 'actions.targetStage', 'actions.emailTemplate']),
                ]);
            }

            return Reply::redirect(route('company-settings.deal_automations'), __('messages.recordSaved'));

        } catch (\Exception $e) {
            DB::rollBack();

            return Reply::error($e->getMessage());
        }
    }

    public function edit($id)
    {
        $this->automation = DealAutomation::with(['conditions', 'actions'])->findOrFail($id);
        $this->shareFormData();

        return view('company-settings.deal-automation.edit', $this->data);
    }

    public function update(Request $request, $id)
    {
        $this->assertLegacyAutomationRequest($request);

        $automation = DealAutomation::findOrFail($id);

        $subjectType = $request->subject_type === DealAutomation::SUBJECT_LEAD
            ? DealAutomation::SUBJECT_LEAD
            : DealAutomation::SUBJECT_DEAL;

        $request->validate($this->validationRules($subjectType));

        DB::beginTransaction();

        try {
            $automation->update([
                'name' => $request->name,
                'subject_type' => $subjectType,
                'pipeline_id' => $subjectType === DealAutomation::SUBJECT_DEAL ? ($request->pipeline_id ?: null) : null,
                'trigger' => $request->trigger ?: null,
                'date_field' => $this->resolvedTriggerDateField($request),
                'date_recurrence' => $this->resolvedTriggerDateRecurrence($request),
                'wait_duration_value' => $this->resolvedWaitDurationValue($request),
                'wait_duration_unit' => $this->resolvedWaitDurationUnit($request),
                'active' => $request->input('active') ? 1 : 0,
                'priority' => $request->priority,
            ]);

            $automation->conditions()->delete();
            $this->syncConditions($automation, $request);

            $automation->actions()->delete();
            $this->syncActions($automation, $request, $subjectType);

            DB::commit();

            if ($request->wantsJson() || $request->expectsJson()) {
                return Reply::successWithData(__('messages.updateSuccess'), [
                    'data' => $automation->load(['conditions', 'actions.targetStage', 'actions.emailTemplate']),
                ]);
            }

            return Reply::redirect(route('company-settings.deal_automations'), __('messages.updateSuccess'));

        } catch (\Exception $e) {
            DB::rollBack();

            return Reply::error($e->getMessage());
        }
    }

    public function destroy($id)
    {
        DealAutomation::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function changeStatus(Request $request)
    {
        $automation = DealAutomation::findOrFail($request->id);
        $automation->active = $request->status == 'active' ? 1 : 0;
        $automation->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Paginated, filterable run history for the React Run History screen.
     */
    public function logs(Request $request)
    {
        abort_403(! AutomationV2Feature::enabled());

        $perPage = min(max($request->integer('per_page', 25), 1), 100);

        // Paginate *runs*, not steps: one execution of a three-action
        // automation is one row here, with its three steps nested under it.
        $runs = DB::query()
            ->fromSub($this->runsQuery($this->logFilters($request))->getQuery(), 'runs')
            ->orderByDesc('executed_at')
            ->paginate($perPage);

        $runIds = collect($runs->items())->pluck('run_id')->all();

        // Every step of the matched runs, filters deliberately not reapplied —
        // filtering to status=failed should surface the runs that failed, but
        // still show what else happened in them.
        $steps = DealAutomationLog::with(['automation:id,name', 'deal:id,name', 'lead:id,client_name'])
            ->whereIn('run_id', $runIds)
            ->orderBy('executed_at')
            ->orderBy('id')
            ->get()
            ->groupBy('run_id');

        $runs->setCollection(
            collect($runs->items())->map(function ($run) use ($steps) {
                $runSteps = $steps->get($run->run_id, collect());
                $first = $runSteps->first();

                return [
                    'run_id' => $run->run_id,
                    'automation_id' => $first?->automation_id,
                    'automation' => $first?->automation,
                    'deal' => $first?->deal,
                    'lead' => $first?->lead,
                    'status' => $this->worstStepStatus($runSteps),
                    'steps_count' => $runSteps->count(),
                    'started_at' => $runSteps->min('executed_at'),
                    'executed_at' => $runSteps->max('executed_at') ?? $run->executed_at,
                    'steps' => $runSteps->values(),
                ];
            })->values()
        );

        return Reply::dataOnly(['status' => 'success', 'data' => $runs]);
    }

    /**
     * The shared filter set for the log/stat endpoints. Applied to steps —
     * a run matches when any of its steps does.
     *
     * @return \Illuminate\Database\Eloquent\Builder
     */
    protected function logFilters(Request $request)
    {
        return DealAutomationLog::query()
            ->when($request->filled('automation_id'), fn ($q) => $q->where('automation_id', $request->automation_id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('channel'), fn ($q) => $q->where('channel', $request->channel))
            ->when($request->filled('date_from'), fn ($q) => $q->whereDate('executed_at', '>=', $request->date_from))
            ->when($request->filled('date_to'), fn ($q) => $q->whereDate('executed_at', '<=', $request->date_to));
    }

    /**
     * Collapse step rows into one row per execution. Everything that counts
     * "runs" goes through this, so a multi-action automation stops counting
     * once per action.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $base
     * @return \Illuminate\Database\Eloquent\Builder
     */
    protected function runsQuery($base)
    {
        // CASE rather than MySQL's `SUM(status = ...)` so the same query runs
        // under the sqlite connection the test suite uses. deal_id/lead_id are
        // constant within a run, so MIN() just picks that shared value.
        return (clone $base)
            ->selectRaw('run_id')
            ->selectRaw('MIN(deal_id) as deal_id, MIN(lead_id) as lead_id')
            ->selectRaw('COUNT(*) as steps')
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed_steps', [DealAutomationLog::STATUS_FAILED])
            ->selectRaw('MAX(executed_at) as executed_at')
            ->groupBy('run_id');
    }

    /**
     * A run is only as good as its worst step: one failed action makes the
     * whole run failed, and an all-skipped run is skipped rather than a
     * success it never was.
     *
     * @param  \Illuminate\Support\Collection<int, DealAutomationLog>  $steps
     */
    protected function worstStepStatus($steps): string
    {
        if ($steps->contains('status', DealAutomationLog::STATUS_FAILED)) {
            return DealAutomationLog::STATUS_FAILED;
        }

        if ($steps->isNotEmpty() && ! $steps->contains('status', DealAutomationLog::STATUS_SUCCESS)) {
            return DealAutomationLog::STATUS_SKIPPED;
        }

        return DealAutomationLog::STATUS_SUCCESS;
    }

    /**
     * Aggregate run stats — company-wide, or scoped to one automation via
     * ?automation_id=. Used by Overview.tsx (no id) and AutomationDetail.tsx
     * (with id).
     */
    public function stats(Request $request)
    {
        abort_403(! AutomationV2Feature::enabled());

        $base = DealAutomationLog::query()
            ->when($request->filled('automation_id'), fn ($q) => $q->where('automation_id', $request->automation_id));

        // Every count here is over executions, not the individual action rows
        // that make them up — a three-action automation is one run, not three.
        $totalRuns = $this->countRuns($base);
        $successCount = $this->countRuns($base, fn ($q) => $q->where('failed_steps', 0));
        $lastRun = (clone $base)->orderByDesc('executed_at')->value('executed_at');

        $daily = DB::query()
            ->fromSub($this->runsQuery((clone $base)->where('executed_at', '>=', now()->subDays(6)->startOfDay()))->getQuery(), 'runs')
            ->selectRaw('DATE(executed_at) as day, COUNT(*) as total')
            ->groupBy('day')
            ->pluck('total', 'day');

        $chart = collect(range(6, 0))->map(function ($daysAgo) use ($daily) {
            $date = now()->subDays($daysAgo)->format('Y-m-d');

            return ['day' => $date, 'value' => (int) ($daily[$date] ?? 0)];
        })->values();

        // Costs two extra grouped queries, so it's only built when the caller
        // asks for it — today that's the Fired-for panel, which is behind a
        // front-end toggle (SHOW_FIRED_FOR) and currently off.
        $firedFor = $request->boolean('fired_for')
            ? $this->firedForBreakdown($base, min(max($request->integer('fired_for_limit', 25), 1), 100))
            : ['rows' => [], 'total' => 0];

        return Reply::dataOnly(['status' => 'success', 'data' => [
            'total_runs' => $totalRuns,
            'success_rate' => $totalRuns > 0 ? round($successCount / $totalRuns * 100, 1) : null,
            'last_run_at' => $lastRun,
            'runs_last_7_days' => $chart,
            'fired_for' => $firedFor['rows'],
            'fired_for_total' => $firedFor['total'],
        ]]);
    }

    /**
     * Count executions matching the filters, optionally narrowed by a
     * condition on the grouped run (e.g. `failed_steps = 0`).
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $base
     */
    protected function countRuns($base, ?callable $constrain = null): int
    {
        $query = DB::query()->fromSub($this->runsQuery($base)->getQuery(), 'runs');

        if ($constrain) {
            $constrain($query);
        }

        return $query->count();
    }

    /**
     * Who the automation actually fired for — one entry per deal/lead it ran
     * against, with that record's own run tally, rather than a single opaque
     * "N runs" number. Ordered by run count so the records an automation keeps
     * re-firing on (usually the interesting ones) come first.
     *
     * Names are hydrated in two follow-up queries instead of a join so the
     * grouped aggregate stays a single simple statement — the log table is the
     * only thing that grows here.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $base
     * @return array{rows: array<int, array<string, mixed>>, total: int}
     */
    protected function firedForBreakdown($base, int $limit): array
    {
        // Runs per record, rolled up from the per-run subquery — so a record an
        // automation fired for twice reads as 2, not as its total action count.
        $grouped = DB::query()
            ->fromSub($this->runsQuery($base)->getQuery(), 'runs')
            ->selectRaw('deal_id, lead_id, COUNT(*) as runs')
            ->selectRaw('SUM(CASE WHEN failed_steps > 0 THEN 1 ELSE 0 END) as failed_runs')
            ->selectRaw('SUM(CASE WHEN failed_steps = 0 THEN 1 ELSE 0 END) as success_runs')
            ->selectRaw('SUM(steps) as total_steps')
            ->selectRaw('MAX(executed_at) as last_run_at')
            ->groupBy('deal_id', 'lead_id')
            ->orderByDesc('runs')
            ->limit($limit)
            ->get();

        // Distinct subjects overall, so the UI can say "showing 25 of 300".
        // Counted over a grouped subquery rather than MySQL's multi-column
        // COUNT(DISTINCT a, b), which sqlite (the test connection) rejects.
        $total = DB::query()->fromSub(
            (clone $base)->select('deal_id', 'lead_id')->groupBy('deal_id', 'lead_id')->getQuery(),
            'subjects'
        )->count();

        $deals = Deal::with('contact:id,client_name,client_email')
            ->whereIn('id', $grouped->pluck('deal_id')->filter()->all())
            ->get(['id', 'name', 'lead_id'])
            ->keyBy('id');

        $leads = Lead::whereIn('id', $grouped->pluck('lead_id')->filter()->all())
            ->get(['id', 'client_name', 'client_email'])
            ->keyBy('id');

        $rows = $grouped->map(function ($row) use ($deals, $leads) {
            $deal = $row->deal_id ? $deals->get($row->deal_id) : null;
            $lead = $row->lead_id ? $leads->get($row->lead_id) : ($deal?->contact);

            return [
                'subject_type' => $deal ? 'deal' : 'lead',
                'deal_id' => $row->deal_id,
                'lead_id' => $row->lead_id ?: $deal?->lead_id,
                // The record the automation ran against…
                'record_name' => $deal?->name ?? $lead?->client_name,
                // …and the person behind it (a deal's linked contact).
                'person_name' => $lead?->client_name,
                'person_email' => $lead?->client_email,
                'runs' => (int) $row->runs,
                'success_runs' => (int) $row->success_runs,
                'failed_runs' => (int) $row->failed_runs,
                // Actions performed across those runs — the number the old
                // "runs" figure was actually showing.
                'total_steps' => (int) $row->total_steps,
                'last_run_at' => $row->last_run_at,
            ];
        })->values()->all();

        return ['rows' => $rows, 'total' => (int) $total];
    }

    /**
     * Data shared by create()/edit(): pipelines/stages for deal-subject actions,
     * the merge-field catalog for the condition builder, and available templates.
     */
    protected function shareFormData(): void
    {
        $this->pipelines = LeadPipeline::all();
        $this->stages = PipelineStage::all();
        $this->customFields = AutomationFieldCatalog::dealCustomFields();
        $this->leadCustomFields = AutomationFieldCatalog::leadCustomFields();
        $this->hibarrFields = AutomationFieldCatalog::HIBARR_FIELDS;
        $this->leadMarketingFields = AutomationFieldCatalog::LEAD_MARKETING_FIELDS;
        $this->relatedFields = AutomationFieldCatalog::RELATED_FIELDS;
        $this->leadFields = AutomationFieldCatalog::LEAD_FIELDS;
        $this->leadSettableFields = AutomationFieldCatalog::LEAD_SETTABLE_FIELDS;
        $this->emailTemplates = EmailTemplate::orderBy('name')->get();
        $this->assignmentTypes = AutomationFieldCatalog::ASSIGNMENT_TYPES;
        $this->recipientTypes = AutomationFieldCatalog::RECIPIENT_TYPES;
        $this->dueDateDeltaUnits = AutomationFieldCatalog::DUE_DATE_DELTA_UNITS;
        $this->dateFields = AutomationFieldCatalog::DATE_FIELDS;
        $this->dateRecurrences = AutomationFieldCatalog::DATE_RECURRENCES;
        $this->waitDurationUnits = AutomationFieldCatalog::WAIT_DURATION_UNITS;
        $this->users = User::allEmployees(null, false);
        $this->metaEventNames = AutomationFieldCatalog::knownMetaEventNames();
    }

    /**
     * The date_field column is only meaningful for trigger = 'date_based' —
     * cleared for every other trigger so stale config never lingers.
     */
    protected function resolvedTriggerDateField(Request $request): ?string
    {
        return $request->trigger === DealAutomation::TRIGGER_DATE_BASED
            ? ($request->trigger_date_field ?: null)
            : null;
    }

    protected function resolvedTriggerDateRecurrence(Request $request): ?string
    {
        return $request->trigger === DealAutomation::TRIGGER_DATE_BASED
            ? ($request->trigger_date_recurrence ?: null)
            : null;
    }

    /**
     * Wait config: value drives everything — a missing/zero value means "no
     * wait" and the unit is cleared with it. Unit defaults to days when a
     * value is set without one.
     */
    protected function resolvedWaitDurationValue(Request $request): ?int
    {
        return $request->filled('wait_duration_value') ? (int) $request->wait_duration_value : null;
    }

    protected function resolvedWaitDurationUnit(Request $request): ?string
    {
        if (! $request->filled('wait_duration_value')) {
            return null;
        }

        return in_array($request->wait_duration_unit, array_keys(AutomationFieldCatalog::WAIT_DURATION_UNITS))
            ? $request->wait_duration_unit
            : 'days';
    }

    /**
     * @return array<string, mixed>
     */
    protected function validationRules(string $subjectType): array
    {
        $allowedActionTypes = $subjectType === DealAutomation::SUBJECT_LEAD
            ? AutomationFieldCatalog::LEAD_ACTION_TYPES
            : AutomationFieldCatalog::DEAL_ACTION_TYPES;

        return [
            'name' => 'required|string|max:255',
            'subject_type' => ['required', Rule::in([DealAutomation::SUBJECT_DEAL, DealAutomation::SUBJECT_LEAD])],
            'pipeline_id' => 'nullable|exists:lead_pipelines,id',
            'trigger' => ['nullable', Rule::in([
                'deal_created', 'deal_updated', 'followup_created', 'custom_field_updated',
                'lead_created', 'lead_updated',
                DealAutomation::TRIGGER_LEAD_FOLLOWUP_CREATED,
                DealAutomation::TRIGGER_DATE_BASED,
            ])],
            'trigger_date_field' => ['required_if:trigger,'.DealAutomation::TRIGGER_DATE_BASED, 'nullable', 'string'],
            'trigger_date_recurrence' => ['required_if:trigger,'.DealAutomation::TRIGGER_DATE_BASED, 'nullable', Rule::in(array_keys(AutomationFieldCatalog::DATE_RECURRENCES))],
            'wait_duration_value' => 'nullable|integer|min:1|max:3650',
            'wait_duration_unit' => ['nullable', Rule::in(array_keys(AutomationFieldCatalog::WAIT_DURATION_UNITS))],
            'priority' => 'required|integer',
            'conditions' => 'array',
            'conditions.*.field' => 'required|string|max:255',
            'conditions.*.operator' => ['required', Rule::in(['=', '>', '<', 'contains', 'exists', 'changed'])],
            'conditions.*.value' => 'nullable|string|max:65535',
            'actions' => 'required|array|min:1',
            'actions.*.action_type' => ['required', Rule::in($allowedActionTypes)],
            'actions.*.target_stage_id' => 'required_if:actions.*.action_type,stage_transition|nullable|exists:pipeline_stages,id',
            'actions.*.field_name' => 'required_if:actions.*.action_type,set_field_value|nullable|string',
            'actions.*.field_value' => 'required_if:actions.*.action_type,set_field_value|nullable|string',
            'actions.*.email_template_id' => 'required_if:actions.*.action_type,send_email|nullable|exists:email_templates,id',
            'actions.*.recipient_types' => 'required_if:actions.*.action_type,send_email|nullable|array|min:1',
            'actions.*.recipient_types.*' => Rule::in(array_keys(AutomationFieldCatalog::RECIPIENT_TYPES)),
            'actions.*.recipient_user_ids' => 'nullable|array',
            'actions.*.recipient_user_ids.*' => 'exists:users,id',
            'actions.*.recipient_emails' => 'nullable|string|max:2000',
            'actions.*.title' => 'required_if:actions.*.action_type,create_task|nullable|string|max:255',
            'actions.*.content' => 'required_if:actions.*.action_type,create_note|nullable|string',
            'actions.*.assignee_type' => ['required_if:actions.*.action_type,create_task', 'nullable', Rule::in(array_keys(AutomationFieldCatalog::ASSIGNMENT_TYPES))],
            'actions.*.assignee_user_id' => 'required_if:actions.*.assignee_type,specific_user|nullable|exists:users,id',
            'actions.*.assigner_type' => ['nullable', Rule::in(array_keys(AutomationFieldCatalog::ASSIGNMENT_TYPES))],
            'actions.*.assigner_user_id' => 'required_if:actions.*.assigner_type,specific_user|nullable|exists:users,id',
            'actions.*.due_date_delta_value' => 'nullable|integer|min:1|max:3650',
            'actions.*.due_date_delta_unit' => ['nullable', Rule::in(array_keys(AutomationFieldCatalog::DUE_DATE_DELTA_UNITS))],
            // Browsers' native <input type="time"> can hand back either
            // "H:i" or "H:i:s" (seconds present or not, depending on
            // browser/OS) — accept both rather than fighting it; downstream
            // consumption (DealAutomationService::performCreateTask() via
            // Carbon::parse()) already handles either format fine.
            'actions.*.due_time' => 'nullable|date_format:H:i,H:i:s',
            'actions.*.meta_event_name' => 'required_if:actions.*.action_type,meta_conversion|nullable|string|max:255',
            'actions.*.meta_event_value' => 'nullable|numeric|min:0',
            'actions.*.wait_duration_value' => 'nullable|integer|min:1|max:3650',
            'actions.*.wait_duration_unit' => ['nullable', Rule::in(array_keys(AutomationFieldCatalog::WAIT_DURATION_UNITS))],
        ];
    }

    protected function syncConditions(DealAutomation $automation, Request $request): void
    {
        if (! $request->has('conditions')) {
            return;
        }

        foreach ($request->conditions as $condition) {
            if (! empty($condition['field'])) {
                $automation->conditions()->create([
                    'field' => $condition['field'],
                    'operator' => $condition['operator'],
                    'value' => $condition['value'] ?? '',
                ]);
            }
        }
    }

    protected function syncActions(DealAutomation $automation, Request $request, string $subjectType): void
    {
        $allowedActionTypes = $subjectType === DealAutomation::SUBJECT_LEAD
            ? AutomationFieldCatalog::LEAD_ACTION_TYPES
            : AutomationFieldCatalog::DEAL_ACTION_TYPES;

        foreach ($request->actions as $action) {
            $actionType = $action['action_type'] ?? $allowedActionTypes[0];

            if (! in_array($actionType, $allowedActionTypes)) {
                continue;
            }

            $isTaskOrNote = in_array($actionType, ['create_task', 'create_note']);
            $isSendEmail = $actionType === 'send_email';
            $isCreateTask = $actionType === 'create_task';
            $isMetaConversion = $actionType === 'meta_conversion';
            $isWait = $actionType === 'wait';
            $recipientTypes = $isSendEmail ? array_values((array) ($action['recipient_types'] ?? ['client'])) : null;

            $automation->actions()->create([
                'action_type' => $actionType,
                'target_stage_id' => $actionType === 'stage_transition' ? ($action['target_stage_id'] ?? null) : null,
                'target_pipeline_id' => $actionType === 'stage_transition' ? ($action['target_pipeline_id'] ?? null) : null,
                'forward_only' => $actionType === 'stage_transition' ? (isset($action['forward_only']) ? 1 : 0) : 0,
                'field_name' => $actionType === 'set_field_value' ? ($action['field_name'] ?? null) : null,
                'field_value' => $actionType === 'set_field_value' ? ($action['field_value'] ?? null) : null,
                'email_template_id' => $isSendEmail ? ($action['email_template_id'] ?? null) : null,
                'recipient_types' => $recipientTypes,
                'recipient_user_ids' => $isSendEmail && in_array('specific_user', $recipientTypes ?? [])
                    ? array_values(array_map('intval', (array) ($action['recipient_user_ids'] ?? [])))
                    : null,
                'recipient_emails' => $isSendEmail && in_array('custom_email', $recipientTypes ?? [])
                    ? ($action['recipient_emails'] ?? null)
                    : null,
                'title' => $isTaskOrNote ? ($action['title'] ?? null) : null,
                'content' => $isTaskOrNote ? ($action['content'] ?? null) : null,
                'assignee_type' => $actionType === 'create_task' ? ($action['assignee_type'] ?? null) : null,
                'assignee_user_id' => $actionType === 'create_task' && ($action['assignee_type'] ?? null) === 'specific_user' ? ($action['assignee_user_id'] ?? null) : null,
                'assigner_type' => $isTaskOrNote ? ($action['assigner_type'] ?? null) : null,
                'assigner_user_id' => $isTaskOrNote && ($action['assigner_type'] ?? null) === 'specific_user' ? ($action['assigner_user_id'] ?? null) : null,
                'due_date_delta_value' => $isCreateTask ? ($action['due_date_delta_value'] ?? null) : null,
                'due_date_delta_unit' => $isCreateTask ? ($action['due_date_delta_unit'] ?? 'days') : null,
                'due_time' => $isCreateTask ? ($action['due_time'] ?? null) : null,
                'meta_event_name' => $isMetaConversion ? ($action['meta_event_name'] ?? null) : null,
                'meta_event_value' => $isMetaConversion ? ($action['meta_event_value'] ?? null) : null,
                'wait_duration_value' => $isWait ? ($action['wait_duration_value'] ?? null) : null,
                'wait_duration_unit' => $isWait && ! empty($action['wait_duration_value'])
                    ? (in_array($action['wait_duration_unit'] ?? null, array_keys(AutomationFieldCatalog::WAIT_DURATION_UNITS))
                        ? $action['wait_duration_unit']
                        : 'days')
                    : null,
            ]);
        }
    }

    /**
     * When automation v2 is off, reject create/update payloads that use v2-only
     * subject types, triggers, waits, or action types — legacy Blade UI stays
     * on deal stage/set-field/lock automations only.
     */
    protected function assertLegacyAutomationRequest(Request $request): void
    {
        if (AutomationV2Feature::enabled()) {
            return;
        }

        $subjectType = $request->subject_type === DealAutomation::SUBJECT_LEAD
            ? DealAutomation::SUBJECT_LEAD
            : DealAutomation::SUBJECT_DEAL;

        abort_403($subjectType !== DealAutomation::SUBJECT_DEAL);

        abort_403(in_array($request->trigger, [
            'lead_created',
            'lead_updated',
            DealAutomation::TRIGGER_LEAD_FOLLOWUP_CREATED,
            DealAutomation::TRIGGER_DATE_BASED,
        ], true));

        abort_403($request->filled('wait_duration_value'));

        foreach ($request->input('actions', []) as $action) {
            $type = $action['action_type'] ?? 'stage_transition';
            abort_403(! AutomationV2Feature::supportsActionType($type));
        }
    }
}
