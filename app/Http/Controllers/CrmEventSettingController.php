<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\CrmEventCategory;
use App\Models\CrmEventType;
use App\Models\CrmBusinessRule;
use App\Models\CrmEventRetentionPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CrmEventSettingController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.crmEventSettings';
        $this->activeSettingMenu = 'crm_event_settings';
        $this->middleware(function ($request, $next) {
            return user()->permission('manage_company_setting') !== 'all'
                ? redirect()->route('profile-settings.index')
                : $next($request);
        });
    }

    // ─── Status Toggle (shared) ───────────────────────────────────────

    public function changeStatus(Request $request)
    {
        $request->validate([
            'entity_type' => 'required|in:category,type,rule,retention',
            'id' => 'required|integer',
            'status' => 'required|in:active,inactive',
        ]);

        $modelMap = [
            'category' => CrmEventCategory::class,
            'type' => CrmEventType::class,
            'rule' => CrmBusinessRule::class,
            'retention' => CrmEventRetentionPolicy::class,
        ];

        $model = $modelMap[$request->entity_type]::findOrFail($request->id);
        $model->is_active = $request->status === 'active';
        $model->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    // ─── Categories ───────────────────────────────────────────────────

    public function createCategory()
    {
        $this->category = new CrmEventCategory();
        return view('company-settings.crm-events.category-edit', $this->data);
    }

    public function storeCategory(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:crm_event_categories,slug',
            'description' => 'nullable|string|max:1000',
        ]);

        CrmEventCategory::create([
            'company_id' => company()->id,
            'name' => $request->name,
            'slug' => $request->slug,
            'description' => $request->description,
            'is_active' => $request->has('is_active') ? 1 : 0,
        ]);

        return Reply::redirect(route('company-settings.crm_events'), __('messages.recordSaved'));
    }

    public function editCategory($id)
    {
        $this->category = CrmEventCategory::findOrFail($id);
        return view('company-settings.crm-events.category-edit', $this->data);
    }

    public function updateCategory(Request $request, $id)
    {
        $category = CrmEventCategory::findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:crm_event_categories,slug,' . $id,
            'description' => 'nullable|string|max:1000',
        ]);

        $category->update([
            'name' => $request->name,
            'slug' => $request->slug,
            'description' => $request->description,
            'is_active' => $request->has('is_active') ? 1 : 0,
        ]);

        return Reply::redirect(route('company-settings.crm_events'), __('messages.updateSuccess'));
    }

    public function destroyCategory($id)
    {
        $category = CrmEventCategory::findOrFail($id);

        if ($category->eventTypes()->count() > 0) {
            return Reply::error(__('This category has event types assigned. Remove them first.'));
        }

        $category->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    // ─── Event Types ──────────────────────────────────────────────────

    public function createType()
    {
        $this->eventType = new CrmEventType();
        $this->categories = CrmEventCategory::active()->orderBy('name')->get();
        $this->businessRules = CrmBusinessRule::active()->orderBy('name')->get();
        return view('company-settings.crm-events.type-edit', $this->data);
    }

    public function storeType(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:crm_event_types,slug',
            'category_id' => 'required|exists:crm_event_categories,id',
            'description' => 'nullable|string|max:1000',
            'model_type' => 'nullable|string|max:255',
            'business_rule_id' => 'nullable|exists:crm_business_rules,id',
            'metadata_schema' => 'nullable|json',
        ]);

        CrmEventType::create([
            'company_id' => company()->id,
            'name' => $request->name,
            'slug' => $request->slug,
            'category_id' => $request->category_id,
            'description' => $request->description,
            'model_type' => $request->model_type,
            'business_rule_id' => $request->business_rule_id ?: null,
            'is_system' => false,
            'is_active' => $request->has('is_active') ? 1 : 0,
            'sync_processing' => $request->has('sync_processing') ? 1 : 0,
            'metadata_schema' => $request->metadata_schema ? json_decode($request->metadata_schema, true) : null,
        ]);

        return Reply::redirect(route('company-settings.crm_events') . '?tab=types', __('messages.recordSaved'));
    }

    public function editType($id)
    {
        $this->eventType = CrmEventType::findOrFail($id);
        $this->categories = CrmEventCategory::active()->orderBy('name')->get();
        $this->businessRules = CrmBusinessRule::active()->orderBy('name')->get();
        return view('company-settings.crm-events.type-edit', $this->data);
    }

    public function updateType(Request $request, $id)
    {
        $eventType = CrmEventType::findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:crm_event_types,slug,' . $id,
            'category_id' => 'required|exists:crm_event_categories,id',
            'description' => 'nullable|string|max:1000',
            'model_type' => 'nullable|string|max:255',
            'business_rule_id' => 'nullable|exists:crm_business_rules,id',
            'metadata_schema' => 'nullable|json',
        ]);

        $data = [
            'category_id' => $request->category_id,
            'description' => $request->description,
            'model_type' => $request->model_type,
            'business_rule_id' => $request->business_rule_id ?: null,
            'is_active' => $request->has('is_active') ? 1 : 0,
            'sync_processing' => $request->has('sync_processing') ? 1 : 0,
            'metadata_schema' => $request->metadata_schema ? json_decode($request->metadata_schema, true) : null,
        ];

        // System types: name and slug are immutable
        if (!$eventType->is_system) {
            $data['name'] = $request->name;
            $data['slug'] = $request->slug;
        }

        $eventType->update($data);

        return Reply::redirect(route('company-settings.crm_events') . '?tab=types', __('messages.updateSuccess'));
    }

    public function destroyType($id)
    {
        $eventType = CrmEventType::findOrFail($id);

        if ($eventType->is_system) {
            return Reply::error(__('System-managed event types cannot be deleted.'));
        }

        $eventType->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    // ─── Business Rules ───────────────────────────────────────────────

    public function createRule()
    {
        $this->businessRule = new CrmBusinessRule();
        return view('company-settings.crm-events.rule-edit', $this->data);
    }

    public function storeRule(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:crm_business_rules,slug',
            'description' => 'nullable|string|max:1000',
            'rule_config' => 'nullable|json',
        ]);

        CrmBusinessRule::create([
            'company_id' => company()->id,
            'name' => $request->name,
            'slug' => $request->slug,
            'description' => $request->description,
            'rule_config' => $request->rule_config ? json_decode($request->rule_config, true) : null,
            'is_active' => $request->has('is_active') ? 1 : 0,
        ]);

        return Reply::redirect(route('company-settings.crm_events') . '?tab=rules', __('messages.recordSaved'));
    }

    public function editRule($id)
    {
        $this->businessRule = CrmBusinessRule::findOrFail($id);
        return view('company-settings.crm-events.rule-edit', $this->data);
    }

    public function updateRule(Request $request, $id)
    {
        $rule = CrmBusinessRule::findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:crm_business_rules,slug,' . $id,
            'description' => 'nullable|string|max:1000',
            'rule_config' => 'nullable|json',
        ]);

        $rule->update([
            'name' => $request->name,
            'slug' => $request->slug,
            'description' => $request->description,
            'rule_config' => $request->rule_config ? json_decode($request->rule_config, true) : null,
            'is_active' => $request->has('is_active') ? 1 : 0,
        ]);

        return Reply::redirect(route('company-settings.crm_events') . '?tab=rules', __('messages.updateSuccess'));
    }

    public function destroyRule($id)
    {
        $rule = CrmBusinessRule::findOrFail($id);

        if ($rule->eventTypes()->count() > 0) {
            return Reply::error(__('This rule has event types linked. Unlink them first.'));
        }

        $rule->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    // ─── Retention Policy ─────────────────────────────────────────────

    public function updateRetention(Request $request)
    {
        $request->validate([
            'max_age_days' => 'required|integer|min:1|max:3650',
            'max_row_count' => 'required|integer|min:1000',
            'archive_storage' => 'required|in:database,filesystem',
            'archive_table' => 'nullable|string|max:255',
        ]);

        CrmEventRetentionPolicy::updateOrCreate(
            ['company_id' => company()->id],
            [
                'max_age_days' => $request->max_age_days,
                'max_row_count' => $request->max_row_count,
                'archive_storage' => $request->archive_storage,
                'archive_table' => $request->archive_table ?: 'crm_events_archive',
                'is_active' => $request->has('is_active') ? 1 : 0,
            ]
        );

        return Reply::success(__('messages.updateSuccess'));
    }
}
