<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\DealAutomation;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DealAutomationController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.dealAutomations';
        $this->activeSettingMenu = 'company_settings';
        $this->middleware(function ($request, $next) {
            return user()->permission('manage_company_setting') !== 'all' ? redirect()->route('profile-settings.index') : $next($request);
        });
    }

    public function create()
    {
        $this->automation = new DealAutomation();
        $this->pipelines = LeadPipeline::all();
        $this->stages = PipelineStage::all();
        
        // Fetch custom fields for Deal model
        $dealGroup = CustomFieldGroup::where('model', 'App\Models\Deal')->first();
        $this->customFields = $dealGroup ? CustomField::where('custom_field_group_id', $dealGroup->id)->get() : collect([]);

        $this->hibarrFields = [
            'interested_in' => 'Interested In',
            'motivation' => 'Motivation',
            'purchase_timeline' => 'Purchase Timeline',
            'budget_range' => 'Budget Range',
            'message' => 'Message',
            'strategy_meeting_booked' => 'Strategy Meeting Booked',
            'downpayment_paid' => 'Downpayment Paid',
            'inspection_trip_date' => 'Inspection Trip Date',
            'deposit_confirmation' => 'Deposit Confirmation',
            'reservation_agreement' => 'Reservation Agreement',
            'sales_contract' => 'Sales Contract'
        ];

        $this->relatedFields = [
            'followup_count' => 'Follow-up Count',
            'last_followup_days_ago' => 'Days Since Last Follow-up',
            'last_followup_status' => 'Last Follow-up Status',
            'next_followup_date' => 'Next Follow-up Date'
        ];

        return view('company-settings.deal-automation.edit', $this->data);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'pipeline_id' => 'required|exists:lead_pipelines,id',
            'priority' => 'required|integer',
            'conditions' => 'array',
            'actions' => 'required|array|min:1',
        ]);

        DB::beginTransaction();

        try {
            $automation = DealAutomation::create([
                'name' => $request->name,
                'pipeline_id' => $request->pipeline_id,
                'trigger' => $request->trigger,
                'active' => $request->has('active') ? 1 : 0,
                'priority' => $request->priority,
            ]);

            if ($request->has('conditions')) {
                foreach ($request->conditions as $condition) {
                    if (!empty($condition['field'])) {
                        $automation->conditions()->create([
                            'field' => $condition['field'],
                            'operator' => $condition['operator'],
                            'value' => $condition['value'] ?? '',
                        ]);
                    }
                }
            }

            foreach ($request->actions as $action) {
                $automation->actions()->create([
                    'target_stage_id' => $action['target_stage_id'],
                    'target_pipeline_id' => $action['target_pipeline_id'] ?? null,
                    'forward_only' => isset($action['forward_only']) ? 1 : 0,
                ]);
            }

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
        $this->pipelines = LeadPipeline::all();
        $this->stages = PipelineStage::all();
        
        $dealGroup = CustomFieldGroup::where('model', 'App\Models\Deal')->first();
        $this->customFields = $dealGroup ? CustomField::where('custom_field_group_id', $dealGroup->id)->get() : collect([]);

        $this->hibarrFields = [
            'interested_in' => 'Interested In',
            'motivation' => 'Motivation',
            'purchase_timeline' => 'Purchase Timeline',
            'budget_range' => 'Budget Range',
            'message' => 'Message',
            'strategy_meeting_booked' => 'Strategy Meeting Booked',
            'downpayment_paid' => 'Downpayment Paid',
            'inspection_trip_date' => 'Inspection Trip Date',
            'deposit_confirmation' => 'Deposit Confirmation',
            'reservation_agreement' => 'Reservation Agreement',
            'sales_contract' => 'Sales Contract'
        ];

        $this->relatedFields = [
            'followup_count' => 'Follow-up Count',
            'last_followup_days_ago' => 'Days Since Last Follow-up',
            'last_followup_status' => 'Last Follow-up Status',
            'next_followup_date' => 'Next Follow-up Date'
        ];

        return view('company-settings.deal-automation.edit', $this->data);
    }

    public function update(Request $request, $id)
    {
        $automation = DealAutomation::findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:255',
            'pipeline_id' => 'required|exists:lead_pipelines,id',
            'priority' => 'required|integer',
            'conditions' => 'array',
            'actions' => 'required|array|min:1',
        ]);

        DB::beginTransaction();

        try {
            $automation->update([
                'name' => $request->name,
                'pipeline_id' => $request->pipeline_id,
                'trigger' => $request->trigger,
                'active' => $request->has('active') ? 1 : 0,
                'priority' => $request->priority,
            ]);

            // Sync conditions
            $automation->conditions()->delete();
            if ($request->has('conditions')) {
                foreach ($request->conditions as $condition) {
                    if (!empty($condition['field'])) {
                        $automation->conditions()->create([
                            'field' => $condition['field'],
                            'operator' => $condition['operator'],
                            'value' => $condition['value'] ?? '',
                        ]);
                    }
                }
            }

            // Sync actions
            $automation->actions()->delete();
            foreach ($request->actions as $action) {
                $automation->actions()->create([
                    'target_stage_id' => $action['target_stage_id'],
                    'target_pipeline_id' => $action['target_pipeline_id'] ?? null,
                    'forward_only' => isset($action['forward_only']) ? 1 : 0,
                ]);
            }

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
}
