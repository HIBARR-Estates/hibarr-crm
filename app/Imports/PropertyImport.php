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
     */
    public static function fields(): array
    {
        return array(
            array('id' => 'title', 'name' => __('modules.property.propertyTitle'), 'required' => 'Yes'),
            array('id' => 'property_type', 'name' => __('modules.property.propertyType'), 'required' => 'Yes'),
            array('id' => 'sale_type', 'name' => __('modules.property.saleType'), 'required' => 'Yes'),
            array('id' => 'price', 'name' => __('modules.property.price'), 'required' => 'No'),
            array('id' => 'city', 'name' => __('modules.property.city'), 'required' => 'Yes'),
            array('id' => 'area', 'name' => __('modules.property.area'), 'required' => 'Yes'),
            array('id' => 'description', 'name' => __('modules.property.description'), 'required' => 'No'),
            array('id' => 'status', 'name' => __('modules.property.status'), 'required' => 'No'),
            array('id' => 'bedrooms', 'name' => __('modules.property.bedrooms'), 'required' => 'No'),
            array('id' => 'bathrooms', 'name' => __('modules.property.bathrooms'), 'required' => 'No'),
            array('id' => 'land_size', 'name' => __('modules.property.landSize'), 'required' => 'No'),
            array('id' => 'building_age', 'name' => __('modules.property.buildingAge'), 'required' => 'No'),
            array('id' => 'floor_number', 'name' => __('modules.property.floorNumber'), 'required' => 'No'),
            array('id' => 'floors_in_building', 'name' => __('modules.property.floorsInBuilding'), 'required' => 'No'),
        );
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