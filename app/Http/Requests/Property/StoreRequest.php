<?php

namespace App\Http\Requests\Property;

use App\Http\Requests\CoreRequest;
use App\Models\DeveloperProject;
use App\Models\Property;
use Illuminate\Validation\Rule;

class StoreRequest extends CoreRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        $rules = [
            'property_type' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    // Check lookup table first, then fall back to constants
                    $existsInLookup = \App\Models\PropertyType::where('name', $value)->exists();
                    if ($existsInLookup) {
                        return;
                    }
                    $allTypes = Property::getAllPropertyTypes();
                    if (!in_array($value, $allTypes)) {
                        $fail("The selected {$attribute} is invalid.");
                    }
                },
            ],
            'sale_type' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    // Check lookup table first
                    if (\App\Models\PropertySaleType::where('name', $value)->exists()) return;
                    // Fall back to constants
                    $allowed = [
                        Property::SALE_TYPE_FOR_SALE,
                        Property::SALE_TYPE_FOR_RENT,
                        Property::SALE_TYPE_DAILY_RENTAL,
                    ];
                    if (!in_array($value, $allowed)) {
                        $fail('The selected Sale Type is invalid.');
                    }
                },
            ],
            // Price can be:
            // - null
            // - numeric (backward compatible)
            // - array (currency input shape)
            // - JSON string representing an array/object (currency input shape)
            // Controller normalizePrice() will coerce these into stored JSON-string format.
            'price' => [
                'nullable',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if ($value === null) {
                        return;
                    }

                    if (is_numeric($value)) {
                        return;
                    }

                    if (is_array($value)) {
                        return;
                    }

                    if (is_string($value)) {
                        $decoded = json_decode($value, true);
                        if (json_last_error() === JSON_ERROR_NONE && ($decoded !== null) && (is_array($decoded) || is_object($decoded))) {
                            return;
                        }

                        $fail("The {$attribute} must be a numeric value, an array, or a valid JSON string.");
                        return;
                    }

                    $fail("The {$attribute} must be a numeric value, an array, or a valid JSON string.");
                },
            ],
            'unit_style' => 'nullable|array',
            'unit_style.*' => [
                'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    // Check lookup table first
                    if (\App\Models\PropertySubType::where('name', $value)->exists()) return;
                    // Fall back to constants
                    if (!in_array($value, Property::UNIT_STYLES)) {
                        $fail('The selected unit style is invalid.');
                    }
                },
            ],
            'minimal_rental_period' => 'nullable|string|max:255',
            'rent_payment_interval' => [
                'nullable',
                'string',
                Rule::in([
                    Property::RENT_PAYMENT_MONTHLY,
                    Property::RENT_PAYMENT_QUARTERLY,
                    Property::RENT_PAYMENT_YEARLY
                ])
            ],
            'title_deed_type' => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if ($value === null) return;
                    // Check lookup table first
                    if (\App\Models\PropertyTitleDeedType::where('name', $value)->exists()) return;
                    // Fall back to old + new constants
                    $allowed = array_merge([
                        Property::TITLE_DEED_EXCHANGE, Property::TITLE_DEED_TURKISH,
                        Property::TITLE_DEED_BRITISH, Property::TITLE_DEED_TAHSIS,
                        Property::TITLE_DEED_MUJAHIT, Property::TITLE_DEED_FREEHOLD,
                        Property::TITLE_DEED_LEASEHOLD, Property::TITLE_DEED_EXCHANGE_KAT,
                        Property::TITLE_DEED_FULL_OWNERSHIP, Property::TITLE_DEED_SHARED,
                        Property::TITLE_DEED_FLOOR_EASEMENT, Property::TITLE_DEED_LAND_REGISTRY,
                    ], Property::DEED_TYPES);
                    if (!in_array($value, $allowed)) {
                        $fail('The selected Title Deed Type is invalid.');
                    }
                },
            ],
            'title_deed_stage' => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if ($value === null) return;
                    // Check lookup table first
                    if (\App\Models\PropertyDeedStatus::where('name', $value)->exists()) return;
                    // Fall back to old + new constants
                    $allowed = array_merge([
                        Property::TITLE_DEED_STAGE_LAND, Property::TITLE_DEED_STAGE_SHARED,
                        Property::TITLE_DEED_STAGE_INDIVIDUAL, Property::TITLE_DEED_STAGE_KAT_IRTIRFAKLI,
                        Property::TITLE_DEED_STAGE_READY, Property::TITLE_DEED_STAGE_IN_PROGRESS,
                        Property::TITLE_DEED_STAGE_PENDING, Property::TITLE_DEED_STAGE_APPLIED,
                        Property::TITLE_DEED_STAGE_UNDER_REVIEW,
                    ], Property::DEED_STATUSES);
                    if (!in_array($value, $allowed)) {
                        $fail('The selected Title Deed Stage is invalid.');
                    }
                },
            ],
            'status' => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if ($value === null) return;
                    // Check lookup table first
                    if (\App\Models\PropertyStatus::where('name', $value)->exists()) return;
                    // Fall back to constants
                    $allowed = [
                        Property::STATUS_AVAILABLE,
                        Property::STATUS_UNDER_OFFER,
                        Property::STATUS_SOLD,
                        Property::STATUS_WITHDRAWN,
                        Property::STATUS_RESERVED,
                        Property::STATUS_RENTED,
                        'Let agreed',
                        'Sale agreed',
                    ];
                    if (!in_array($value, $allowed)) {
                        $fail('The selected Status is invalid.');
                    }
                },
            ],
            'developer_project_id' => 'nullable|exists:developer_projects,id',
            'city' => 'nullable|string|max:255',
            'map' => 'nullable|string',
            'area' => 'nullable|string|max:255',
            'land_size' => 'nullable|numeric|min:0',
            'living_room' => 'nullable|string|max:255',
            'bedrooms' => 'nullable|max:255',
            'bathrooms' => 'nullable|integer|min:0',
            'floor_number' => 'nullable|integer',
            'floors_in_building' => 'nullable|integer|min:1',
            'building_age' => 'nullable|integer|min:0',
            'furniture_status' => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if ($value === null) return;
                    // Check lookup table first
                    if (\App\Models\PropertyFurnitureStatus::where('name', $value)->exists()) return;
                    // Fall back to constants
                    $allowed = [
                        Property::FURNITURE_UNFURNISHED,
                        Property::FURNITURE_FULLY_FURNISHED,
                        Property::FURNITURE_FURNISHED,
                        Property::FURNITURE_SEMI_FURNISHED,
                        Property::FURNITURE_PART_FURNISHED,
                        Property::FURNITURE_WHITE_GOODS_ONLY,
                    ];
                    if (!in_array($value, $allowed)) {
                        $fail('The selected Furniture Status is invalid.');
                    }
                },
            ],
            'within_site' => 'nullable|boolean',
            'exterior_features' => 'nullable|array',
            'interior_features' => 'nullable|array',
            'location_features' => 'nullable|array',
            'title' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'video_url' => 'nullable|url',
            'tour_360_url' => 'nullable|url',
            'photos' => 'nullable|array',
            'photos.*' => 'string',
            'add_ons' => 'nullable|array',
            'add_ons.*' => 'string',

            // New fields: Physical Attributes
            'total_area_sqm' => 'nullable|numeric|min:0',
            'plot_size_sqm' => 'nullable|numeric|min:0',
            'floor' => 'nullable|string|max:255',

            // New fields: Legal Info
            'has_restrictions' => 'nullable|boolean',
            'restriction_notes' => 'nullable|string|required_if:has_restrictions,true',
            'deed_status' => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if ($value === null) {
                        return;
                    }
                    $existsInLookup = \App\Models\PropertyDeedStatus::where('name', $value)->exists();
                    if ($existsInLookup) {
                        return;
                    }
                    if (!in_array($value, Property::DEED_STATUSES)) {
                        $fail("The selected {$attribute} is invalid.");
                    }
                },
            ],

            // New fields: Financial Information
            'price_to_owner' => 'nullable|numeric|min:0',
            'hibarr_price' => 'nullable|numeric|min:0',
            'commission_agreement_signed' => 'nullable|boolean',

            // New fields: Notes
            'general_notes' => 'nullable|string',

            // Distances (stored in distances JSON column)
            'distances' => 'nullable|array',
            'distances.military_base' => 'nullable|string|max:255',
            'distances.sea' => 'nullable|numeric|min:0',
            'distances.hospital' => 'nullable|numeric|min:0',
            'distances.market' => 'nullable|numeric|min:0',
            'distances.schools' => 'nullable|numeric|min:0',

            // Tax info (stored in legal_info JSON)
            'legal_info' => 'nullable|array',
            'legal_info.tax_info' => 'nullable|array',
            'legal_info.tax_info.vat_paid' => 'nullable|boolean',
            'legal_info.tax_info.vat_not_paid' => 'nullable|boolean',
            'legal_info.tax_info.trafo_fee_paid' => 'nullable|boolean',
            'legal_info.tax_info.stopaj_paid' => 'nullable|boolean',

            // Document uploads (stored in documents_checklist JSON)
            'documents_checklist' => 'nullable|array',
            'documents_checklist.search_document_url' => 'nullable|string',
            'documents_checklist.sales_agreement_url' => 'nullable|string',
            'documents_checklist.title_deed_copy_url' => 'nullable|string',
            'documents_checklist.owner_passport_copy_url' => 'nullable|string',
            'documents_checklist.site_plan_layout_url' => 'nullable|string',

            // Swap fields
            'open_to_swap' => 'nullable|boolean',
            'swap_notes' => 'nullable|string|max:1000',
        ];

        // Add conditional validation based on property type and sale type
        $rules = $this->addConditionalRules($rules);

        return $rules;
    }

    /**
     * Check if the selected developer project has a location.
     * If it does, city/area will be derived from the project location.
     */
    protected function projectHasLocation(): bool
    {
        $projectId = $this->input('developer_project_id');
        
        if (!$projectId) {
            return false;
        }
        
        $project = DeveloperProject::with('location')->find($projectId);
        
        return $project && $project->location !== null;
    }

    /**
     * Add conditional validation rules based on property configuration
     */
    protected function addConditionalRules(array $rules): array
    {
        $propertyType = $this->input('property_type');
        $saleType = $this->input('sale_type');

        if (!$propertyType || !$saleType) {
            return $rules;
        }

        // Get allowed fields for this property type
        $allowedFields = Property::getAllowedFields($propertyType);

        // Make certain fields optional based on property type
        if (in_array('title', $allowedFields)) {
            $rules['title'] = 'nullable|string|max:255';
        }

        if (in_array('description', $allowedFields)) {
            $rules['description'] = 'nullable|string';
        }

        if (in_array('city', $allowedFields)) {
            $rules['city'] = 'nullable|string|max:255';
        }

        if (in_array('price', $allowedFields)) {
            $rules['price'] = 'required|numeric|min:0';
        }

        // For rental properties, require rental-specific fields
        if ($saleType === Property::SALE_TYPE_FOR_RENT || $saleType === Property::SALE_TYPE_DAILY_RENTAL) {
            if (in_array('minimal_rental_period', $allowedFields)) {
                $rules['minimal_rental_period'] = 'required|integer|min:1';
            }
            
            if (in_array('rent_payment_interval', $allowedFields)) {
                $rules['rent_payment_interval'] = 'required|string|in:' . implode(',', [
                    Property::RENT_PAYMENT_MONTHLY,
                    Property::RENT_PAYMENT_QUARTERLY,
                    Property::RENT_PAYMENT_YEARLY
                ]);
            }
        }

        // Validate specific property type values based on category
        if ($propertyType && $saleType) {
            $allowedPropertyTypes = Property::getAllowedPropertyTypes($propertyType, $saleType);
            if (!empty($allowedPropertyTypes)) {
                $rules['specific_property_type'] = [
                    'nullable',
                    'string',
                    Rule::in($allowedPropertyTypes)
                ];
            }
        }

        return $rules;
    }

    /**
     * Get custom attributes for validator errors.
     */
    public function attributes()
    {
        return [
            'property_type' => __('modules.properties.propertyType'),
            'sale_type' => __('modules.properties.saleType'),
            'price' => __('modules.properties.price'),
            'minimal_rental_period' => __('modules.properties.minimalRentalPeriod'),
            'rent_payment_interval' => __('modules.properties.rentPaymentInterval'),
            'title_deed_type' => __('modules.properties.titleDeedType'),
            'title_deed_stage' => __('modules.properties.titleDeedStage'),
            'developer_project_id' => __('modules.properties.developerProject'),
            'city' => __('modules.properties.city'),
            'map' => __('modules.properties.map'),
            'area' => __('modules.properties.area'),
            'land_size' => __('modules.properties.landSize'),
            'living_room' => __('modules.properties.livingRoom'),
            'bedrooms' => __('modules.properties.bedrooms'),
            'bathrooms' => __('modules.properties.bathrooms'),
            'floor_number' => __('modules.properties.floorNumber'),
            'floors_in_building' => __('modules.properties.floorsInBuilding'),
            'building_age' => __('modules.properties.buildingAge'),
            'furniture_status' => __('modules.properties.furnitureStatus'),
            'within_site' => __('modules.properties.withinSite'),
            'exterior_features' => __('modules.properties.exteriorFeatures'),
            'interior_features' => __('modules.properties.interiorFeatures'),
            'location_features' => __('modules.properties.locationFeatures'),
            'title' => __('modules.properties.title'),
            'description' => __('modules.properties.description'),
            'video_url' => __('modules.properties.videoUrl'),
            'tour_360_url' => __('modules.properties.tour360Url'),
            'photos' => __('modules.properties.photos'),
            'add_ons' => __('modules.properties.addOns'),
            'total_area_sqm' => 'Total Area (sqm)',
            'plot_size_sqm' => 'Plot Size (sqm)',
            'floor' => 'Floor',
            'has_restrictions' => 'Has Restrictions',
            'restriction_notes' => 'Restriction Notes',
            'deed_status' => 'Deed Status',
            'price_to_owner' => 'Price to Owner',
            'hibarr_price' => 'HIBARR Price',
            'commission_agreement_signed' => 'Commission Agreement Signed',
            'general_notes' => 'General Notes',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages()
    {
        return [
      
            'property_type.required' => __('validation.required', ['attribute' => __('modules.properties.propertyType')]),
        'sale_type.required' => __('validation.required', ['attribute' => __('modules.properties.saleType')]),
            'price.numeric' => __('validation.numeric', ['attribute' => __('modules.properties.price')]),
            'price.min' => __('validation.min.numeric', ['attribute' => __('modules.properties.price'), 'min' => 0]),
        ];
    }
}