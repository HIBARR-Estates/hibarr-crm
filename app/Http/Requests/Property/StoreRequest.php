<?php

namespace App\Http\Requests\Property;

use App\Http\Requests\CoreRequest;
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
                'required',
                'string',
                Rule::in([
                    Property::SALE_TYPE_FOR_SALE,
                    Property::SALE_TYPE_FOR_RENT,
                    Property::SALE_TYPE_DAILY_RENTAL
                ])
            ],
            'price' => 'nullable|numeric|min:0',
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
                    Property::TITLE_DEED_MUJAHIT
                ])
            ],
            'title_deed_stage' => [
                'nullable',
                'string',
                Rule::in([
                    Property::TITLE_DEED_STAGE_LAND,
                    Property::TITLE_DEED_STAGE_SHARED,
                    Property::TITLE_DEED_STAGE_INDIVIDUAL,
                    Property::TITLE_DEED_STAGE_KAT_IRTIRFAKLI
                ])
            ],
            'status' => [
                'nullable',
                'string',
                Rule::in([
                    Property::STATUS_AVAILABLE,
                    Property::STATUS_UNDER_OFFER,
                    Property::STATUS_SOLD,
                    Property::STATUS_WITHDRAWN
                ])
            ],
            'city' => 'required|string|max:255',
            'map' => 'nullable|string',
            'area' => 'required|string|max:255',
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
                    Property::FURNITURE_PART_FURNISHED,
                    Property::FURNITURE_WHITE_GOODS_ONLY
                ])
            ],
            'within_site' => 'nullable|boolean',
            'exterior_features' => 'nullable|array',
            'interior_features' => 'nullable|array',
            'location_features' => 'nullable|array',
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'video_url' => 'nullable|url',
            'tour_360_url' => 'nullable|url',
            'photos' => 'nullable|array',
            'photos.*' => 'string',
            'add_ons' => 'nullable|array',
            'add_ons.*' => 'string',
        ];

        // Add conditional validation based on property type and sale type
        $rules = $this->addConditionalRules($rules);

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

        // Get allowed fields for this property type
        $allowedFields = Property::getAllowedFields($propertyType);

        // Make certain fields required based on property type
        if (in_array('title', $allowedFields)) {
            $rules['title'] = 'required|string|max:255';
        }

        if (in_array('description', $allowedFields)) {
            $rules['description'] = 'required|string';
        }

        if (in_array('city', $allowedFields)) {
            $rules['city'] = 'required|string|max:255';
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
      
            'property_type.required' => __('validation.required', ['attribute' => __('modules.properties.propertyType')]),
        'sale_type.required' => __('validation.required', ['attribute' => __('modules.properties.saleType')]),
            'price.numeric' => __('validation.numeric', ['attribute' => __('modules.properties.price')]),
            'price.min' => __('validation.min.numeric', ['attribute' => __('modules.properties.price'), 'min' => 0]),
        ];
    }
}