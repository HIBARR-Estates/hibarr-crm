<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToArray;

class DealImport implements ToArray
{
    protected array $processedData = [];

    public static function fields(): array
    {
        $fields = array(
            array('id' => 'deal_name', 'name' => 'Deal Name', 'required' => 'No', 'db_field' => 'name'),
            array('id' => 'lead_contact_email', 'name' => 'Lead Contact Email', 'required' => 'No', 'db_field' => 'email'),
            array('id' => 'pipeline', 'name' => 'Pipeline', 'required' => 'No', 'db_field' => 'pipeline'),
            array('id' => 'deal_value', 'name' => 'Deal Value', 'required' => 'No', 'db_field' => 'value'),
            array('id' => 'close_date', 'name' => 'Close Date', 'required' => 'No', 'db_field' => 'close_date'),
            array('id' => 'deal_stage', 'name' => 'Deal Stage', 'required' => 'No', 'db_field' => 'stages'),
        );

        // Add custom fields dynamically - ALL custom fields
        $customFieldsGroupsId = \App\Models\CustomFieldGroup::where('model', 'App\Models\Deal')
            ->where('company_id', company()->id)
            ->select('id')
            ->first();

        if ($customFieldsGroupsId) {
            $customFields = \App\Models\CustomField::where('custom_field_group_id', $customFieldsGroupsId->id)
                ->orderBy('id')
                ->get();

            foreach ($customFields as $customField) {
                // Convert label to slug for matching (Excel will slugify the headers)
                $slugifiedLabel = \Illuminate\Support\Str::slug($customField->label, '_');
                
                $fields[] = array(
                    'id' => $slugifiedLabel,
                    'name' => $customField->label,
                    'required' => $customField->required == 'yes' ? 'Yes' : 'No',
                    'db_field' => 'field_' . $customField->id,
                    'custom_field_id' => $customField->id
                );
            }
        }

        return $fields;
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
