<?php

namespace App\Traits;

use App\Enums\Salutation;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\LeadPipeline;
use App\Models\LeadSource;
use App\Models\PipelineStage;
use App\Models\Product;
use App\Models\User;
use App\Models\ClientCategory;
use App\Models\LanguageSetting;

trait LeadFormDataTrait
{
    /**
     * Get all necessary data for the Lead Form (SaveLeadModal).
     *
     * @return array
     */
    public function getLeadFormData()
    {
        // Get custom fields
        $lead = new Lead();
        $getCustomFieldGroupsWithFields = $lead->getCustomFieldGroupsWithFields();
        $fields = $getCustomFieldGroupsWithFields ? $getCustomFieldGroupsWithFields->fields : [];

        // Get custom field categories
        $leadCustomFieldGroup = CustomFieldGroup::where('model', Lead::CUSTOM_FIELD_MODEL)->first();
        $customFieldCategories = collect();
        if ($leadCustomFieldGroup) {
            $customFieldCategories = CustomFieldCategory::where('custom_field_group_id', $leadCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->get();
        }

        return [
            'leadPipelines' => LeadPipeline::orderBy('default', 'DESC')->get(),
            'leadStages' => PipelineStage::all(),
            'categories' => LeadCategory::all(),
            'sources' => LeadSource::all(),
            'employees' => User::allEmployees(null, true),
            'countries' => countries(),
            'salutations' => collect(Salutation::cases())->map(function($salutation) {
                return [
                    'value' => $salutation->value,
                    'label' => $salutation->label(),
                ];
            }),
            'leadAgents' => LeadAgent::with('user')->whereHas('user', function ($q) {
                $q->where('status', 'active');
            })->get(),
            'products' => Product::all(),
            'customFields' => $fields,
            'customFieldCategories' => $customFieldCategories,
            'clientCategories' => ClientCategory::all(),
            'languages' => LanguageSetting::where('status', 'enabled')->get(),
        ];
    }
}
