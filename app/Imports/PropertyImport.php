<?php

namespace App\Imports;

use App\Models\Property;
use App\Models\Product;
use Maatwebsite\Excel\Concerns\ToArray;

class PropertyImport implements  ToArray
{
    private $processedData = [];

     /**
     * Define the expected fields for import.
     *
     * Field IDs must match the CSV/Excel column headers (case-insensitive).
     * The controller uses header-based auto-detection when a heading row is present.
     */
    public static function fields(): array
    {
        return [
            // ── Required fields ──
            ['id' => 'title',            'name' => 'Property Title',              'required' => 'Yes'],
            ['id' => 'property_type',    'name' => 'Property Type',               'required' => 'Yes'],
            ['id' => 'sale_type',        'name' => 'Sale Type',                   'required' => 'Yes'],
            ['id' => 'city',             'name' => 'City',                        'required' => 'Yes'],
            ['id' => 'area',             'name' => 'Area',                        'required' => 'Yes'],

            // ── Core optional fields (original) ──
            ['id' => 'price',                'name' => 'Price',                   'required' => 'No'],
            ['id' => 'currency',             'name' => 'Currency',                'required' => 'No'],
            ['id' => 'description',          'name' => 'Description',             'required' => 'No'],
            ['id' => 'status',               'name' => 'Status',                  'required' => 'No'],
            ['id' => 'bedrooms',             'name' => 'Bedrooms',                'required' => 'No'],
            ['id' => 'bathrooms',            'name' => 'Bathrooms',               'required' => 'No'],
            ['id' => 'land_size',            'name' => 'Land Size',               'required' => 'No'],
            ['id' => 'building_age',         'name' => 'Building Age',            'required' => 'No'],
            ['id' => 'floor_number',         'name' => 'Floor Number',            'required' => 'No'],
            ['id' => 'floors_in_building',   'name' => 'Floors in Building',      'required' => 'No'],
            ['id' => 'block_name',           'name' => 'Block Name',              'required' => 'No'],
            ['id' => 'unit_number',          'name' => 'Unit Number',             'required' => 'No'],

            // ── New classification fields ──
            ['id' => 'primary_category',     'name' => 'Primary Category',        'required' => 'No'],
            ['id' => 'unit_style',           'name' => 'Unit Style',              'required' => 'No'],
            ['id' => 'construction_status',  'name' => 'Construction Status',     'required' => 'No'],
            ['id' => 'view_types',           'name' => 'View Types',              'required' => 'No'],
            ['id' => 'current_occupancy',    'name' => 'Current Occupancy',       'required' => 'No'],

            // ── Property details ──
            ['id' => 'furniture_status',     'name' => 'Furniture Status',        'required' => 'No'],
            ['id' => 'title_deed_type',      'name' => 'Title Deed Type',         'required' => 'No'],
            ['id' => 'deed_status',          'name' => 'Deed Status',             'required' => 'No'],
            ['id' => 'heating_type',         'name' => 'Heating Type',            'required' => 'No'],
            ['id' => 'completion_date',      'name' => 'Completion Date',         'required' => 'No'],

            // ── Area / dimension fields ──
            ['id' => 'living_area_sqm',      'name' => 'Living Area (sqm)',       'required' => 'No'],
            ['id' => 'gross_sqm',            'name' => 'Gross Area (sqm)',        'required' => 'No'],
            ['id' => 'total_area_sqm',       'name' => 'Total Area (sqm)',        'required' => 'No'],
            ['id' => 'plot_size_sqm',        'name' => 'Plot Size (sqm)',         'required' => 'No'],
            ['id' => 'terrace_area_sqm',     'name' => 'Terrace Area (sqm)',      'required' => 'No'],
            ['id' => 'living_room',          'name' => 'Living Rooms',            'required' => 'No'],
            ['id' => 'rooms',                'name' => 'Rooms',                   'required' => 'No'],
            ['id' => 'balcony_count',        'name' => 'Balcony Count',           'required' => 'No'],

            // ── Location / notes ──
            ['id' => 'address',              'name' => 'Address',                 'required' => 'No'],
            ['id' => 'within_site',          'name' => 'Within Site',             'required' => 'No'],
            ['id' => 'general_notes',        'name' => 'General Notes',           'required' => 'No'],
        ];
    }

    /**
     * Return a map of field IDs for quick lookup.
     */
    public static function fieldIds(): array
    {
        return array_column(static::fields(), 'id');
    }

    /**
     * Handle the imported array data.
     *
     * @param array $array
     * @return array
     */
    public function array(array $array): array
    {
        $this->processedData = $array;
        return $array;
    }

    public function getProcessedData()
    {
        return $this->processedData;
    }



    
}