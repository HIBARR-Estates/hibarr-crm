<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\StorePackageRequest;
use App\Models\LeadPipeline;
use App\Models\Package;
use App\Models\PackagePipeline;
use App\Models\PipelineStage;
use App\Services\PackagePipelineRouterService;
use App\Services\PackageRoutingFieldCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PackageController extends AccountBaseController
{
    public function __construct(
        protected PackageRoutingFieldCatalog $routingFieldCatalog,
        protected PackagePipelineRouterService $packageRouter,
    ) {
        parent::__construct();
        $this->pageTitle = 'app.menu.packages';
        $this->activeSettingMenu = 'packages';
        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        $this->packages = Package::with('packagePipeline.pipeline')->orderBy('id', 'asc')->get();

        return view('packages.index', $this->data);
    }

    public function create()
    {
        $this->pipelines = LeadPipeline::where('company_id', company()->id)->get();
        $this->stages = PipelineStage::where('company_id', company()->id)
            ->orderBy('lead_pipeline_id')
            ->orderBy('priority')
            ->get();
        $companyId = (int) company()->id;
        $this->routingFieldGroups = $this->routingFieldCatalog->groupedFieldItems($companyId);
        $this->routingFieldOptions = $this->routingFieldCatalog->allFieldOptions($companyId);
        $this->routingTriggerFieldItems = $this->routingFieldCatalog->enabledFlatFieldItems($companyId);
        $this->routingMatchModeOptions = [
            PackageRoutingFieldCatalog::MATCH_MODE_EXACT => __('modules.deal.routingTriggerMatchModeExact'),
            PackageRoutingFieldCatalog::MATCH_MODE_PRESENT => __('modules.deal.routingTriggerMatchModePresent'),
        ];
        $this->routingTriggers = [];

        return view('packages.create', $this->data);
    }

    public function store(StorePackageRequest $request)
    {
        DB::transaction(function () use ($request, &$package) {
            $package = Package::create([
                'name' => $request->name,
                'value' => $request->value,
                'description' => $request->description,
                'customer_type_name' => $request->customer_type_name,
                'customer_type_description' => $request->customer_type_description,
            ]);

            $this->syncPackagePipeline($package, $request);
            $this->packageRouter->syncPackageRoutingTriggers(
                $package,
                $request->input('routing_triggers', []),
            );
        });

        return Reply::success(__('messages.recordSaved'));
    }

    public function edit($id)
    {
        $this->package = Package::with(['packagePipeline', 'routingTriggers'])->findOrFail($id);
        $this->pipelines = LeadPipeline::where('company_id', company()->id)->get();
        $this->stages = PipelineStage::where('company_id', company()->id)
            ->orderBy('lead_pipeline_id')
            ->orderBy('priority')
            ->get();
        $companyId = (int) company()->id;
        $this->routingFieldGroups = $this->routingFieldCatalog->groupedFieldItems($companyId);
        $this->routingFieldOptions = $this->routingFieldCatalog->allFieldOptions($companyId);
        $this->routingTriggerFieldItems = $this->routingFieldCatalog->enabledFlatFieldItems($companyId);
        $this->routingMatchModeOptions = [
            PackageRoutingFieldCatalog::MATCH_MODE_EXACT => __('modules.deal.routingTriggerMatchModeExact'),
            PackageRoutingFieldCatalog::MATCH_MODE_PRESENT => __('modules.deal.routingTriggerMatchModePresent'),
        ];
        $this->routingTriggers = $this->package->routingTriggers
            ->map(fn ($trigger) => [
                'field_key' => $trigger->field_key,
                'match_mode' => $trigger->match_mode ?: PackageRoutingFieldCatalog::MATCH_MODE_EXACT,
                'match_value' => $trigger->match_value,
            ])
            ->all();

        return view('packages.edit', $this->data);
    }

    public function update(StorePackageRequest $request, $id)
    {
        $package = Package::findOrFail($id);

        DB::transaction(function () use ($request, $package) {
            $package->name = $request->name;
            $package->value = $request->value;
            $package->description = $request->description;
            $package->customer_type_name = $request->customer_type_name;
            $package->customer_type_description = $request->customer_type_description;
            $package->save();

            $this->syncPackagePipeline($package, $request);
            $this->packageRouter->syncPackageRoutingTriggers(
                $package,
                $request->input('routing_triggers', []),
            );
        });

        return Reply::success(__('messages.updateSuccess'));
    }

    public function destroy($id)
    {
        $package = Package::find($id);

        if (!$package) {
            return Reply::error('Package not found.');
        }

        // Package is soft-deleted, so its pipeline mapping is left intact —
        // it comes back automatically if the package is restored. The FK
        // (package_pipeline.package_id -> packages.id, cascade) cleans it up
        // if the package is ever force-deleted.
        $package->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    protected function syncPackagePipeline(Package $package, Request $request): void
    {
        PackagePipeline::where('package_id', $package->id)->delete();

        if (!$request->filled('pipeline_id')) {
            return;
        }

        PackagePipeline::create([
            'company_id' => company()->id,
            'package_id' => $package->id,
            'pipeline_id' => $request->pipeline_id,
            'default_stage_id' => $request->default_stage_id ?: null,
        ]);
    }
}
