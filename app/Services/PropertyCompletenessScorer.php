<?php

namespace App\Services;

use App\Models\DeveloperProjectUnitType;
use App\Models\Property;
use Illuminate\Support\Collection;

/**
 * Computes listing-facing field completeness for Properties and unit types.
 *
 * Field expectations mirror the live form rules in:
 * - resources/js/Features/Properties/SaveProperty/fieldConfig.ts
 * - resources/js/Features/Properties/SaveProperty/sections/LegalFinancialSection.tsx
 * - resources/js/Features/DeveloperProjects/UnitTypeFormModal.tsx
 *
 * Do not use Property::getAllowedFields() / getPropertyConfigurations() —
 * those maps are stale.
 */
class PropertyCompletenessScorer
{
    public const FLAG = 'crm.property-completeness-score';

    /**
     * Spec field visibility by primary_category (mirrors SPECIFICATION_FIELDS in fieldConfig.ts).
     * Keys are Property DB column names.
     *
     * @var array<string, array<string, bool>>
     */
    private const SPEC_FIELDS = [
        Property::PRIMARY_CATEGORY_RESIDENTIAL => [
            'bedrooms' => true,
            'bathrooms' => true,
            'living_room' => true,
            'rooms' => false,
            'floor_number' => true,
            'floors_in_building' => true,
            'building_age' => true,
            'gross_sqm' => true,
            'living_area_sqm' => true,
            'land_size' => false,
            'balcony_net_sqm' => true,
            'furniture_status' => true,
            'heating_type' => true,
        ],
        Property::PRIMARY_CATEGORY_COMMERCIAL => [
            'bedrooms' => true,
            'bathrooms' => true,
            'living_room' => false,
            'rooms' => false,
            'floor_number' => true,
            'floors_in_building' => true,
            'building_age' => true,
            'gross_sqm' => true,
            'living_area_sqm' => true,
            'land_size' => false,
            'balcony_net_sqm' => true,
            'furniture_status' => false,
            'heating_type' => false,
        ],
        Property::PRIMARY_CATEGORY_LAND => [
            'bedrooms' => false,
            'bathrooms' => false,
            'living_room' => false,
            'rooms' => false,
            'floor_number' => false,
            'floors_in_building' => false,
            'building_age' => false,
            'gross_sqm' => false,
            'living_area_sqm' => false,
            'land_size' => true,
            'balcony_net_sqm' => false,
            'furniture_status' => false,
            'heating_type' => false,
        ],
    ];

    /**
     * @return array{filled: int, total: int, percent: int}
     */
    public function scoreProperty(Property $property): array
    {
        $category = (string) ($property->primary_category ?? '');

        if ($category === '' || $category === 'construction_project' || ! isset(self::SPEC_FIELDS[$category])) {
            return $this->emptyScore();
        }

        $keys = $this->expectedPropertyKeys($category, (string) ($property->sale_type ?? ''));

        $filled = 0;
        foreach ($keys as $key) {
            if ($this->isPropertyFieldFilled($property, $key)) {
                $filled++;
            }
        }

        return $this->toScore($filled, count($keys));
    }

    /**
     * @return array{filled: int, total: int, percent: int}
     */
    public function scoreUnitType(DeveloperProjectUnitType $unitType): array
    {
        $category = (string) ($unitType->primary_category ?? '');

        if ($category !== DeveloperProjectUnitType::CATEGORY_RESIDENTIAL
            && $category !== DeveloperProjectUnitType::CATEGORY_COMMERCIAL) {
            return $this->emptyScore();
        }

        $keys = $this->expectedUnitTypeKeys($category);

        $filled = 0;
        foreach ($keys as $key) {
            if ($this->isUnitTypeFieldFilled($unitType, $key)) {
                $filled++;
            }
        }

        return $this->toScore($filled, count($keys));
    }

    /**
     * @return list<string>
     */
    public function expectedPropertyKeys(string $category, string $saleType): array
    {
        if (! isset(self::SPEC_FIELDS[$category])) {
            return [];
        }

        $keys = [
            'property_type',
            'status',
            'sale_type',
            'price',
            'city',
            'area',
            'address',
            'map',
            'title_deed_type',
            'title_deed_stage',
            'description',
            'video_url',
            'tour_360_url',
            'photos',
        ];

        if ($category === Property::PRIMARY_CATEGORY_RESIDENTIAL) {
            $keys[] = 'unit_style';
        }

        foreach (self::SPEC_FIELDS[$category] as $field => $enabled) {
            if ($enabled) {
                $keys[] = $field;
            }
        }

        // Classification section is off for land.
        if ($category !== Property::PRIMARY_CATEGORY_LAND) {
            $keys[] = 'construction_status';
            $keys[] = 'completion_date';
            $keys[] = 'view_types';
            $keys[] = 'current_occupancy';
        }

        // Features section is off for land.
        if ($category !== Property::PRIMARY_CATEGORY_LAND) {
            $keys[] = 'interior_features';
            $keys[] = 'exterior_features';
            $keys[] = 'location_features';
            $keys[] = 'add_ons';
        }

        if ($this->isRentalSaleType($saleType)) {
            $keys[] = 'minimal_rental_period';
            $keys[] = 'rent_payment_interval';
        }

        return $keys;
    }

