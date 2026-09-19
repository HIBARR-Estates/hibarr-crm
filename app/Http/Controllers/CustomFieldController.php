<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\CustomField\StoreCustomField;
use App\Http\Requests\CustomField\UpdateCustomField;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Services\CustomFieldRuleService;
use App\Services\CustomFieldVisibilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class CustomFieldController extends AccountBaseController
{
    protected $ruleService;

    public function __construct(CustomFieldRuleService $ruleService)
    {
        parent::__construct();
        $this->ruleService = $ruleService;
        $this->pageTitle = 'app.menu.customFields';
        $this->activeSettingMenu = 'custom_fields';
        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_custom_field_setting') !== 'all');

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        $query = CustomField::join('custom_field_groups', 'custom_field_groups.id', '=', 'custom_fields.custom_field_group_id')
            ->select('custom_fields.id', 'custom_field_groups.name as module', 'custom_fields.label', 'custom_fields.type', 'custom_fields.values', 'custom_fields.required', 'custom_fields.export', 'custom_fields.visible', 'custom_fields.display_order');

        // Only load rule sets when needed (for admin view, load all; for frontend, only enabled ones)
        // For the index page (admin), we need all rule sets to show/edit them
        try {
            $this->customFields = $query->with([
                'showRuleSet' => function ($query) {
                    $query->with(['groups' => function ($q) {
                        $q->orderBy('id')->with('criteria.referenceField');
                    }]);
                },
            ])->orderBy('custom_fields.display_order')->get();
        } catch (\Exception $e) {
            // Log the error for debugging
            Log::warning('Failed to load custom field visibility rules', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // If tables don't exist yet, load without relationships
            $this->customFields = $query->orderBy('custom_fields.display_order')->get();
        }

        $this->groupedCustomFields = $this->customFields->groupBy('module');

        return view('custom-fields.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        $this->customFieldGroups = CustomFieldGroup::all();
        $this->types = ['text', 'number', 'password', 'textarea', 'select', 'radio', 'date', 'checkbox', 'multiselect', 'country', 'multiSelectCountry', 'currency', 'range', 'currency_range', 'phone', 'file', 'repeatable'];
        // multiSelectCountry, multiselect, and range are excluded from nested repeatable schemas:
        // repeatable's per-row schema types are single-value inputs, with no matching
        // nested UI for a multi-value (multiSelectCountry, multiselect) or dual-value (range) field.
        $this->schemaTypes = array_values(array_filter($this->types, fn ($t) => ! in_array($t, ['repeatable', 'multiSelectCountry', 'multiselect', 'range', 'currency_range'], true)));

        return view('custom-fields.create-custom-field-modal', $this->data);
    }

    /**
     * @return array
     */
    public function store(StoreCustomField $request)
    {

        $name = CustomField::generateUniqueSlug($request->get('label'), $request->module);
        $fieldData = [
            'name' => $name,
            'custom_field_group_id' => $request->module,
            'custom_field_category_id' => $request->get('category'),
            'label' => $request->get('label'),
            'type' => $request->get('type'),
            'required' => $request->get('required'),
            'values' => $request->get('value'),
            'export' => $request->get('export'),
            'visible' => $request->get('visible'),
            'important' => $request->get('important', 0),
            'display_order' => $request->get('display_order', 0),
        ];
        if ($request->get('type') === 'repeatable' && $request->has('linked_field_id')) {
            $fieldData['linked_field_id'] = $request->get('linked_field_id');
            $fieldData['values'] = is_array($request->get('value')) ? json_encode($request->get('value')) : $request->get('value');
        }
        if ($request->has('display_config')) {
            $fieldData['display_config'] = $request->get('display_config');
        }
        if ($request->has('show_in_lead')) {
            $fieldData['show_in_lead'] = $request->boolean('show_in_lead');
        }
        if ($request->has('show_in_deal')) {
            $fieldData['show_in_deal'] = $request->boolean('show_in_deal');
        }
        $group = ['fields' => [$fieldData]];

        $createdFields = $this->addCustomField($group);

        if (! empty($createdFields) && $request->has('conditions')) {
            $this->ruleService->saveRules(
                $createdFields[0],
                $request->get('conditions', []),
                $request->get('logic_string')
            );
        }

        $field = ! empty($createdFields) ? $createdFields[0]->load('fieldGroup', 'customFieldCategory', 'showRuleSet.groups.criteria.referenceField') : null;

        return Reply::successWithData('messages.recordSaved', ['field' => $field?->toAdminArray()]);
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        $this->field = CustomField::with([
            'showRuleSet' => function ($query) {
                $query->with(['groups' => function ($q) {
                    $q->orderBy('id')->with('criteria.referenceField');
                }]);
            },
        ])->findOrFail($id);
        // Use json_decode with true to return array instead of stdClass
        $decodedValues = json_decode($this->field->values, true);
        $this->field->values = is_array($decodedValues) ? $decodedValues : [];
        $this->customFieldGroups = CustomFieldGroup::all();
        $this->types = ['text', 'number', 'password', 'textarea', 'select', 'radio', 'date', 'checkbox', 'multiselect', 'country', 'multiSelectCountry', 'currency', 'range', 'currency_range', 'phone', 'file', 'repeatable'];
        $this->schemaTypes = array_values(array_filter($this->types, fn ($t) => ! in_array($t, ['repeatable', 'multiSelectCountry', 'multiselect', 'range', 'currency_range'], true)));

        // Get all fields in the same group for visibility rules (and linked-field dropdown for repeatable)
        // Ensure otherFields is always set, even if empty, to prevent undefined variable errors
        $this->otherFields = CustomField::where('custom_field_group_id', $this->field->custom_field_group_id)
            ->where('id', '!=', $id)
            ->get();

        // Explicitly ensure otherFields is in the data array (magic __set should handle this, but being explicit)
        $this->data['otherFields'] = $this->otherFields;

        // Categories will be loaded dynamically based on the selected module

        return view('custom-fields.edit-custom-field-modal', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateCustomField $request, $id)
    {
        $field = CustomField::findOrFail($id);

        $name = CustomField::generateUniqueSlug($request->label, $field->custom_field_group_id);
        $field->label = $request->label;
        $field->name = $name;
        $field->type = $request->type;
        $field->custom_field_category_id = $request->category;
        if (in_array($request->type, ['select', 'radio', 'checkbox', 'multiselect', 'repeatable'])) {
            $field->values = is_array($request->value) ? json_encode($request->value) : ($request->value ?? $field->values);
        }
        $field->required = $request->required;
        $field->export = $request->export;
        $field->visible = $request->visible;
        $field->important = $request->important ?? 0;
        $field->display_order = $request->display_order ?? 0;
        if ($request->type === 'repeatable') {
            $field->linked_field_id = $request->linked_field_id ?: null;
            $field->display_config = $request->has('display_config') ? $request->display_config : null;
        } else {
            $field->linked_field_id = null;
            $field->display_config = null;
        }
        if ($request->has('show_in_lead')) {
            $field->show_in_lead = $request->boolean('show_in_lead');
        }
        if ($request->has('show_in_deal')) {
            $field->show_in_deal = $request->boolean('show_in_deal');
        }
        $field->save();

        if ($request->has('conditions')) {
            $this->ruleService->saveRules(
                $field,
                $request->get('conditions', []),
                $request->get('logic_string')
            );
        }

        $field->load('fieldGroup', 'customFieldCategory', 'showRuleSet.groups.criteria.referenceField');

        return Reply::successWithData('messages.updateSuccess', ['field' => $field->toAdminArray()]);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        // Find the custom field
        $field = CustomField::findOrFail($id);
        $module = $field->fieldGroup->name;
        // Delete the custom field
        $field->delete();

        // Fetch the updated count for the module
        $updatedCount = CustomField::whereHas('fieldGroup', function ($query) use ($module) {
            $query->where('name', $module);
        })->count();

        return Reply::successWithData(__('messages.deleteSuccess'), ['updatedCount' => $updatedCount]);
    }

    /**
     * Sort fields order within a module
     *
     * @return \Illuminate\Http\Response
     */
    public function sortFields(Request $request)
    {
        $sortedValues = $request->sortedValues;

        if (! is_array($sortedValues)) {
            return Reply::error('Invalid sorted values');
        }

        foreach ($sortedValues as $key => $value) {
            CustomField::where('id', $value)->update(['display_order' => $key + 1]);
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    private function addCustomField($group)
    {
        $createdFields = [];
        // Add Custom Fields for this group
        foreach ($group['fields'] as $field) {
            $insertData = [
                'custom_field_group_id' => $field['custom_field_group_id'],
                'custom_field_category_id' => $field['custom_field_category_id'] ?? null,
                'label' => $field['label'],
                'name' => $field['name'],
                'type' => $field['type'],
                'export' => $field['export'],
                'visible' => $field['visible'],
                'important' => $field['important'] ?? 0,
                'display_order' => $field['display_order'] ?? 0,
            ];

            if (isset($field['required']) && (in_array($field['required'], ['yes', 'on', 1]))) {
                $insertData['required'] = 'yes';

            } else {
                $insertData['required'] = 'no';
            }

            // Single value should be stored as text (multi value JSON encoded)
            if (isset($field['values'])) {
                if (is_array($field['values'])) {
                    $insertData['values'] = json_encode($field['values']);
                } else {
                    $insertData['values'] = $field['values'];
                }
            }

            if (! empty($field['linked_field_id'])) {
                $insertData['linked_field_id'] = $field['linked_field_id'];
            }

            if (array_key_exists('display_config', $field)) {
                $insertData['display_config'] = $field['display_config'];
            }

            if (array_key_exists('show_in_lead', $field)) {
                $insertData['show_in_lead'] = $field['show_in_lead'];
            }

            if (array_key_exists('show_in_deal', $field)) {
                $insertData['show_in_deal'] = $field['show_in_deal'];
            }

            $createdFields[] = CustomField::create($insertData);

        }

        return $createdFields;
    }

    /**
     * Get custom fields by group (for repeatable linked-field dropdown on create).
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function fieldsByGroup(Request $request)
    {
        $groupId = $request->input('group_id');
        if (! $groupId) {
            return response()->json(['fields' => []]);
        }
        $fields = CustomField::where('custom_field_group_id', $groupId)
            ->orderBy('display_order')
            ->get(['id', 'label', 'name', 'type']);

        return response()->json(['fields' => $fields]);
    }

    /**
     * Pipelines (with stages) this company's rule builder can target for a
     * `pipeline` / `pipeline_stage` criterion.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function pipelineOptions()
    {
        $pipelines = \App\Models\LeadPipeline::where('company_id', company()->id)
            ->with(['stages' => function ($query) {
                $query->orderBy('priority')->select('id', 'lead_pipeline_id', 'name', 'priority');
            }])
            ->orderBy('id')
            ->get(['id', 'name']);

        return response()->json(['pipelines' => $pipelines]);
    }

    /**
     * Search-as-you-type options for a "record" (Deal/Lead/...) source
     * criterion — the field's own module (its custom_field_groups.model)
     * decides which table/display-column to search; a module with no known
     * mapping returns no options rather than guessing.
     *
     * `ids` returns those specific records *in addition to* the search page,
     * so a rule's already-selected records always come back with a real label
     * even when they fall outside the current search's first 20 hits —
     * otherwise RecordSelect renders them as bare ids.
     */
    public function recordOptions(Request $request, $id)
    {
        $field = CustomField::with('fieldGroup')->findOrFail($id);
        $model = $field->fieldGroup->model ?? null;
        $companyId = company()->id;
        $search = trim((string) $request->input('q', ''));
        $requestedIds = $this->criterionReferenceIds($request->input('ids'));

        $config = [
            \App\Models\Deal::class => ['table' => 'deals', 'column' => 'name', 'softDeletes' => false],
            \App\Models\Lead::class => ['table' => 'leads', 'column' => 'client_name', 'softDeletes' => true],
        ][$model] ?? null;

        if (! $config) {
            return response()->json(['data' => []]);
        }

        $baseQuery = fn () => DB::table($config['table'])
            ->where('company_id', $companyId)
            ->when($config['softDeletes'], fn ($q) => $q->whereNull('deleted_at'))
            ->select('id', $config['column'].' as name');

        $query = $baseQuery();

        if ($search !== '') {
            $query->where($config['column'], 'like', '%'.$search.'%');
        }

        $records = $query->orderBy($config['column'])->limit(20)->get();

        if ($requestedIds !== []) {
            $found = $records->pluck('id')->all();
            $missing = array_values(array_diff($requestedIds, $found));

            if ($missing !== []) {
                $records = $baseQuery()
                    ->whereIn('id', $missing)
                    ->orderBy($config['column'])
                    ->get()
                    ->concat($records)
                    ->values();
            }
        }

        return response()->json(['data' => $records]);
    }

    /**
     * Get rule set for a field
     *
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getRuleSet($id)
    {
        try {
            $field = CustomField::with([
                'showRuleSet' => function ($query) {
                    $query->with(['groups' => function ($q) {
                        $q->orderBy('id')->with('criteria.referenceField');
                    }]);
                },
            ])->findOrFail($id);

            $ruleSet = $field->showRuleSet;

            // For backward compatibility, also load single group if groups don't exist
            if ($ruleSet && (! $ruleSet->groups || $ruleSet->groups->isEmpty())) {
                $ruleSet->load('group.criteria.referenceField');
            }

            return response()->json($ruleSet);
        } catch (\Exception $e) {
            // If tables don't exist, return null
            return response()->json(null);
        }
    }

    /**
     * Save/Update rule set
     *
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function saveRuleSet(Request $request, $id)
    {
        $field = CustomField::findOrFail($id);

        // Normalize boolean values from request (handle string "1"/"0", "true"/"false", or actual booleans)
        $ruleSetData = $request->input('rule_set', []);

        // Helper function to convert various formats to boolean
        $toBoolean = function ($value) {
            if (is_bool($value)) {
                return $value;
            }
            if (is_string($value)) {
                $value = strtolower(trim($value));

                return in_array($value, ['1', 'true', 'yes', 'on'], true);
            }
            if (is_numeric($value)) {
                return (bool) $value;
            }

            return false;
        };

        if (isset($ruleSetData['default_visibility'])) {
            $ruleSetData['default_visibility'] = $toBoolean($ruleSetData['default_visibility']);
        }

        if (isset($ruleSetData['enabled'])) {
            $ruleSetData['enabled'] = $toBoolean($ruleSetData['enabled']);
        }

        // Normalize criteria negate values for single group (backward compatibility)
        if (isset($ruleSetData['group']['criteria'])) {
            foreach ($ruleSetData['group']['criteria'] as &$criterion) {
                if (isset($criterion['negate'])) {
                    $criterion['negate'] = $toBoolean($criterion['negate']);
                }
            }
        }

        // Normalize criteria negate values and group enabled for multiple groups
        if (isset($ruleSetData['groups'])) {
            foreach ($ruleSetData['groups'] as &$group) {
                // Normalize enabled field
                if (isset($group['enabled'])) {
                    $group['enabled'] = $toBoolean($group['enabled']);
                }

                if (isset($group['criteria'])) {
                    foreach ($group['criteria'] as &$criterion) {
                        if (isset($criterion['negate'])) {
                            $criterion['negate'] = $toBoolean($criterion['negate']);
                        }
                    }
                }
            }
        }

        // Validate request data
        $validator = Validator::make(['rule_set' => $ruleSetData], [
            'rule_set.default_visibility' => 'sometimes|boolean',
            'rule_set.enabled' => 'sometimes|boolean',
            'rule_set.groups_operator' => 'sometimes|in:AND,OR',
            // Multiple groups validation
            'rule_set.groups.*.group_operator' => 'required_with:rule_set.groups|in:AND,OR',
            'rule_set.groups.*.enabled' => 'sometimes|boolean',
            'rule_set.groups.*.visibility_action' => 'sometimes|in:show,hide',
            'rule_set.groups.*.criteria.*.reference_source' => 'sometimes|nullable|in:custom_field,pipeline,pipeline_stage,deal_package,record',
            // reference_field_id is only required when the source is a custom field —
            // enforced below in the `after()` callback, since that depends on a sibling field.
            'rule_set.groups.*.criteria.*.reference_field_id' => 'nullable|integer|exists:custom_fields,id',
            'rule_set.groups.*.criteria.*.operator' => 'required_with:rule_set.groups.*.criteria|in:equals,exists,boolean,>,<,>=,<=,in,not_in',
            'rule_set.groups.*.criteria.*.reference_value' => 'nullable',
            'rule_set.groups.*.criteria.*.negate' => 'sometimes|boolean',
            // Single group validation (backward compatibility)
            'rule_set.group.group_operator' => 'sometimes|in:AND,OR',
            'rule_set.group.criteria.*.reference_source' => 'sometimes|nullable|in:custom_field,pipeline,pipeline_stage,deal_package,record',
            'rule_set.group.criteria.*.reference_field_id' => 'nullable|integer|exists:custom_fields,id',
            'rule_set.group.criteria.*.operator' => 'required_with:rule_set.group.criteria|in:equals,exists,boolean,>,<,>=,<=,in,not_in',
            'rule_set.group.criteria.*.reference_value' => 'nullable',
            'rule_set.group.criteria.*.negate' => 'sometimes|boolean',
        ]);

        $validator->after(function ($validator) use ($ruleSetData, $field) {
            $companyId = company()->id;

            $checkCriterion = function (array $criterion, string $path) use ($validator, $companyId, $field) {
                $source = $criterion['reference_source'] ?? 'custom_field';
                $operator = $criterion['operator'] ?? null;

                if ($source === 'custom_field') {
                    if (empty($criterion['reference_field_id'])) {
                        $validator->errors()->add("{$path}.reference_field_id", 'The reference field is required for a custom field criterion.');
                    }

                    return;
                }

                if (in_array($operator, ['exists', 'boolean'], true)) {
                    return;
                }

                $ids = $this->criterionReferenceIds($criterion['reference_value'] ?? null);
                if ($ids === [] && ($criterion['reference_value'] ?? null) !== null && $criterion['reference_value'] !== '') {
                    // Non-id sources (e.g. deal_package) keep a free-form value.
                    if ($source === 'deal_package') {
                        return;
                    }
                }

                if ($ids === []) {
                    $validator->errors()->add("{$path}.reference_value", 'A value is required for this criterion.');

                    return;
                }

                if ($source === 'pipeline' || $source === 'pipeline_stage') {
                    if (! $this->pipelineIdsExist($source, $ids, (int) $companyId)) {
                        $validator->errors()->add("{$path}.reference_value", 'The selected value is invalid.');
                    }
                }

                if ($source === 'record') {
                    $recordModel = $field->fieldGroup->model ?? null;
                    if (! $recordModel || ! $this->recordIdsExist($recordModel, $ids, (int) $companyId)) {
                        $validator->errors()->add("{$path}.reference_value", 'The selected record is invalid.');
                    }
                }
            };

            foreach ($ruleSetData['groups'] ?? [] as $groupIndex => $group) {
                foreach ($group['criteria'] ?? [] as $criterionIndex => $criterion) {
                    $checkCriterion($criterion, "rule_set.groups.{$groupIndex}.criteria.{$criterionIndex}");
                }
            }

            foreach ($ruleSetData['group']['criteria'] ?? [] as $criterionIndex => $criterion) {
                $checkCriterion($criterion, "rule_set.group.criteria.{$criterionIndex}");
            }
        });

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Use normalized data

        // Create or update rule set
        $ruleSet = $field->showRuleSet()->updateOrCreate(
            ['field_id' => $id],
            [
                'default_visibility' => $ruleSetData['default_visibility'] ?? true,
                'enabled' => $ruleSetData['enabled'] ?? true,
                'groups_operator' => $ruleSetData['groups_operator'] ?? 'AND',
            ]
        );

        // Handle multiple groups (new approach)
        if (isset($ruleSetData['groups']) && is_array($ruleSetData['groups'])) {
            // Delete all existing groups and their criteria
            $ruleSet->groups()->each(function ($group) {
                $group->criteria()->delete();
            });
            $ruleSet->groups()->delete();

            // Create new groups
            foreach ($ruleSetData['groups'] as $groupData) {
                $group = $ruleSet->groups()->create([
                    'group_operator' => $groupData['group_operator'] ?? 'AND',
                    'enabled' => $groupData['enabled'] ?? true,
                    'visibility_action' => $groupData['visibility_action'] ?? 'show',
                ]);

                // Create criteria for this group
                if (isset($groupData['criteria']) && is_array($groupData['criteria'])) {
                    foreach ($groupData['criteria'] as $criterionData) {
                        $group->criteria()->create([
                            'reference_source' => $criterionData['reference_source'] ?? 'custom_field',
                            'reference_field_id' => $criterionData['reference_field_id'] ?? null,
                            'operator' => $criterionData['operator'],
                            'reference_value' => $this->persistCriterionValue($criterionData['reference_value'] ?? null),
                            'negate' => $criterionData['negate'] ?? false,
                        ]);
                    }
                }
            }
        }
        // Handle single group (backward compatibility)
        elseif (isset($ruleSetData['group'])) {
            $group = $ruleSet->group()->updateOrCreate(
                ['rule_set_id' => $ruleSet->id],
                ['group_operator' => $ruleSetData['group']['group_operator'] ?? 'AND']
            );

            // Delete existing criteria
            $group->criteria()->delete();

            // Create new criteria
            if (isset($ruleSetData['group']['criteria'])) {
                foreach ($ruleSetData['group']['criteria'] as $criterionData) {
                    $group->criteria()->create([
                        'reference_source' => $criterionData['reference_source'] ?? 'custom_field',
                        'reference_field_id' => $criterionData['reference_field_id'] ?? null,
                        'operator' => $criterionData['operator'],
                        'reference_value' => $this->persistCriterionValue($criterionData['reference_value'] ?? null),
                        'negate' => $criterionData['negate'] ?? false,
                    ]);
                }
            }
        }

        // Reload groups with proper ordering
        $ruleSet->load(['groups' => function ($q) {
            $q->orderBy('id')->with('criteria.referenceField');
        }]);

        // A rule-set save changes the field's show_rule_set only — reload the
        // full field the same way store()/update() do, so the response is one
        // authoritative snapshot the settings page can fully replace its
        // local copy of this field with, rather than patching just
        // show_rule_set and leaving everything else as of the field's last
        // separate save (store()/update()'s own response is a snapshot as of
        // *before* this rule change, so a caller that ran both — e.g. the
        // Lead FILE field's "show for pipeline(s)" picker — must trust this
        // one as the final state, not merge the two).
        $field->load('fieldGroup', 'customFieldCategory', 'showRuleSet.groups.criteria.referenceField');

        return response()->json(
            Reply::successWithData('Visibility rules saved successfully', [
                'success' => true,
                'rule_set' => $ruleSet,
                'field' => $field->toAdminArray(),
            ])
        );
    }

    /**
     * Evaluate visibility
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function evaluateVisibility(Request $request)
    {
        $fieldId = $request->input('field_id');
        $currentValues = $request->input('current_values', []);

        $service = new CustomFieldVisibilityService;
        $visible = $service->evaluate($fieldId, $currentValues);

        return response()->json(['visible' => $visible]);
    }

    /**
     * @param  mixed  $value
     */
    private function persistCriterionValue($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_array($value)) {
            return json_encode(array_values($value));
        }

        return is_scalar($value) ? (string) $value : json_encode($value);
    }

    /**
     * @param  mixed  $value
     * @return array<int, int>
     */
    private function criterionReferenceIds($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_array($value)) {
            return array_values(array_filter(array_map('intval', $value), fn ($id) => $id > 0));
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            if (str_starts_with($trimmed, '[')) {
                $decoded = json_decode($trimmed, true);
                if (is_array($decoded)) {
                    return array_values(array_filter(array_map('intval', $decoded), fn ($id) => $id > 0));
                }
            }

            return is_numeric($trimmed) ? [(int) $trimmed] : [];
        }

        return is_numeric($value) ? [(int) $value] : [];
    }

    /**
     * @param  array<int, int>  $ids
     */
    private function pipelineIdsExist(string $source, array $ids, int $companyId): bool
    {
        $unique = array_values(array_unique($ids));
        if ($unique === []) {
            return false;
        }

        if ($source === 'pipeline') {
            $found = DB::table('lead_pipelines')->where('company_id', $companyId)->whereIn('id', $unique)->count();

            return $found === count($unique);
        }

        $found = DB::table('pipeline_stages as s')
            ->join('lead_pipelines as p', 'p.id', '=', 's.lead_pipeline_id')
            ->where('p.company_id', $companyId)
            ->whereIn('s.id', $unique)
            ->count();

        return $found === count($unique);
    }

    /**
     * Whether every id refers to a real record of $modelClass, scoped to this
     * company — the "record" source's table is whichever module the field
     * itself belongs to (its own custom_field_groups.model), not a fixed one.
     *
     * @param  array<int, int>  $ids
     */
    private function recordIdsExist(string $modelClass, array $ids, int $companyId): bool
    {
        $unique = array_values(array_unique($ids));
        if ($unique === [] || ! is_a($modelClass, \Illuminate\Database\Eloquent\Model::class, true)) {
            return false;
        }

        $found = $modelClass::query()->where('company_id', $companyId)->whereIn('id', $unique)->count();

        return $found === count($unique);
    }
}
