<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToArray;

class AgentImport implements ToArray
{

    protected array $processedData = [];

    public static function fields(): array
    {
        return array(
            array('id' => 'name', 'name' => __('app.name'), 'required' => 'Yes'),
            array('id' => 'email', 'name' => __('app.email'), 'required' => 'No'),
            array('id' => 'mobile', 'name' => __('app.mobile'), 'required' => 'No'),
            array('id' => 'category', 'name' => __('app.category'), 'required' => 'No'),
            array('id' => 'status', 'name' => __('app.status'), 'required' => 'No'),
        );
    }

    public function array(array $array): array
    {
        $this->processedData = $array;
        return $array;
    }

    public function getProcessedData(): array
    {
        return $this->processedData;
    }

}
