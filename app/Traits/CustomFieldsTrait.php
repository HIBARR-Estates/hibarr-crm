<?php

namespace App\Traits;

use App\Helper\Files;
use App\Models\Company;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\Lead;
use App\Services\DealActivityEventService;
use App\Services\DealAutomationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
                'type' => $field['type'],
            ];

            if (isset($field['required']) && (in_array(strtolower($field['required']), ['yes', 'on', 1]))) {
                $insertData['required'] = 'yes';
            } else {
                $insertData['required'] = 'no';
            }

            // Single value should be stored as text (multi value JSON encoded)
            if (isset($field['value'])) {
                if (is_array($field['value'])) {
                    $insertData['values'] = json_encode($field['value']);

                } else {
                    $insertData['values'] = $field['value'];
                }
            }

            DB::table('custom_fields')->insert($insertData);
        }
    }

    /**
     * The custom field group for this model, optionally with its fields (and their
     * visibility rule sets, rule groups and criteria) eager-loaded.
     *
     * Memoised for the lifetime of the request, keyed by model + company + whether
     * fields were requested. A deal page resolves this five times across different
     * model instances — the deal, its lead, and again inside the shell form data —
     * and each resolve costs ~5 queries (group, fields, rule sets, rule groups,
     * criteria, categories), so it was ~25 queries for one unchanging answer.
     *
     * Scoped container binding rather than a static or an instance property: field
     * *definitions* cannot change midway through a request, and the container is
     * rebuilt per request, per test and flushed between queue jobs, so a definition
     * change is picked up on the next one. Call `forgetCustomFieldGroupMemo()` after
     * writing definitions inside a request that then re-reads them.
     */
    public function getCustomFieldGroups($fields = false)
    {
        $companyId = method_exists($this, 'company')
            ? ($this->company_id ?: company()->id)
            : null;

        $key = self::customFieldGroupMemoKey($this->getModelName(), $companyId, (bool) $fields);
        $container = app();

        if ($container->bound($key)) {
            return $container->make($key);
        }

        $modelName = $this->getModelName();
        $hasCompany = method_exists($this, 'company');

        $container->scoped($key, function () use ($fields, $modelName, $hasCompany, $companyId) {
            $customFieldGroup = CustomFieldGroup::where('model', $modelName);

            $customFieldGroup = $customFieldGroup->when($hasCompany, function ($query) use ($companyId) {
                return $query->where('company_id', $companyId);
            })->first();

            if ($fields && $customFieldGroup) {
                // Load custom fields with their visibility rule sets
                try {
                    $customFieldGroup->load(['customFieldWithRules' => function ($query) {
                        $query->orderBy('display_order');
                    }])->append(['fields']);
                } catch (\Exception $e) {
                    // Log the error for debugging
                    \Log::warning('Failed to load custom field visibility rules in CustomFieldsTrait', [
                        'error' => $e->getMessage(),
                        'model' => $modelName,
                        'trace' => $e->getTraceAsString()
                    ]);

                    // If tables don't exist yet, load without relationships
                    $customFieldGroup->load(['customField' => function ($query) {
                        $query->orderBy('display_order');
                    }])->append(['fields']);
                }
            }

            return $customFieldGroup;
        });

        return $container->make($key);
    }

    private static function customFieldGroupMemoKey(string $model, $companyId, bool $fields): string
    {
        return 'custom-field-group.' . $model . '.' . ($companyId ?? 'none') . '.' . ($fields ? 'with-fields' : 'bare');
    }

    /** Drop the memoised custom field values (call after writing them). */
    public function forgetCustomFieldValuesMemo(): void
    {
        $this->customFieldValuesMemo = null;
    }

    /** Drop the memo after adding or changing custom field definitions. */
    public function forgetCustomFieldGroupMemo(): void
    {
        $companyId = method_exists($this, 'company')
            ? ($this->company_id ?: company()->id)
            : null;

        foreach ([true, false] as $fields) {
            app()->forgetInstance(self::customFieldGroupMemoKey($this->getModelName(), $companyId, $fields));
        }
    }

    public function getCustomFieldGroupsWithFields()
    {
        return $this->getCustomFieldGroups(true);
    }

    /**
     * Values are read twice per model on a deal page (once via withCustomFields,
     * once directly), so memoise per instance. Unlike field *definitions* these
     * do change on write, hence the explicit invalidation in updateCustomFieldData
     * before it takes its "after" snapshot.
     *
     * @var \Illuminate\Support\Collection|null
     */
    private $customFieldValuesMemo = null;

    public function getCustomFieldsData()
    {
        if ($this->customFieldValuesMemo !== null) {
            return $this->customFieldValuesMemo;
        }

        $modelId = $this->id;
        $modelName = $this->getModelName();

        // Get all custom fields for this model's group, LEFT join data so we have every field key (null when no data)
        $data = DB::table('custom_fields')
            ->join('custom_field_groups', 'custom_fields.custom_field_group_id', '=', 'custom_field_groups.id')
            ->leftJoin('custom_fields_data', function ($query) use ($modelId, $modelName) {
                $query->on('custom_fields_data.custom_field_id', '=', 'custom_fields.id')
                    ->where('custom_fields_data.model', '=', $modelName)
                    ->where('custom_fields_data.model_id', '=', $modelId);
            })
            ->where('custom_field_groups.model', $modelName)
            ->select('custom_fields.id', DB::raw('CONCAT("field_", custom_fields.id) as field_id'), 'custom_fields_data.value')
            ->get();

        $data = collect($data);

        // Convert to ['field_{id}' => $value]; value is null when no custom_fields_data row exists
        $result = $data->pluck('value', 'field_id');

        return $this->customFieldValuesMemo = $result;
    }

    public function updateCustomFieldData($fields, $company_id = null)
    {
        $isDeal = $this instanceof Deal;
        $isLead = $this instanceof Lead;
        $tracksCustomFieldChanges = $isDeal || $isLead;
        $beforeSnapshot = $tracksCustomFieldChanges ? $this->getCustomFieldsData()->toArray() : [];
        $requestedFieldKeys = $this->collectCustomFieldKeysFromPayload($fields);

        foreach ($fields as $key => $value) {
            if (str_starts_with((string) $key, 'country_phonecode_') || str_starts_with((string) $key, 'country_identifier_')) {
                continue;
            }

            $idarray = explode('_', $key);
            $id = end($idarray);

            if (! is_numeric($id)) {
                continue;
            }

            $customField = CustomField::findOrFail($id);
            $fieldType = $customField->type;

            // Currency amounts represent money and should never go negative.
            // The frontend's CurrencyInput already blocks typing/pasting a
            // minus sign, but that's UI-only — anything hitting this method
            // directly (import, API, a future caller) must be clamped here too.
            if ($fieldType == 'currency' && is_array($value) && isset($value['amount']) && is_numeric($value['amount'])) {
                $value['amount'] = max(0, (float) $value['amount']);
            }

            // Range values (e.g. a budget range) shouldn't go negative, and min
            // shouldn't exceed max — clamp/swap here since the frontend's two
            // plain number inputs don't enforce this on their own.
            if ($fieldType == 'range' && is_array($value) && isset($value['min'], $value['max']) && is_numeric($value['min']) && is_numeric($value['max'])) {
                $min = max(0, (float) $value['min']);
                $max = max(0, (float) $value['max']);
                $value['min'] = min($min, $max);
                $value['max'] = max($min, $max);
            }

            $existingEntry = DB::table('custom_fields_data')
                ->where('model', $this->getModelName())
                ->where('model_id', $this->id)
                ->where('custom_field_id', $id)
                ->first();

            $company = $company_id ? Company::findOrFail($company_id) : company();

            // Handle date fields - support both ISO format (Y-m-d) and company date format
            if ($fieldType == 'date' && ! empty($value)) {
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

            // Handle file uploads - supports single file, array of files, or external URLs
            if ($fieldType == 'file') {
                // Get existing files from database
                $existingEntry = DB::table('custom_fields_data')
                    ->where('model', $this->getModelName())
                    ->where('model_id', $this->id)
                    ->where('custom_field_id', $id)
                    ->first();

                $existingFiles = [];
                if ($existingEntry && ! empty($existingEntry->value)) {
                    // Try to parse as JSON array first
                    $decoded = json_decode($existingEntry->value, true);
                    if (is_array($decoded)) {
                        $existingFiles = $decoded;
                    } else {
                        // Single file or comma-separated
                        $existingFiles = array_filter(array_map('trim', explode(',', $existingEntry->value)));
                    }
                }

                /** @var \App\Services\FileStorageService $fileStorageService */
                $fileStorageService = app(\App\Services\FileStorageService::class);

                // Handle clearing all files
                if (empty($value) || $value === '') {
                    // Delete all existing files
                    foreach ($existingFiles as $oldFile) {
                        $this->deleteCustomFieldFile($oldFile, $fileStorageService);
                    }
                    $value = '';
                }
                // Handle array of UploadedFile objects or URL strings (new files to add)
                elseif (is_array($value)) {
                    $newFiles = [];
                    foreach ($value as $file) {
                        if ($file instanceof \Illuminate\Http\UploadedFile) {
                            // Upload via external FileStorageService
                            try {
                                $result = $fileStorageService->upload($file, 'custom_fields');
                                $newFiles[] = $result['downloadUrl'];
                            } catch (\Exception $e) {
                                \Log::error('Custom field file upload failed', [
                                    'error' => $e->getMessage(),
                                    'field_id' => $id,
                                ]);
                                // Fallback to local upload if external fails
                                $newFiles[] = Files::uploadLocalOrS3($file, 'custom_fields');
                            }
                        } elseif (is_string($file) && ! empty($file)) {
                            // Already a filename string or URL (for removal operations or pre-uploaded)
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
                        $this->deleteCustomFieldFile($oldFile, $fileStorageService);
                    }
                    // Upload via external FileStorageService
                    try {
                        $result = $fileStorageService->upload($value, 'custom_fields');
                        $value = $result['downloadUrl'];
                    } catch (\Exception $e) {
                        \Log::error('Custom field file upload failed', [
                            'error' => $e->getMessage(),
                            'field_id' => $id,
                        ]);
                        // Fallback to local upload if external fails
                        $value = Files::uploadLocalOrS3($value, 'custom_fields');
                    }
                }
                // Handle URL string from frontend (already uploaded externally)
                elseif (is_string($value) && \App\Services\FileStorageService::isExternalUrl($value)) {
                    // Value is already an external URL, store as-is
                    // Delete old files that are being replaced
                    foreach ($existingFiles as $oldFile) {
                        if ($oldFile !== $value) {
                            $this->deleteCustomFieldFile($oldFile, $fileStorageService);
                        }
                    }
                }
                // Handle JSON string (for partial removal of files)
                elseif (is_string($value) && ! empty($value)) {
                    $decoded = json_decode($value, true);
                    if (is_array($decoded)) {
                        // This is a JSON array of filenames/URLs to keep
                        // Delete files that are no longer in the list
                        $filesToKeep = $decoded;
                        foreach ($existingFiles as $oldFile) {
                            if (! in_array($oldFile, $filesToKeep)) {
                                $this->deleteCustomFieldFile($oldFile, $fileStorageService);
                            }
                        }
                        // Store as JSON if multiple, single string if one
                        $value = count($filesToKeep) > 1 ? json_encode(array_values($filesToKeep)) : (reset($filesToKeep) ?: '');
                    }
                    // Otherwise it's just a single filename string, leave as-is
                }
            }

            // Multi-value custom fields (checkbox options, multiselect, countries)
            // all store a JSON array. Checkbox used to be comma-joined; keep
            // writing JSON going forward so country-style values with commas
            // and checkbox/multiselect share one path. Readers still accept
            // the legacy comma-separated form.
            if (is_array($value)) {
                if (in_array($fieldType, ['checkbox', 'multiselect', 'multiSelectCountry'], true)) {
                    $value = json_encode(array_values($value));
                } elseif ($fieldType == 'repeatable') {
                    // Repeatable: store array of objects as JSON
                    $value = json_encode($value);
                } else {
                    // For other array types, convert to JSON string
                    $value = json_encode($value);
                }
            }

            // Handle phone field with country code
            if ($fieldType == 'phone' && ! empty($value)) {
                // Check if there's a corresponding country code field
                $countryCodeKey = 'country_phonecode_'.$id;
                $countryIdentifierKey = 'country_identifier_'.$id;

                if (isset($fields[$countryCodeKey]) && ! empty($fields[$countryCodeKey])) {
                    $countryCode = $fields[$countryCodeKey];
                    $countryIdentifier = $fields[$countryIdentifierKey] ?? '';

                    // Store phone with country code and country identifier for accurate reloading
                    $phoneData = [
                        'phone' => '+'.$countryCode.' '.$value,
                        'country_code' => $countryCode,
                        'country_identifier' => $countryIdentifier,
                    ];
                    $value = json_encode($phoneData);
                }
            }

            $stringValue = is_array($value) ? implode(', ', $value) : (string) ($value ?? '');

            if ($existingEntry) {
                // Note: file deletion is handled above in the file type block.
                // No need to delete here — the value is already resolved.

                DB::table('custom_fields_data')
                    ->where('model', $this->getModelName())
                    ->where('model_id', $this->id)
                    ->where('custom_field_id', $id)
                    ->update(['value' => $stringValue]);
            } else {
                DB::table('custom_fields_data')
                    ->insert([
                        'model' => $this->getModelName(),
                        'model_id' => $this->id,
                        'custom_field_id' => $id,
                        'value' => $stringValue,
                    ]);
            }
        }

        // Values just changed on disk — drop the memo so the "after" snapshot below
        // (and any later read on this instance) reflects the write, not the state
        // captured for $beforeSnapshot.
        $this->forgetCustomFieldValuesMemo();

        if ($tracksCustomFieldChanges && ! empty($requestedFieldKeys)) {
            $afterSnapshot = $this->getCustomFieldsData()->toArray();
            $customFieldChanges = $this->buildDealCustomFieldChangeEntries(
                $beforeSnapshot,
                $afterSnapshot,
                $requestedFieldKeys
            );

            if (! empty($customFieldChanges)) {
                Log::info('[CustomFieldsTrait] Detected custom field changes.', [
                    'model' => $isDeal ? 'deal' : 'lead',
                    'model_id' => $this->id,
                    'change_count' => count($customFieldChanges),
                    'field_keys' => array_column($customFieldChanges, 'custom_field_id'),
                ]);

                // CRM timeline event: Deal-only today (DealActivityEventService::
                // recordCustomFieldsUpdated() is Deal-typed) — not touched here,
                // out of scope for wiring up the automation trigger below.
                if ($isDeal) {
                    app(DealActivityEventService::class)->recordCustomFieldsUpdated($this, $customFieldChanges);
                }

                // Deal automation trigger 'custom_field_updated' — this is what
                // actually makes an automation configured with that trigger fire.
                // process() itself already skips locked deals; no need to
                // duplicate that check here.
                if (! isRunningInConsoleOrSeeding()) {
                    if ($isDeal) {
                        app(DealAutomationService::class)->process($this, 'custom_field_updated');
                    } else {
                        app(DealAutomationService::class)->processLead($this, 'custom_field_updated');
                    }
                }
            } else {
                Log::debug('[CustomFieldsTrait] No custom field changes detected after save.', [
                    'model' => $isDeal ? 'deal' : 'lead',
                    'model_id' => $this->id,
                    'requested_field_keys' => $requestedFieldKeys,
                ]);
            }
        }
    }

    /**
     * Resolve payload keys to canonical custom field keys (field_{id}).
     */
    protected function collectCustomFieldKeysFromPayload(array $fields): array
    {
        $keys = [];

        foreach (array_keys($fields) as $key) {
            $resolved = $this->resolveCustomFieldKey((string) $key);

            if ($resolved) {
                $keys[] = $resolved;
            }
        }

        return array_values(array_unique($keys));
    }

    protected function resolveCustomFieldKey(string $key): ?string
    {
        if (preg_match('/^field_(\d+)$/', $key, $matches)) {
            return 'field_'.$matches[1];
        }

        if (ctype_digit($key)) {
            return 'field_'.$key;
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  array<int, string>  $fieldKeys
     * @return array<int, array{custom_field_id: int, field_label: string, field_type: ?string, old_value: ?string, new_value: ?string}>
     */
    protected function buildDealCustomFieldChangeEntries(array $before, array $after, array $fieldKeys): array
    {
        $changes = [];

        foreach ($fieldKeys as $fieldKey) {
            $oldVal = $before[$fieldKey] ?? null;
            $newVal = $after[$fieldKey] ?? null;

            if (! $this->customFieldValueChanged(
                $oldVal !== null ? (string) $oldVal : null,
                $newVal !== null ? (string) $newVal : null
            )) {
                continue;
            }

            $fieldId = (int) substr($fieldKey, 6);
            $customField = CustomField::find($fieldId);

            $changes[] = [
                'custom_field_id' => $fieldId,
                'field_label' => $customField?->label ?? $fieldKey,
                'field_type' => $customField?->type,
                'old_value' => $oldVal !== null ? (string) $oldVal : null,
                'new_value' => $newVal !== null ? (string) $newVal : null,
            ];
        }

        return $changes;
    }

    protected function customFieldValueChanged(?string $oldValue, ?string $newValue): bool
    {
        return $this->normalizeCustomFieldValueForComparison($oldValue)
            !== $this->normalizeCustomFieldValueForComparison($newValue);
    }

    protected function normalizeCustomFieldValueForComparison(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $str = trim((string) $value);
        $lower = strtolower($str);

        if (in_array($lower, ['1', 'true', 'yes', 'on'], true)) {
            return '1';
        }

        if (in_array($lower, ['0', 'false', 'no', 'off'], true)) {
            return '0';
        }

        $decoded = json_decode($str, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return json_encode($decoded);
        }

        return $str;
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

    /**
     * Delete a custom field file, handling both external URLs and legacy local files.
     *
     * @param  string  $fileRef  The file reference (could be an external URL or a local filename)
     */
    protected function deleteCustomFieldFile(string $fileRef, \App\Services\FileStorageService $fileStorageService): void
    {
        if (empty($fileRef)) {
            return;
        }

        if (\App\Services\FileStorageService::isExternalUrl($fileRef)) {
            // External file: try to extract object path and delete from external storage
            $objectPath = \App\Services\FileStorageService::extractObjectPathFromUrl($fileRef);
            if ($objectPath) {
                try {
                    $fileStorageService->delete($objectPath);
                } catch (\Exception $e) {
                    \Log::warning('Failed to delete external custom field file', [
                        'url' => $fileRef,
                        'objectPath' => $objectPath,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        } else {
            // Legacy local file
            Files::deleteFile($fileRef, 'custom_fields');
        }
    }
}
