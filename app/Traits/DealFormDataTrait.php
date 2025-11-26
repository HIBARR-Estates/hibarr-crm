<?php

namespace App\Traits;

use App\Enums\Salutation;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\LeadPipeline;
use App\Models\LeadSource;
use App\Models\Package;
use App\Models\PipelineStage;
use App\Models\Product;
use App\Models\User;

trait DealFormDataTrait
{
    /**
     * Get all necessary data for the Deal Form (SaveDealModal).
     *
     * @return array
     */
    public function getDealFormData()
    {
        $pipelines = LeadPipeline::all();
        $defaultPipeline = LeadPipeline::where('default', 1)->first();
        $stages = PipelineStage::where('lead_pipeline_id', optional($defaultPipeline)->id)->get();
        
        // Get custom fields
        $deal = new Deal();
        $getCustomFieldGroupsWithFields = $deal->getCustomFieldGroupsWithFields();
        $fields = $getCustomFieldGroupsWithFields ? $getCustomFieldGroupsWithFields->fields : [];

        // Get custom field categories
        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        $customFieldCategories = collect();
        if ($dealCustomFieldGroup) {
            $customFieldCategories = CustomFieldCategory::where('custom_field_group_id', $dealCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->get();
        }

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
            'leadContacts' => Lead::allLeads(),
            'products' => Product::all(),
            'packages' => Package::all(),
            'customFields' => $fields,
            'customFieldCategories' => $customFieldCategories,
        ];
    }
}
