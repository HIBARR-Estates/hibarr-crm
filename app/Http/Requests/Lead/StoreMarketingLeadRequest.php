<?php

namespace App\Http\Requests\Lead;

use App\Services\OlUtmConfigService;
use App\Support\MarketingLeadIntake;
use Illuminate\Validation\Validator;

/**
 * The marketing lead flow's payload: the same personal-information and
 * custom-field rules as the regular lead form, plus attribution and notes.
 * No deal creation or status, and origin is stamped server-side. The owner
 * must be someone who can own leads; UTM values must be options OL lists and
 * become the first touch.
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
            'website' => ['nullable', 'string', 'max:255', 'url:http,https', 'regex:/^https?:\/\/[^\s\/?#:]+\.(?:[a-z]{2,}|xn--[a-z0-9-]+)(:\d+)?([\/?#]|$)/i'],
            'address' => 'nullable|string|max:1000',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:50',
            'source_id' => 'nullable|integer|exists:lead_sources,id,company_id,'.$companyId,
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:lead_category,id',
            'custom_fields_data' => 'nullable|array',
            'lead_owner' => [
                'nullable',
                'integer',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (! MarketingLeadIntake::canOwn((int) $value)) {
                        $fail(__('pages.marketing_leads.owner_invalid'));
                    }
                },
            ],
            'utm' => 'nullable|array',
            'utm.utm_source' => 'nullable|string|max:255',
            'utm.utm_medium' => 'nullable|string|max:255',
            'utm.utm_campaign' => 'nullable|string|max:255',
            'utm.utm_content' => 'nullable|string|max:255',
            'utm.utm_term' => 'nullable|string|max:255',
            'utm.utm_audience' => 'nullable|string|max:255',
            'notes' => 'nullable|array|max:20',
            'notes.*.title' => 'nullable|string|max:255',
            'notes.*.details' => 'required|string|max:20000',
        ]);
    }

    /** "example.com" is how people type a website; store it as https://example.com. */
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

        $raw = $this->input('website');
        // Anything but a string is left for the `string` rule to reject.
        if (! is_string($raw) && $raw !== null) {
            return;
        }
        $website = trim((string) $raw);
        if ($website === '') {
            $this->merge(['website' => null]);

            return;
        }

        if (! preg_match('#^[a-z][a-z0-9+.-]*://#i', $website)) {
            $this->merge(['website' => 'https://'.$website]);
        }
    }

    /** Each UTM value has to be one of the options OL manages for that field. */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $configs = app(OlUtmConfigService::class);
            foreach (OlUtmConfigService::TYPES as $field => $type) {
                $value = $this->input("utm.{$field}");
                if (! is_string($value) || trim($value) === '') {
                    continue;
                }

                try {
                    $listed = $configs->has($type, $value);
                } catch (\Throwable $e) {
                    report($e);
                    $validator->errors()->add("utm.{$field}", __('pages.marketing_leads.utm_unavailable'));

                    continue;
                }

                if (! $listed) {
                    $validator->errors()->add("utm.{$field}", __('pages.marketing_leads.utm_not_listed'));
                }
            }
        });
    }

    public function messages()
    {
        return array_merge(parent::messages(), [
            'website.url' => __('pages.marketing_leads.website_invalid'),
            'website.regex' => __('pages.marketing_leads.website_invalid'),
        ]);
    }

    public function attributes()
    {
        return array_merge(parent::attributes(), [
            'notes.*.details' => __('app.note'),
        ]);
    }
}
