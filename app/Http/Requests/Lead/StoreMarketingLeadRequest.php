<?php

namespace App\Http\Requests\Lead;

/**
 * The marketing lead flow's payload: the same personal-information and
 * custom-field rules as the regular lead form, plus attribution and notes.
 * No deal creation, status, owner or origin: the flow never sends those, and
 * origin is stamped server-side.
 */
class StoreMarketingLeadRequest extends StoreRequest
{
    public function rules()
    {
        $rules = parent::rules();

        unset(
            $rules['lead_lifecycle_status_id'],
            $rules['name'],
            $rules['pipeline'],
            $rules['stage_id'],
            $rules['close_date'],
            $rules['value'],
        );

        $companyId = company()->id;

        return array_merge($rules, [
            'client_name' => 'required|string|max:255',
            'mobile' => 'nullable',
            'cell' => 'nullable|string|max:50',
            'office' => 'nullable|string|max:50',
            'company_name' => 'nullable|string|max:255',
            'website' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:1000',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:50',
            'source_id' => 'nullable|integer|exists:lead_sources,id,company_id,'.$companyId,
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:lead_category,id',
            'custom_fields_data' => 'nullable|array',
            'notes' => 'nullable|array|max:20',
            'notes.*.title' => 'nullable|string|max:255',
            'notes.*.details' => 'required|string|max:20000',
        ]);
    }

    public function attributes()
    {
        return array_merge(parent::attributes(), [
            'notes.*.details' => __('app.note'),
        ]);
    }
}
