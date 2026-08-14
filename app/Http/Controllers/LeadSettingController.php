<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\LeadCategory;
use App\Models\LeadPipeline;
use App\Models\LeadSource;
use App\Models\PipelineStage;
use App\Models\User;
use App\Support\FeatureFlags;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Models\LeadSetting;
use App\Services\Dashboard\DashboardMetricsService;
use App\Services\LeadLifecycleStatusService;
use App\Services\PackageRoutingFieldCatalog;

class LeadSettingController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'modules.deal.leadSetting';
        $this->activeSettingMenu = 'lead_settings';
        $this->middleware(function ($request, $next) {
            abort_403(!(user()->permission('manage_lead_setting') == 'all' && in_array('leads', user_modules())));
            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Contracts\Foundation\Application|\Illuminate\Contracts\View\Factory|\Illuminate\Contracts\View\View|\Illuminate\Http\Response
     */
    public function index()
    {
        $this->pipelines = LeadPipeline::with('stages')->get();
        $this->leadSources = LeadSource::all();
        $this->leadStages = PipelineStage::all();
        $this->leadAgents = User::whereHas('leadAgent')->with('leadAgent', 'employeeDetail.designation:id,name')->get();
        $this->leadCategories = LeadCategory::all();
        $this->leadSettings = LeadSetting::select('status', 'first_contact_sla_hours')->first();
        $this->slaHoursDefault = DashboardMetricsService::SLA_HOURS_DEFAULT;
        $this->slaHoursMin = DashboardMetricsService::SLA_HOURS_MIN;
        $this->slaHoursMax = DashboardMetricsService::SLA_HOURS_MAX;
        $this->leadLifecycleStatuses = app(LeadLifecycleStatusService::class)
            ->listForCompany((int) company()->id);

        $this->employees = User::doesntHave('leadAgent')
            ->join('role_user', 'role_user.user_id', '=', 'users.id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->select('users.id', 'users.name', 'users.email', 'users.created_at')
            ->where('roles.name', 'employee')
            ->get();

        $tab = request('tab');

        $this->view = match ($tab) {
            'pipeline' => 'lead-settings.ajax.pipeline',
            'agent' => 'lead-settings.ajax.agent',
            'category' => 'lead-settings.ajax.category',
            'method' => 'lead-settings.ajax.method',
            'lifecycle' => 'lead-settings.ajax.lifecycle',
            'deal-packages' => 'lead-settings.ajax.deal-packages',
            default => 'lead-settings.ajax.source',
        };

        $this->activeTab = $tab ?: 'source';
        $this->pipelineNavVisibilityEnabled = FeatureFlags::enabled('crm.pipeline-nav-visibility');

        if ($this->activeTab === 'deal-packages') {
            $catalog = app(PackageRoutingFieldCatalog::class);
            $companyId = (int) company()->id;
            $this->routingFieldGroups = $catalog->groupedFieldItems($companyId);
            $this->routingFieldOptions = $catalog->allFieldOptions($companyId);
            $selected = company()->package_pipeline_routing_trigger_fields;
            if (is_string($selected)) {
                $selected = json_decode($selected, true);
            }
            $this->selectedRoutingTriggerFields = is_array($selected) ? $selected : array_keys($this->routingFieldOptions);
        }

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle, 'activeTab' => $this->activeTab]);
        }

        return view('lead-settings.index', $this->data);

    }

    /**
     * Update the lead setting.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function updateLeadSettingStatus($id, Request $request)
    {
        $leadSetting = LeadSetting::where('company_id', $id)->first();

        if(!$leadSetting){
            $leadSetting = new LeadSetting;
            $leadSetting->company_id = $id;
            $leadSetting->user_id = $request->userId;
        }

        $leadSetting->status = $request->lead_setting_status;

        $leadSetting->save();

        return reply::success(__('messages.updateSuccess'));
    }

    /**
     * How many hours an agent has to make first contact on a new lead.
     *
     * Drives the "Contacted in SLA" KPI and the per-agent breach column on the
     * v2 manager dashboard. Bounds come from DashboardMetricsService so the form
     * and the reader cannot disagree about what a valid value is.
     */
    public function updateFirstContactSla(Request $request)
    {
        $request->validate([
            'first_contact_sla_hours' => [
                'required',
                'integer',
                'min:' . DashboardMetricsService::SLA_HOURS_MIN,
                'max:' . DashboardMetricsService::SLA_HOURS_MAX,
            ],
        ]);

        // Assigned rather than mass-filled: LeadSetting declares no $fillable, so
        // it is totally guarded and fill() would throw. Same shape as
        // updateLeadSettingStatus above.
        $companyId = company()->id;
        $leadSetting = LeadSetting::where('company_id', $companyId)->first();

        if (! $leadSetting) {
            // A company that has never opened this screen has no row at all, and
            // without this the saved SLA would silently stay at the default.
            $leadSetting = new LeadSetting;
            $leadSetting->company_id = $companyId;
            $leadSetting->user_id = user()->id;
        }

        $leadSetting->first_contact_sla_hours = (int) $request->first_contact_sla_hours;
        $leadSetting->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    public function updateDealPackageSettings(Request $request)
    {
        $allowedFieldKeys = array_keys(
            app(\App\Services\PackageRoutingFieldCatalog::class)->allFieldOptions(company()->id),
        );

        $request->validate([
            'deal_package_mode' => 'required|in:single,multiple',
            'package_pipeline_routing_trigger_fields' => 'nullable|array',
            'package_pipeline_routing_trigger_fields.*' => ['string', 'max:100', Rule::in($allowedFieldKeys)],
        ]);

        $company = company();
        $dealPackageMode = $request->deal_package_mode;
        $company->deal_package_mode = $dealPackageMode;
        $company->package_pipeline_routing_enabled = $dealPackageMode === 'single'
            && $request->has('package_pipeline_routing_enabled')
            ? 1
            : 0;
        $company->package_pipeline_routing_trigger_fields = $request->has('package_pipeline_routing_trigger_fields')
            ? array_values(array_intersect(
                $request->input('package_pipeline_routing_trigger_fields', []),
                $allowedFieldKeys,
            ))
            : [];
        $company->save();

        return Reply::success(__('messages.updateSuccess'));
    }

}
