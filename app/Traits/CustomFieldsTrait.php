<?php

namespace App\Traits;

use Carbon\Carbon;
use App\Helper\Files;
use App\Models\Company;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use Illuminate\Support\Facades\DB;
use ReflectionClass;

trait CustomFieldsTrait
{

    public $model;
    private $extraData;
    public $custom_fields;
    public $custom_fields_data;

    /** Get company ID for current object
     * @return int Returns current object's company id
     */

    private function getModelName()
    {
        $model = new ReflectionClass($this);
        $this->model = $model;

        return $this->model->getName();
    }

    public function updateCustomField($group)
    {

        // Add Custom Fields for this group
        foreach ($group['fields'] as $field) {
            $insertData = [
                'custom_field_group_id' => 1,
                'label' => $field['label'],
                'name' => $field['name'],
                'type' => $field['type']
            ];

            if (isset($field['required']) && (in_array(strtolower($field['required']), ['yes', 'on', 1]))) {
                $insertData['required'] = 'yes';
            }
            else {
                $insertData['required'] = 'no';
            }

            // Single value should be stored as text (multi value JSON encoded)
            if (isset($field['value'])) {
                if (is_array($field['value'])) {
                    $insertData['values'] = json_encode($field['value']);

                }
                else {
                    $insertData['values'] = $field['value'];
                }
            }

            DB::table('custom_fields')->insert($insertData);
        }
    }

    public function getCustomFieldGroups($fields = false)
    {
        $customFieldGroup = CustomFieldGroup::where('model', $this->getModelName());

        $customFieldGroup = $customFieldGroup->when(method_exists($this, 'company'), function ($query) {
            return $query->where('company_id', $this->company_id ?: company()->id);
        })->first();

        if ($fields && $customFieldGroup) {
            // Load custom fields with their visibility rule sets
            try {
                $customFieldGroup->load(['customFieldWithRules' => function($query) {
                    $query->orderBy('display_order');
                }])->append(['fields']);
            } catch (\Exception $e) {
                // Log the error for debugging
                \Log::warning('Failed to load custom field visibility rules in CustomFieldsTrait', [
                    'error' => $e->getMessage(),
                    'model' => $this->getModelName(),
                    'trace' => $e->getTraceAsString()
                ]);
                
                // If tables don't exist yet, load without relationships
                $customFieldGroup->load(['customField' => function($query) {
                    $query->orderBy('display_order');
                }])->append(['fields']);
            }
        }

        return $customFieldGroup;
    }

    public function getCustomFieldGroupsWithFields()
    {
        return $this->getCustomFieldGroups(true);
    }

    public function getCustomFieldsData()
    {

        $modelId = $this->id;

        // Get custom fields for this modal
        /** @var \Illuminate\Database\Eloquent\Collection $data */
        $data = DB::table('custom_fields_data')
            ->rightJoin('custom_fields', function ($query) use ($modelId) {
                $query->on('custom_fields_data.custom_field_id', '=', 'custom_fields.id');
                $query->on('model_id', '=', DB::raw($modelId));
            })
            ->rightJoin('custom_field_groups', 'custom_fields.custom_field_group_id', '=', 'custom_field_groups.id')
            ->select('custom_fields.id', DB::raw('CONCAT("field_", custom_fields.id) as field_id'), 'custom_fields.type', 'custom_fields_data.value')
            ->where('custom_field_groups.model', $this->getModelName())
            ->get();

        $data = collect($data);

        // Convert collection to an associative array
        // of format ['field_{id}' => $value]
        $result = $data->pluck('value', 'field_id');

        return $result;
    }

