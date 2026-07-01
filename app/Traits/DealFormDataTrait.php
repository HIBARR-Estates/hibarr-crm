<?php

namespace App\Traits;

use App\Enums\Salutation;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Support\Facades\DB;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\LeadPipeline;
use App\Models\LeadSource;
use App\Models\Package;
use App\Models\PipelineStage;
use App\Models\Product;
use App\Models\User;
use App\Services\PackagePipelineRouterService;
use App\Services\PipelineScopeResolverService;

trait DealFormDataTrait
{
    /**
     * Get all necessary data for the Deal Form (SaveDealModal).
     *
     * @return array
     */
    public function getDealFormData()
    {
        $scopeResolver = app(PipelineScopeResolverService::class);
        $packageRouter = app(PackagePipelineRouterService::class);

        $pipelines = LeadPipeline::query()
            ->with(['customFieldCategoryScopes', 'stages'])
            ->get();
        $defaultPipeline = LeadPipeline::where('default', 1)->first();
        $stages = PipelineStage::all();
        
        $deal = new Deal();
        $getCustomFieldGroupsWithFields = $deal->getCustomFieldGroupsWithFields();
        $fields = $getCustomFieldGroupsWithFields ? $getCustomFieldGroupsWithFields->fields : [];

        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        $customFieldCategories = collect();
        if ($dealCustomFieldGroup) {
            $customFieldCategories = CustomFieldCategory::where('custom_field_group_id', $dealCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get();
        }

        $pipelineCategoryScopeMap = $scopeResolver->buildCategoryScopeMapForCompany(
            company()->id
        );

        // Backward-compatible flat map (pipeline-wide only)
        $pipelineCustomFieldCategoryIdsByPipeline = collect($pipelineCategoryScopeMap)
            ->mapWithKeys(function ($scope, $pipelineId) {
                return [(string) $pipelineId => $scope['pipelineWide'] ?? []];
            })
            ->toArray();

        $pipelineFieldScopeMap = $scopeResolver->buildFieldScopeMapForCompany(
            company()->id
        );

        $packageSettings = $packageRouter->getDealPackageSettings();

        return [
            'leadPipelines' => $pipelines,
            'stages' => $stages,
            'categories' => LeadCategory::all(),
            'sources' => LeadSource::all(),
            'employees' => User::allEmployees(null, true),
            'countries' => countries(),
            'salutations' => collect(Salutation::cases())->map(function($salutation) {
                return [
                    'value' => $salutation->value,
                    'label' => $salutation->name,
                ];
            }),
            'leadAgents' => LeadAgent::with('user')->whereHas('user', function ($q) {
                $q->where('status', 'active');
            })->get(),
            'nonActiveLeadAgents' => LeadAgent::with('user')->whereHas('user', function ($q) {
                $q->where('status', '!=', 'active');
            })->get(),
            'leadContacts' => Lead::allLeads(),
            'products' => Product::all(),
            'packages' => Package::all(),
            'customFields' => $fields,
            'customFieldCategories' => $customFieldCategories,
            'pipelineCustomFieldCategoryIdsByPipeline' => $pipelineCustomFieldCategoryIdsByPipeline,
            'pipelineCategoryScopeMap' => $pipelineCategoryScopeMap,
            'pipelineFieldScopeMap' => $pipelineFieldScopeMap,
            'packagePipelineRoutingEnabled' => $packageSettings['packagePipelineRoutingEnabled'],
            'dealPackageMode' => $packageSettings['dealPackageMode'],
        ];
    }
}
