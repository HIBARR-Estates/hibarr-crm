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

    public function __construct($row, $columns, $company = null, $userId = null)
    {
        $this->row = $row;
        $this->columns = $columns;
        $this->company = $company;
        $this->userId = $userId;
    }

    public function handle()
    {
        $propertyCount = Session::get('total_properties', 0);
        $propertyCount++;
        Session::put('total_properties', $propertyCount);
        // log row, columns, and company
        Log::info('Importing property row: ', ['row' => $this->row, 'columns' => $this->columns, 'company' => $this->company ? $this->company->id : null]);

        if ($this->isColumnExists('title')) {

            // Ensure that empty rows are skipped
            if (empty(array_filter($this->row))) {
                Log::info('Skipping empty row during property import.', ['row_data' => $this->row]);
                return;
            }

            DB::beginTransaction();
            Session::put('is_imported', true);
            
            try {
                // Check for duplicates before creating
                $duplicateService = app(PropertyDuplicateService::class);
                $propertyData = [
                    'company_id' => $this->company?->id,
                    'developer_project_id' => null, // Import doesn't assign to projects by default
                    'property_type' => $this->isColumnExists('property_type') ? $this->getColumnValue('property_type') : 'House',
                    'city' => $this->isColumnExists('city') ? $this->getColumnValue('city') : null,
                    'area' => $this->isColumnExists('area') ? $this->getColumnValue('area') : null,
                    'block_name' => $this->isColumnExists('block_name') ? $this->getColumnValue('block_name') : null,
                    'unit_number' => $this->isColumnExists('unit_number') ? $this->getColumnValue('unit_number') : null,
                ];

                try {
                    $duplicateService->assertNoDuplicates($propertyData);
                } catch (DuplicatePropertyException $e) {
                    Log::warning('Duplicate property detected during import: ' . $e->getMessage(), ['row_data' => $this->row]);
                    $this->failJobWithMessage('Duplicate: ' . $e->getMessage());
                    return;
                }

                // TODO: First consolidate the data and then validate it before proceeding ...
                // Create product first
                $product = Product::create([
                    'name' => $this->getColumnValue('title'),
                    'price' => $this->isColumnExists('price') ? $this->getColumnValue('price') : 0,
                    'description' => $this->isColumnExists('description') ? $this->getColumnValue('description') : '',
                    'allow_purchase' => $this->isColumnExists('status') && $this->getColumnValue('status') == Property::STATUS_AVAILABLE ? 1 : 0,
                    'company_id' => $this->company?->id,
                    'added_by' => $this->userId,
                    'unit_id' => 1
                ]);

                Log::info('Created product for property import: ', ['product_id' => $product->id, 'title' => $product->name]);

                // Create property
                $property = new Property();
                $property->company_id = $this->company?->id;
                $property->product_id = $product->id;
                $property->title = $this->getColumnValue('title');
                $property->property_type = $this->isColumnExists('property_type') ? $this->getColumnValue('property_type') : 'House';
                $property->sale_type = $this->isColumnExists('sale_type') ? $this->getColumnValue('sale_type') : 'For Sale';
                $property->price = $this->isColumnExists('price') ? $this->getColumnValue('price') : 0;
                $property->status = ($this->isColumnExists('status') && $this->getColumnValue('status')) ? $this->getColumnValue('status') : Property::STATUS_AVAILABLE;
                $property->city = $this->isColumnExists('city') ? $this->getColumnValue('city') : null;
                $property->area = $this->isColumnExists('area') ? $this->getColumnValue('area') : null;
                $property->description = ($this->isColumnExists('description') && $this->getColumnValue('description')) ? $this->getColumnValue('description') : '';
                
                // Optional fields
                if ($this->isColumnExists('bedrooms')) {
                    $property->bedrooms = $this->getColumnValue('bedrooms');
                }
                if ($this->isColumnExists('bathrooms')) {
                    $property->bathrooms = $this->getColumnValue('bathrooms');
                }
                if ($this->isColumnExists('land_size')) {
                    $property->land_size = $this->getColumnValue('land_size');
                }
                if ($this->isColumnExists('building_age')) {
                    $property->building_age = $this->getColumnValue('building_age');
                }
                if ($this->isColumnExists('floor_number')) {
                    $property->floor_number = $this->getColumnValue('floor_number');
                }
                if ($this->isColumnExists('floors_in_building')) {
                    $property->floors_in_building = $this->getColumnValue('floors_in_building');
                }
                if ($this->isColumnExists('block_name')) {
                    $property->block_name = $this->getColumnValue('block_name');
                }
                if ($this->isColumnExists('unit_number')) {
                    $property->unit_number = $this->getColumnValue('unit_number');
                }

                // Set default values for required fields
                $property->exterior_features = [];
                $property->interior_features = [];
                $property->location_features = [];
                $property->photos = [];
                $property->add_ons = [];
                $property->within_site = false;
                $property->created_at = $this->isColumnExists('created_at') ? Carbon::parse($this->getColumnValue('created_at')) : now();

                Log::info('Importing property: at least before save ...', ['property' => $property->toArray()]);

                $property->save();

                Log::info('Imported property ID: at least saved ...' . $property->id);

                // Track imported properties in session
                $properties = Session::get('properties', []);
                $properties[] = [
                    'property_title' => $property->title,
                    'property_type' => $property->property_type,
                    'price' => $property->price,
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
        } else {
            Log::warning('Invalid property data: title column is missing', ['row_data' => $this->row]);
            $this->failJob(__('messages.invalidData'));
        }
    }

    // public function failed(\Throwable $exception)
    // {
    //     Log::error('Property import job failed permanently', [
    //         'error' => $exception?->getMessage(),
    //         'row_data' => $this->row
    //     ]);
    // }
}