    public function updateCustomFieldData($fields, $company_id = null)
    {
        foreach ($fields as $key => $value) {

            $idarray = explode('_', $key);
            $id = end($idarray);

            $fieldType = CustomField::findOrFail($id)->type;
            $company = $company_id ? Company::findOrFail($company_id) : company();

            // Handle date fields - support both ISO format (Y-m-d) and company date format
            if ($fieldType == 'date' && !empty($value)) {
                try {
                    // First try ISO format (from inline editing / HTML date input)
                    $value = Carbon::createFromFormat('Y-m-d', $value)->format('Y-m-d');
                } catch (\Exception $e) {
                    try {
                        // Fallback to company date format
                        $value = Carbon::createFromFormat($company->date_format, $value)->format('Y-m-d');
                    } catch (\Exception $e) {
                        // If both fail, try Carbon's natural parsing
                        $value = Carbon::parse($value)->format('Y-m-d');
                    }
                }
            }
            
            // Handle file uploads - supports single file or array of files
            if ($fieldType == 'file') {
                // Get existing files from database
                $existingEntry = DB::table('custom_fields_data')
                    ->where('model', $this->getModelName())
                    ->where('model_id', $this->id)
                    ->where('custom_field_id', $id)
                    ->first();
                
                $existingFiles = [];
                if ($existingEntry && !empty($existingEntry->value)) {
                    // Try to parse as JSON array first
                    $decoded = json_decode($existingEntry->value, true);
                    if (is_array($decoded)) {
                        $existingFiles = $decoded;
                    } else {
                        // Single file or comma-separated
                        $existingFiles = array_filter(array_map('trim', explode(',', $existingEntry->value)));
                    }
                }
                
                // Handle clearing all files
                if (empty($value) || $value === '') {
                    // Delete all existing files
                    foreach ($existingFiles as $oldFile) {
                        Files::deleteFile($oldFile, 'custom_fields');
                    }
                    $value = '';
                }
                // Handle array of UploadedFile objects (new files to add)
                elseif (is_array($value)) {
                    $newFiles = [];
                    foreach ($value as $file) {
                        if ($file instanceof \Illuminate\Http\UploadedFile) {
                            $newFiles[] = Files::uploadLocalOrS3($file, 'custom_fields');
                        } elseif (is_string($file) && !empty($file)) {
                            // Already a filename string (for removal operations)
                            $newFiles[] = $file;
                        }
                    }
                    
                    // Combine existing and new files
                    $allFiles = array_merge($existingFiles, $newFiles);
                    $allFiles = array_unique(array_filter($allFiles));
                    
                    // Store as JSON array if multiple files, or single string if one file
                    $value = count($allFiles) > 1 ? json_encode(array_values($allFiles)) : (reset($allFiles) ?: '');
                }
                // Handle single UploadedFile (replaces all existing files)
                elseif ($value instanceof \Illuminate\Http\UploadedFile) {
                    // Delete old files when replacing with single file
                    foreach ($existingFiles as $oldFile) {
                        Files::deleteFile($oldFile, 'custom_fields');
                    }
                    $value = Files::uploadLocalOrS3($value, 'custom_fields');
                }
                // Handle JSON string (for partial removal of files)
                elseif (is_string($value) && !empty($value)) {
                    $decoded = json_decode($value, true);
                    if (is_array($decoded)) {
                        // This is a JSON array of filenames to keep
                        // Delete files that are no longer in the list
                        $filesToKeep = $decoded;
                        foreach ($existingFiles as $oldFile) {
                            if (!in_array($oldFile, $filesToKeep)) {
                                Files::deleteFile($oldFile, 'custom_fields');
                            }
                        }
                        // Store as JSON if multiple, single string if one
                        $value = count($filesToKeep) > 1 ? json_encode(array_values($filesToKeep)) : (reset($filesToKeep) ?: '');
                    }
                    // Otherwise it's just a single filename string, leave as-is
                }
            }
            
            // Handle checkbox and other array-based fields - convert arrays to comma-separated strings
            if (is_array($value)) {
                if ($fieldType == 'checkbox') {
                    $value = implode(', ', $value);
                } else {
                    // For other array types, convert to JSON string
                    $value = json_encode($value);
                }
            }
            
            // Handle phone field with country code
            if ($fieldType == 'phone' && !empty($value)) {
                // Check if there's a corresponding country code field
                $countryCodeKey = 'country_phonecode_' . $id;
                $countryIdentifierKey = 'country_identifier_' . $id;
                
                if (isset($fields[$countryCodeKey]) && !empty($fields[$countryCodeKey])) {
                    $countryCode = $fields[$countryCodeKey];
                    $countryIdentifier = $fields[$countryIdentifierKey] ?? '';
                    
                    // Store phone with country code and country identifier for accurate reloading
                    $phoneData = [
                        'phone' => '+' . $countryCode . ' ' . $value,
                        'country_code' => $countryCode,
                        'country_identifier' => $countryIdentifier
                    ];
                    $value = json_encode($phoneData);
                }
            }

            // Find is entry exists
            $entry = DB::table('custom_fields_data')
                ->where('model', $this->getModelName())
                ->where('model_id', $this->id)
                ->where('custom_field_id', $id)
                ->first();

            if ($entry) {
                if ($fieldType == 'file' && (!is_null($entry->value) && $entry->value != $value)) {
                    Files::deleteFile($entry->value, 'custom_fields');
                }

                // Update entry - ensure value is a string
                $stringValue = is_array($value) ? implode(', ', $value) : (string)($value ?? '');
                DB::table('custom_fields_data')
                    ->where('model', $this->getModelName())
                    ->where('model_id', $this->id)
                    ->where('custom_field_id', $id)
                    ->update(['value' => $stringValue]);
            }
            else {
                // Insert entry - ensure value is a string
                $stringValue = is_array($value) ? implode(', ', $value) : (string)($value ?? '');
                DB::table('custom_fields_data')
                    ->insert([
                        'model' => $this->getModelName(),
                        'model_id' => $this->id,
                        'custom_field_id' => $id,
                        'value' => $stringValue
                    ]);
            }
        }
    }

    public function getExtrasAttribute()
    {
        if ($this->extraData == null) {
            $this->extraData = $this->getCustomFieldGroupsWithFields();
        }

        return $this->extraData;
    }

    public function withCustomFields()
    {
        $this->custom_fields = $this->getCustomFieldGroupsWithFields();
        $this->custom_fields_data = $this->getCustomFieldsData();

        // Ensure these are serialized by adding them to attributes
        $this->attributes['custom_fields'] = $this->custom_fields;
        $this->attributes['custom_fields_data'] = $this->custom_fields_data;

        return $this;
    }

}
