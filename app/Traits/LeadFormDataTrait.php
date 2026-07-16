<?php

namespace App\Traits;

use App\Enums\Salutation;
use App\Enums\AgeRange;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\Lead;
use App\Models\LeadAgent;
use Illuminate\Support\Facades\DB;
use App\Models\LeadCategory;
use App\Models\LeadPipeline;
use App\Models\LeadSource;
use App\Models\PipelineStage;
use App\Models\Product;
use App\Models\User;
use App\Models\ClientCategory;
use App\Models\LanguageSetting;
use App\Models\LeadLifecycleStatus;
use App\Services\LeadCoreFieldsService;

trait LeadFormDataTrait
{
    /**
     * Get all necessary data for the Lead Form (SaveLeadModal).
     *
     * @return array
     */
    public function getLeadFormData()
    {
        return array_merge($this->getLeadShowShellFormData(), $this->getLeadShowDeferredFormData());
    }

    /**
     * Lead Show first-paint form metadata (C1 shell).
     */
    public function getLeadShowShellFormData(): array
    {
        $lead = new Lead();
        $getCustomFieldGroupsWithFields = $lead->getCustomFieldGroupsWithFields();
        $fields = $getCustomFieldGroupsWithFields ? $getCustomFieldGroupsWithFields->fields : [];

        $leadCustomFieldGroup = CustomFieldGroup::where('model', Lead::CUSTOM_FIELD_MODEL)->first();
        $customFieldCategories = collect();
        if ($leadCustomFieldGroup) {
            $customFieldCategories = CustomFieldCategory::where('custom_field_group_id', $leadCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get();
        }

        return [
            'categories' => LeadCategory::all(),
            'sources' => LeadSource::all(),
            'employees' => User::allEmployees(null, true),
            'countries' => countries(),
            'salutations' => collect(Salutation::cases())->map(function ($salutation) {
                return [
                    'value' => $salutation->value,
                    'label' => $salutation->label(),
                ];
            }),
            'ageRanges' => collect(AgeRange::cases())->map(function (AgeRange $ageRange) {
                return [
                    'value' => $ageRange->value,
                    'label' => $ageRange->label(),
                ];
            }),
            'customFields' => app(LeadCoreFieldsService::class)
                ->filterPromotedFieldDefinitions($fields)
                ->all(),
            'customFieldCategories' => $customFieldCategories,
            'clientCategories' => ClientCategory::all(),
            'languages' => LanguageSetting::where('status', 'enabled')->get(),
            'leadLifecycleStatuses' => LeadLifecycleStatus::where('company_id', company()->id)
                ->orderBy('sort_order')
                ->get(['id', 'key', 'label', 'label_color', 'sort_order']),
        ];
    }

    /**
     * Lead Show deferred form metadata used for deal-create / agents (C1 defer).
     */
    public function getLeadShowDeferredFormData(): array
    {
        return [
            'leadPipelines' => LeadPipeline::orderBy('default', 'DESC')->get(),
            'leadStages' => PipelineStage::all(),
            'leadAgents' => LeadAgent::with('user')->whereHas('user', function ($q) {
                $q->where('status', 'active');
            })->get(),
            'products' => Product::all(),
        ];
    }
}
