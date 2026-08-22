<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\DealAutomation;
use App\Models\DealAutomationAction;
use App\Models\EmailTemplate;
use App\Models\LeadPipeline;
use App\Models\MetaConversionTrigger;
use App\Models\PipelineStage;
use App\Models\User;
use App\Services\AutomationFieldCatalog;
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

    public function create()
    {
        $this->automation = new DealAutomation(['subject_type' => DealAutomation::SUBJECT_DEAL]);
        $this->shareFormData();

        return view('company-settings.deal-automation.edit', $this->data);
    }

    public function store(Request $request)
    {
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
                'active' => $request->has('active') ? 1 : 0,
                'priority' => $request->priority,
            ]);

            $this->syncConditions($automation, $request);
            $this->syncActions($automation, $request, $subjectType);

            DB::commit();

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
                'active' => $request->has('active') ? 1 : 0,
                'priority' => $request->priority,
            ]);

            $automation->conditions()->delete();
            $this->syncConditions($automation, $request);

            $automation->actions()->delete();
            $this->syncActions($automation, $request, $subjectType);

            DB::commit();

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
        $this->relatedFields = AutomationFieldCatalog::RELATED_FIELDS;
        $this->leadFields = AutomationFieldCatalog::LEAD_FIELDS;
        $this->leadSettableFields = AutomationFieldCatalog::LEAD_SETTABLE_FIELDS;
        $this->emailTemplates = EmailTemplate::orderBy('name')->get();
        $this->assignmentTypes = AutomationFieldCatalog::ASSIGNMENT_TYPES;
        $this->recipientTypes = AutomationFieldCatalog::RECIPIENT_TYPES;
        $this->dueDateDeltaUnits = AutomationFieldCatalog::DUE_DATE_DELTA_UNITS;
        $this->dateFields = AutomationFieldCatalog::DATE_FIELDS;
        $this->dateRecurrences = AutomationFieldCatalog::DATE_RECURRENCES;
        $this->users = User::allEmployees(null, false);
        $this->metaEventNames = $this->knownMetaEventNames();
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
     * Event names already in use somewhere — either a pipeline-stage Meta
     * Conversion trigger, or another automation's meta_conversion action —
     * so the action editor can offer them as a picker instead of the user
     * having to remember/retype an existing event name exactly.
     *
     * @return array<int, string>
     */
    protected function knownMetaEventNames(): array
    {
        return MetaConversionTrigger::query()
            ->pluck('event_name')
            ->merge(DealAutomationAction::query()->whereNotNull('meta_event_name')->pluck('meta_event_name'))
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
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
            'priority' => 'required|integer',
            'conditions' => 'array',
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
            'actions.*.due_time' => 'nullable|date_format:H:i',
            'actions.*.meta_event_name' => 'required_if:actions.*.action_type,meta_conversion|nullable|string|max:255',
            'actions.*.meta_event_value' => 'nullable|numeric|min:0',
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
            ]);
        }
    }
}
