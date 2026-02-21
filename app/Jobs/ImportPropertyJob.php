<?php

namespace App\Jobs;

use App\Models\Property;
use App\Models\Product;
use App\Models\Company;
use App\Traits\ExcelImportable;
use App\Traits\UniversalSearchTrait;
use App\Exceptions\DuplicatePropertyException;
use App\Services\PropertyDuplicateService;
use Exception;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Log;

class ImportPropertyJob implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels, UniversalSearchTrait;
    use ExcelImportable;

    public $timeout = 300;
    public $tries = 3;

    private $row;
    private $columns;
    private $company;
    private $userId;

    // ── Allowed enum values for validation (lowercase keys for case-insensitive matching) ──

    /**
     * Build a lookup map: lowercase value → original value for a list of allowed strings.
     */
    private static function buildLookup(array $values): array
    {
        $map = [];
        foreach ($values as $v) {
            $map[strtolower($v)] = $v;
        }
        return $map;
    }

    /** Property types from TYPE_CODES keys (the canonical display values). */
    private static function allowedPropertyTypes(): array
    {
        return self::buildLookup(array_keys(Property::TYPE_CODES));
    }

    private static function allowedSaleTypes(): array
    {
        return self::buildLookup([
            Property::SALE_TYPE_FOR_SALE,
            Property::SALE_TYPE_FOR_RENT,
            Property::SALE_TYPE_DAILY_RENTAL,
        ]);
    }

    private static function allowedStatuses(): array
    {
        return self::buildLookup([
            Property::STATUS_AVAILABLE,
            Property::STATUS_UNDER_OFFER,
            Property::STATUS_SOLD,
            Property::STATUS_WITHDRAWN,
            Property::STATUS_RESERVED,
            Property::STATUS_RENTED,
        ]);
    }

    private static function allowedPrimaryCategories(): array
    {
        return self::buildLookup(Property::PRIMARY_CATEGORIES);
    }

    private static function allowedConstructionStatuses(): array
    {
        return self::buildLookup(Property::CONSTRUCTION_STATUSES);
    }

    private static function allowedFurnitureStatuses(): array
    {
        return self::buildLookup([
            Property::FURNITURE_UNFURNISHED,
            Property::FURNITURE_FULLY_FURNISHED,
            Property::FURNITURE_FURNISHED,
            Property::FURNITURE_SEMI_FURNISHED,
            Property::FURNITURE_PART_FURNISHED,
            Property::FURNITURE_WHITE_GOODS_ONLY,
        ]);
    }

    private static function allowedDeedTypes(): array
    {
        return self::buildLookup(Property::DEED_TYPES);
    }

    private static function allowedDeedStatuses(): array
    {
        return self::buildLookup(Property::DEED_STATUSES);
    }

    private static function allowedOccupancyTypes(): array
    {
        return self::buildLookup(Property::OCCUPANCY_TYPES);
    }

    private static function allowedViewTypes(): array
    {
        return self::buildLookup(Property::VIEW_TYPES);
    }

    private static function allowedUnitStyles(): array
    {
        return self::buildLookup(Property::UNIT_STYLES);
    }

    private static function allowedCurrencies(): array
    {
        return self::buildLookup(['GBP', 'USD', 'EUR', 'TRY']);
    }

    public function __construct($row, $columns, $company = null, $userId = null)
    {
        $this->row = $row;
        $this->columns = $columns;
        $this->company = $company;
        $this->userId = $userId;
    }

    // =========================================================================
    // Validation
    // =========================================================================

    /**
     * Validate a single enum value against an allowed-values map.
     * Returns the canonical value on match, or null if invalid.
     */
    private function validateEnum(?string $raw, array $lookup): ?string
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }
        $key = strtolower(trim($raw));
        return $lookup[$key] ?? null;
    }

    /**
     * Parse a pipe-delimited multi-value string (e.g. "sea_view|mountain_view")
     * and validate each item against an allowed-values map.
     * Returns only the valid items as an array.
     */
    private function validateMultiEnum(?string $raw, array $lookup): array
    {
        if ($raw === null || trim($raw) === '') {
            return [];
        }
        $result = [];
        foreach (explode('|', $raw) as $item) {
            $key = strtolower(trim($item));
            if (isset($lookup[$key])) {
                $result[] = $lookup[$key];
            }
        }
        return $result;
    }

    /**
     * Parse a boolean-like CSV value (1/0/true/false/yes/no).
     */
    private function parseBool($value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }
        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes'], true);
    }

    /**
     * Validate the row data. Returns an array of error messages (empty = valid).
     */
    private function validateRow(): array
    {
        $errors = [];

        // Required: title
        $title = $this->isColumnExists('title') ? $this->getColumnValue('title') : null;
        if (empty($title)) {
            $errors[] = 'title is required';
        }

        // Validate enum fields that have values
        $enumChecks = [
            'property_type'       => self::allowedPropertyTypes(),
            'sale_type'           => self::allowedSaleTypes(),
            'status'              => self::allowedStatuses(),
            'primary_category'    => self::allowedPrimaryCategories(),
            'construction_status' => self::allowedConstructionStatuses(),
            'furniture_status'    => self::allowedFurnitureStatuses(),
            'title_deed_type'     => self::allowedDeedTypes(),
            'deed_status'         => self::allowedDeedStatuses(),
            'current_occupancy'   => self::allowedOccupancyTypes(),
            'currency'            => self::allowedCurrencies(),
        ];

        foreach ($enumChecks as $field => $lookup) {
            if (!$this->isColumnExists($field)) {
                continue;
            }
            $raw = $this->getColumnValue($field);
            if ($raw !== null && trim((string) $raw) !== '') {
                if ($this->validateEnum((string) $raw, $lookup) === null) {
                    $errors[] = "{$field} has invalid value: \"{$raw}\"";
                }
            }
        }

        // Validate numeric fields
        $numericFields = [
            'price', 'bedrooms', 'bathrooms', 'land_size', 'building_age',
            'floor_number', 'floors_in_building', 'living_area_sqm', 'gross_sqm',
            'total_area_sqm', 'plot_size_sqm', 'terrace_area_sqm',
            'living_room', 'rooms', 'balcony_count',
        ];

        foreach ($numericFields as $field) {
            if (!$this->isColumnExists($field)) {
                continue;
            }
            $raw = $this->getColumnValue($field);
            if ($raw !== null && trim((string) $raw) !== '') {
                // Strip commas (thousand separators) before checking
                $cleaned = str_replace(',', '', trim((string) $raw));
                if (!is_numeric($cleaned)) {
                    $errors[] = "{$field} must be numeric, got: \"{$raw}\"";
                }
            }
        }

        // Validate completion_date format
        if ($this->isColumnExists('completion_date')) {
            $raw = $this->getColumnValue('completion_date');
            if ($raw !== null && trim((string) $raw) !== '') {
                try {
                    Carbon::parse($raw);
                } catch (\Exception $e) {
                    $errors[] = "completion_date has invalid format: \"{$raw}\"";
                }
            }
        }

        return $errors;
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Get a column value as a cleaned numeric, or null.
     */
    private function getNumericValue(string $column): ?float
    {
        if (!$this->isColumnExists($column)) {
            return null;
        }
        $raw = $this->getColumnValue($column);
        if ($raw === null || trim((string) $raw) === '') {
            return null;
        }
        $cleaned = str_replace(',', '', trim((string) $raw));
        return is_numeric($cleaned) ? (float) $cleaned : null;
    }

    /**
     * Get a column value as a trimmed string, or null.
     */
    private function getStringValue(string $column): ?string
    {
        if (!$this->isColumnExists($column)) {
            return null;
        }
        $raw = $this->getColumnValue($column);
        if ($raw === null || trim((string) $raw) === '') {
            return null;
        }
        return trim((string) $raw);
    }

    // =========================================================================
    // Main handler
    // =========================================================================

    public function handle()
    {
        $propertyCount = Session::get('total_properties', 0);
        $propertyCount++;
        Session::put('total_properties', $propertyCount);

        Log::info('Importing property row: ', [
            'row' => $this->row,
            'columns' => $this->columns,
            'company' => $this->company ? $this->company->id : null,
        ]);

        if (!$this->isColumnExists('title')) {
            Log::warning('Invalid property data: title column is missing', ['row_data' => $this->row]);
            $this->failJob(__('messages.invalidData'));
            return;
        }

        // Skip empty rows
        if (empty(array_filter($this->row))) {
            Log::info('Skipping empty row during property import.', ['row_data' => $this->row]);
            return;
        }

        // ── Validate row ──
        $validationErrors = $this->validateRow();
        if (!empty($validationErrors)) {
            $msg = 'Row skipped — validation errors: ' . implode('; ', $validationErrors);
            Log::warning($msg, ['row_data' => $this->row]);
            $this->failJobWithMessage($msg);
            return;
        }

        DB::beginTransaction();
        Session::put('is_imported', true);

        try {
            // ── Resolve validated enum values ──
            $propertyType   = $this->validateEnum($this->getStringValue('property_type'), self::allowedPropertyTypes()) ?? 'House';
            $saleType       = $this->validateEnum($this->getStringValue('sale_type'), self::allowedSaleTypes()) ?? Property::SALE_TYPE_FOR_SALE;
            $status         = $this->validateEnum($this->getStringValue('status'), self::allowedStatuses()) ?? Property::STATUS_AVAILABLE;
            $primaryCategory    = $this->validateEnum($this->getStringValue('primary_category'), self::allowedPrimaryCategories());
            $constructionStatus = $this->validateEnum($this->getStringValue('construction_status'), self::allowedConstructionStatuses());
            $furnitureStatus    = $this->validateEnum($this->getStringValue('furniture_status'), self::allowedFurnitureStatuses());
            $titleDeedType      = $this->validateEnum($this->getStringValue('title_deed_type'), self::allowedDeedTypes());
            $deedStatus         = $this->validateEnum($this->getStringValue('deed_status'), self::allowedDeedStatuses());
            $currentOccupancy   = $this->validateEnum($this->getStringValue('current_occupancy'), self::allowedOccupancyTypes());
            $currency           = $this->validateEnum($this->getStringValue('currency'), self::allowedCurrencies()) ?? 'GBP';

            // Multi-value fields (pipe-delimited)
            $unitStyle = $this->validateMultiEnum($this->getStringValue('unit_style'), self::allowedUnitStyles());
            $viewTypes = $this->validateMultiEnum($this->getStringValue('view_types'), self::allowedViewTypes());

            // ── Duplicate check ──
            $duplicateService = app(PropertyDuplicateService::class);
            $propertyData = [
                'company_id'           => $this->company?->id,
                'developer_project_id' => null,
                'property_type'        => $propertyType,
                'primary_category'     => $primaryCategory,
                'unit_style'           => !empty($unitStyle) ? $unitStyle : null,
                'city'                 => $this->getStringValue('city'),
                'area'                 => $this->getStringValue('area'),
                'block_name'           => $this->getStringValue('block_name'),
                'unit_number'          => $this->getStringValue('unit_number'),
            ];

            try {
                $duplicateService->assertNoDuplicates($propertyData);
            } catch (DuplicatePropertyException $e) {
                Log::warning('Duplicate property detected during import: ' . $e->getMessage(), ['row_data' => $this->row]);
                $this->failJobWithMessage('Duplicate: ' . $e->getMessage());
                return;
            }

            // ── Create product ──
            $price = $this->getNumericValue('price') ?? 0;

            $product = Product::create([
                'name'           => $this->getColumnValue('title'),
                'price'          => $price,
                'description'    => $this->getStringValue('description') ?? '',
                'allow_purchase' => $status === Property::STATUS_AVAILABLE ? 1 : 0,
                'company_id'     => $this->company?->id,
                'added_by'       => $this->userId,
                'unit_id'        => 1,
            ]);

            Log::info('Created product for property import: ', ['product_id' => $product->id, 'title' => $product->name]);

            // ── Create property ──
            $property = new Property();
            $property->company_id   = $this->company?->id;
            $property->product_id   = $product->id;
            $property->added_by     = $this->userId;
            $property->responsible_agent_id = $this->userId;

            // Core fields
            $property->title         = $this->getColumnValue('title');
            $property->property_type = $propertyType;
            $property->sale_type     = $saleType;
            $property->price         = $price;
            $property->status        = $status;
            $property->city          = $this->getStringValue('city');
            $property->area          = $this->getStringValue('area');
            $property->description   = $this->getStringValue('description') ?? '';

            // Classification
            if ($primaryCategory !== null) {
                $property->primary_category = $primaryCategory;
            }
            if (!empty($unitStyle)) {
                $property->unit_style = $unitStyle;
            }
            if ($constructionStatus !== null) {
                $property->construction_status = $constructionStatus;
            }
            if (!empty($viewTypes)) {
                $property->view_types = $viewTypes;
            }
            if ($currentOccupancy !== null) {
                $property->current_occupancy = $currentOccupancy;
            }

            // Property details
            if ($furnitureStatus !== null) {
                $property->furniture_status = $furnitureStatus;
            }
            if ($titleDeedType !== null) {
                $property->title_deed_type = $titleDeedType;
            }
            if ($deedStatus !== null) {
                $property->deed_status = $deedStatus;
            }
            $property->heating_type = $this->getStringValue('heating_type');

            // Completion date
            if ($this->isColumnExists('completion_date') && $this->getStringValue('completion_date')) {
                try {
                    $property->completion_date = Carbon::parse($this->getStringValue('completion_date'))->format('Y-m-d');
                } catch (\Exception $e) {
                    // Skipped — already validated but belt-and-suspenders
                }
            }

            // Numeric / dimension fields
            $numericMappings = [
                'bedrooms'           => 'bedrooms',
                'bathrooms'          => 'bathrooms',
                'land_size'          => 'land_size',
                'building_age'       => 'building_age',
                'floor_number'       => 'floor_number',
                'floors_in_building' => 'floors_in_building',
                'living_area_sqm'    => 'living_area_sqm',
                'gross_sqm'          => 'gross_sqm',
                'total_area_sqm'     => 'total_area_sqm',
                'plot_size_sqm'      => 'plot_size_sqm',
                'terrace_area_sqm'   => 'terrace_area_sqm',
                'living_room'        => 'living_room',
                'rooms'              => 'rooms',
                'balcony_count'      => 'balcony_count',
            ];

            foreach ($numericMappings as $csvField => $modelField) {
                $val = $this->getNumericValue($csvField);
                if ($val !== null) {
                    $property->{$modelField} = $val;
                }
            }

            // String fields
            $property->block_name  = $this->getStringValue('block_name');
            $property->unit_number = $this->getStringValue('unit_number');
            $property->address     = $this->getStringValue('address');
            $property->general_notes = $this->getStringValue('general_notes');

            // Boolean
            if ($this->isColumnExists('within_site')) {
                $property->within_site = $this->parseBool($this->getColumnValue('within_site'));
            } else {
                $property->within_site = false;
            }

            // Default arrays
            $property->exterior_features = [];
            $property->interior_features = [];
            $property->location_features = [];
            $property->photos  = [];
            $property->add_ons = [];

            $property->created_at = $this->isColumnExists('created_at')
                ? Carbon::parse($this->getColumnValue('created_at'))
                : now();

            Log::info('Importing property: before save ...', ['property' => $property->toArray()]);

            $property->save();

            Log::info('Imported property ID: ' . $property->id);

            // Track imported properties in session
            $properties = Session::get('properties', []);
            $properties[] = [
                'property_title' => $property->title,
                'property_type'  => $property->property_type,
                'price'          => $property->price,
            ];
            Session::put('properties', $properties);

            // Log search entries
            $this->logSearchEntry($property->id, $property->title, 'property', 'property', $property->company_id);

            if (!is_null($property->area)) {
                $this->logSearchEntry($property->id, $property->area, 'property', 'property', $property->company_id);
            }

            if (!is_null($property->city)) {
                $this->logSearchEntry($property->id, $property->city, 'property', 'property', $property->company_id);
            }

            Log::info('Completed property import: ', ['property_id' => $property->id, 'title' => $property->title]);

            DB::commit();

        } catch (Exception $e) {
            Log::error('Error importing property: ' . $e->getMessage(), ['row_data' => $this->row]);
            DB::rollBack();
            $this->failJobWithMessage($e->getMessage());
        }
    }
}