    /**
     * @return list<string>
     */
    public function expectedUnitTypeKeys(string $category): array
    {
        $keys = [
            'property_type',
            'primary_category',
            'starting_price',
            'currency',
            'view_types',
            'furniture_status',
            'bathrooms',
            'floor',
            'floors_in_building',
            'total_area_sqm',
            'living_area_sqm',
            'terrace_balcony_sqm',
            'plot_size_sqm',
            'completion_date',
            'outside_features',
            'inside_features',
            'description',
            'photos',
        ];

        if ($category === DeveloperProjectUnitType::CATEGORY_RESIDENTIAL) {
            $keys[] = 'unit_style';
            $keys[] = 'bedrooms';
        }

        return $keys;
    }

    public function isFilled(mixed $value): bool
    {
        if ($value === null) {
            return false;
        }

        if (is_bool($value)) {
            return $value === true;
        }

        if (is_int($value) || is_float($value)) {
            return true;
        }

        if (is_string($value)) {
            return trim($value) !== '';
        }

        if ($value instanceof Collection) {
            return $value->isNotEmpty();
        }

        if (is_array($value)) {
            return count($value) > 0;
        }

        if (is_object($value)) {
            // PriceCast / money-like objects
            if (isset($value->amount)) {
                $amount = $value->amount;

                return $amount !== null && $amount !== '' && (is_numeric($amount) ? true : trim((string) $amount) !== '');
            }

            return true;
        }

        return (bool) $value;
    }

    private function isPropertyFieldFilled(Property $property, string $key): bool
    {
        return match ($key) {
            'photos' => $this->hasPhotos(
                $property->relationLoaded('assets') ? $property->assets : null,
                $property->photos
            ),
            'map' => $this->isFilled($property->map)
                || ($this->isFilled($property->latitude) && $this->isFilled($property->longitude)),
            'price' => $this->isPriceFilled($property->price),
            'unit_style',
            'view_types',
            'interior_features',
            'exterior_features',
            'location_features',
            'add_ons' => $this->isFilled($property->{$key} ?? null),
            default => $this->isFilled($property->{$key} ?? null),
        };
    }

    private function isUnitTypeFieldFilled(DeveloperProjectUnitType $unitType, string $key): bool
    {
        return match ($key) {
            'photos' => $this->hasPhotos(
                $unitType->relationLoaded('assets') ? $unitType->assets : null,
                null
            ),
            'unit_style',
            'view_types',
            'outside_features',
            'inside_features' => $this->isFilled($unitType->{$key} ?? null),
            'starting_price' => $this->isFilled($unitType->starting_price)
                && (float) $unitType->starting_price >= 0
                && $unitType->starting_price !== null,
            default => $this->isFilled($unitType->{$key} ?? null),
        };
    }

    private function isPriceFilled(mixed $price): bool
    {
        if ($price === null || $price === '') {
            return false;
        }

        if (is_array($price)) {
            $amount = $price['amount'] ?? null;

            return $amount !== null && $amount !== '' && is_numeric($amount);
        }

        if (is_object($price) && isset($price->amount)) {
            $amount = $price->amount;

            return $amount !== null && $amount !== '' && is_numeric($amount);
        }

        if (is_numeric($price)) {
            return true;
        }

        if (is_string($price)) {
            $decoded = json_decode($price, true);
            if (is_array($decoded)) {
                return $this->isPriceFilled($decoded);
            }

            return trim($price) !== '';
        }

        return $this->isFilled($price);
    }

    private function hasPhotos(mixed $assets, mixed $photos): bool
    {
        if ($assets instanceof Collection && $assets->isNotEmpty()) {
            return true;
        }

        if (is_array($assets) && count($assets) > 0) {
            return true;
        }

        return $this->isFilled($photos);
    }

    private function isRentalSaleType(string $saleType): bool
    {
        return $saleType === Property::SALE_TYPE_FOR_RENT
            || $saleType === Property::SALE_TYPE_DAILY_RENTAL
            || str_contains($saleType, 'Rent');
    }

    /**
     * @return array{filled: int, total: int, percent: int}
     */
    private function toScore(int $filled, int $total): array
    {
        $percent = $total > 0 ? (int) round(($filled / $total) * 100) : 0;

        return [
            'filled' => $filled,
            'total' => $total,
            'percent' => $percent,
        ];
    }

    /**
     * @return array{filled: int, total: int, percent: int}
     */
    private function emptyScore(): array
    {
        return ['filled' => 0, 'total' => 0, 'percent' => 0];
    }
}
