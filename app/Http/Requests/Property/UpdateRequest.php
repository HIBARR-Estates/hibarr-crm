<?php

namespace App\Http\Requests\Property;

use App\Http\Requests\CoreRequest;
use App\Models\DeveloperProject;
use App\Models\Property;
use Illuminate\Validation\Rule;

class UpdateRequest extends CoreRequest
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
        $property = Property::findOrFail($this->route('property'));
        
        $rules = [
            'product_id' => 'sometimes|exists:products,id',
            'property_type' => [
                'sometimes',
                'string',
                Rule::in([
                    Property::PROPERTY_TYPE_VILLA, Property::PROPERTY_TYPE_TWIN_VILLA, Property::PROPERTY_TYPE_APARTMENT,
                    Property::PROPERTY_TYPE_FAMILY_HOME, Property::PROPERTY_TYPE_TOWNHOUSE, Property::PROPERTY_TYPE_LOFT,
                    Property::PROPERTY_TYPE_PENTHOUSE, Property::PROPERTY_TYPE_BUNGALOW, Property::PROPERTY_TYPE_COMMERCIAL_PROPERTY,
                    Property::PROPERTY_TYPE_BLOCK_APARTMENTS, Property::PROPERTY_TYPE_COMPLETE_BUILDING, Property::PROPERTY_TYPE_ABANDONED_BUILDING,
                    Property::PROPERTY_TYPE_RESIDENCE, Property::PROPERTY_TYPE_HALF_CONSTRUCTION, Property::PROPERTY_TYPE_TIME_SHARE,
                    Property::PROPERTY_TYPE_RESIDENTIALLY_ZONED_LAND, Property::PROPERTY_TYPE_FIELD, Property::PROPERTY_TYPE_RESIDENTIAL_COMMERCIAL_LAND,
                    Property::PROPERTY_TYPE_COMMERCIALLY_ZONED_LAND, Property::PROPERTY_TYPE_INDUSTRIALLY_ZONED_LAND, Property::PROPERTY_TYPE_TOURISM_ZONED_LAND,
                    Property::PROPERTY_TYPE_OLIVE_GROVE, Property::PROPERTY_TYPE_SHOP, Property::PROPERTY_TYPE_HOTEL,
                    Property::PROPERTY_TYPE_WORKPLACE, Property::PROPERTY_TYPE_WAREHOUSE, Property::PROPERTY_TYPE_WORKPLACE_FOR_SALE,
                    Property::PROPERTY_TYPE_OFFICE
                ])
            ],
            'sale_type' => [
                'sometimes',
                'string',
                Rule::in([
                    Property::SALE_TYPE_FOR_SALE,
                    Property::SALE_TYPE_FOR_RENT,
                    Property::SALE_TYPE_DAILY_RENTAL
                ])
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
                Rule::in([
                    Property::TITLE_DEED_EXCHANGE,
                    Property::TITLE_DEED_TURKISH,
                    Property::TITLE_DEED_BRITISH,
                    Property::TITLE_DEED_TAHSIS,
                    Property::TITLE_DEED_MUJAHIT,
                    Property::TITLE_DEED_FREEHOLD,
                    Property::TITLE_DEED_LEASEHOLD,
                    Property::TITLE_DEED_EXCHANGE_KAT,
                    Property::TITLE_DEED_FULL_OWNERSHIP,
                    Property::TITLE_DEED_SHARED,
                    Property::TITLE_DEED_FLOOR_EASEMENT,
                    Property::TITLE_DEED_LAND_REGISTRY,
                ])
            ],
            'title_deed_stage' => [
                'nullable',
                'string',
                Rule::in([
                    Property::TITLE_DEED_STAGE_LAND,
                    Property::TITLE_DEED_STAGE_SHARED,
                    Property::TITLE_DEED_STAGE_INDIVIDUAL,
                    Property::TITLE_DEED_STAGE_KAT_IRTIRFAKLI,
                    Property::TITLE_DEED_STAGE_READY,
                    Property::TITLE_DEED_STAGE_IN_PROGRESS,
                    Property::TITLE_DEED_STAGE_PENDING,
                    Property::TITLE_DEED_STAGE_APPLIED,
                    Property::TITLE_DEED_STAGE_UNDER_REVIEW,
                ])
            ],
            'status' => [
                'nullable',
                'string',
                Rule::in([
                    Property::STATUS_AVAILABLE,
                    Property::STATUS_UNDER_OFFER,
                    Property::STATUS_SOLD,
                    Property::STATUS_WITHDRAWN,
                    'Rented',
                    'Reserved',
                    'Let agreed',
                    'Sale agreed',
                ])
            ],
            'developer_project_id' => 'nullable|exists:developer_projects,id',
            'city' => 'nullable|string|max:255',
            'map' => 'nullable|string',
            'area' => 'nullable|string|max:255',
            'land_size' => 'nullable|numeric|min:0',
            'living_room' => 'nullable|string|max:255',
            'bedrooms' => 'nullable|string|max:255',
            'bathrooms' => 'nullable|integer|min:0',
            'floor_number' => 'nullable|integer|min:0',
            'floors_in_building' => 'nullable|integer|min:1',
            'building_age' => 'nullable|integer|min:0',
            'furniture_status' => [
                'nullable',
                'string',
                Rule::in([
                    Property::FURNITURE_UNFURNISHED,
                    Property::FURNITURE_FULLY_FURNISHED,
                    Property::FURNITURE_FURNISHED,
                    Property::FURNITURE_SEMI_FURNISHED,
                    Property::FURNITURE_PART_FURNISHED,
                    Property::FURNITURE_WHITE_GOODS_ONLY
                ])
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
        ];

        // Add conditional validation and status-based restrictions
        $rules = $this->addStatusBasedRules($rules, $property);
        $rules = $this->addConditionalRules($rules);

        return $rules;
    }

    /**
     * Check if the selected developer project has a location.
     * If it does, city/area will be derived from the project location.
     * 
     * For updates, we check:
     * 1. If developer_project_id is being sent, check that project
     * 2. Otherwise, check the property's existing project
     */
    protected function projectHasLocation(Property $property): bool
    {
        // If developer_project_id is explicitly being set in this request
        if ($this->has('developer_project_id')) {
            $projectId = $this->input('developer_project_id');
            
            if (!$projectId) {
                return false;
            }
            
            $project = DeveloperProject::with('location')->find($projectId);
            return $project && $project->location !== null;
        }
        
        // Otherwise, check the property's existing project
        $property->loadMissing('developerProject.location');
        return $property->developerProject && $property->developerProject->location !== null;
    }

    /**
     * Add status-based validation rules
     */
    protected function addStatusBasedRules(array $rules, Property $property): array
    {
        // If property is sold, restrict certain fields
        if ($property->isSold()) {
            // Remove validation for fields that cannot be updated when sold
            unset($rules['price'], $rules['sale_type'], $rules['status']);
            
            // Add forbidden rule for these fields if they're being updated
            if ($this->has('price')) {
                $rules['price'] = 'prohibited';
            }
            if ($this->has('sale_type')) {
                $rules['sale_type'] = 'prohibited';
            }
        }

        // If property is under offer, restrict price and sale type changes
        if ($property->isUnderOffer()) {
            if ($this->has('price')) {
                $rules['price'] = 'prohibited';
            }
            if ($this->has('sale_type')) {
                $rules['sale_type'] = 'prohibited';
            }
        }

        return $rules;
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
     * Configure the validator instance.
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $property = Property::findOrFail($this->route('property'));
            
            // Check each field being updated against the property's current status
            foreach ($this->all() as $field => $value) {
                if (!$property->canUpdateField($field)) {
                    $validator->errors()->add($field, 
                        __('messages.fieldCannotBeUpdatedInCurrentStatus', [
                            'field' => $field,
                            'status' => $property->status
                        ])
                    );
                }
            }
        });
    }

    /**
     * Get custom attributes for validator errors.
     */
    public function attributes()
    {
        return [
            'product_id' => __('modules.properties.product'),
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
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages()
    {
        return [
            'price.prohibited' => __('messages.cannotUpdatePriceWhenSoldOrUnderOffer'),
            'sale_type.prohibited' => __('messages.cannotUpdateSaleTypeWhenSoldOrUnderOffer'),
            'status.prohibited' => __('messages.cannotUpdateStatusWhenSold'),
        ];
    }
}