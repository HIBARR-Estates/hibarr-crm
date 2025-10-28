<?php

namespace App\Jobs;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadPipeline;
use App\Traits\ExcelImportable;
use App\Traits\UniversalSearchTrait;
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

class ImportDealJob implements ShouldQueue
{

    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels, UniversalSearchTrait;
    use ExcelImportable;

    private $row;
    private $columns;
    private $company;

    /**
     * Create a new job instance.
     *
     * @return void
     */
    public function __construct($row, $columns, $company = null)
    {
        $this->row = $row;
        $this->columns = $columns;
        $this->company = $company;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        $leadCount = Session::get('total_leads', 1);
        Session::put('total_leads', $leadCount + 1);

        if (
            $this->isColumnExists('lead_contact_email') &&
            $this->isColumnExists('deal_name') &&
            $this->isColumnExists('pipeline') &&
            $this->isColumnExists('deal_stage') &&
            $this->isColumnExists('deal_value') &&
            $this->isColumnExists('close_date')
        ) {

            $lead = Lead::withoutGlobalScopes()->where('client_email', $this->getColumnValue('lead_contact_email'))->where('company_id', $this->company?->id)->first();

            // If lead doesn't exist, create it
            if (!$lead) {
                $lead = new Lead();
                $lead->company_id = $this->company?->id;
                $lead->client_email = $this->getColumnValue('lead_contact_email');
                $lead->client_name = $this->getColumnValue('deal_name'); // Use deal name as lead name
                $lead->status_id = 1; // Default status
                $lead->column_priority = 0; // Default priority
                $lead->added_by = user()?->id;
                $lead->save();
            }

            $pipeline = LeadPipeline::withoutGlobalScopes()->where('name', $this->getColumnValue('pipeline'))->where('company_id', $this->company?->id)->first();

            if (!$pipeline) {
                $pipeline = LeadPipeline::withoutGlobalScopes()->where('company_id', $this->company?->id)->first();
            }

            if (!$pipeline) {
                $this->failJob(__('messages.invalidData'));

                return;
            }

            $stage = $pipeline->stages->where('name', $this->getColumnValue('deal_stage'))->first();

            if (!$stage) {
                $stage = $pipeline->stages->where('default', 1)->first();
            }

            if (!$stage) {
                $this->failJob(__('messages.invalidData'));

                return;
            }

            DB::beginTransaction();
            Session::put('is_imported', true);
            try {

                $deal = new Deal();
                $deal->name = $this->getColumnValue('deal_name');
                $deal->lead_id = $lead->id;
                $deal->next_follow_up = 'yes';
                $deal->lead_pipeline_id = $pipeline->id;
                $deal->pipeline_stage_id = $stage->id;
                $deal->close_date = Carbon::parse($this->getColumnValue('close_date'))->format('Y-m-d');
                $deal->value = ($this->getColumnValue('deal_value')) ?: 0;
                $deal->currency_id = $this->company->currency_id;

                $leads = Session::get('leads', []);

                $leads[] = [
                    'deal_name'  => $lead->client_name,
                    'email' => $lead->client_email,
                ];

                Session::put('leads', $leads);

                $deal->save();

                // Import custom fields data
                $this->importCustomFields($deal);

                // Log search
                $this->logSearchEntry($deal->id, $deal->name, 'deals.show', 'deal');

                DB::commit();
            } catch (Exception $e) {
                DB::rollBack();
                $this->failJobWithMessage($e->getMessage());
            }
        }
        else {
            $this->failJob(__('messages.invalidData'));
        }
    }

    /**
     * Import custom fields data for the deal
     *
     * @param Deal $deal
     * @return void
     */
    private function importCustomFields($deal)
    {
        // Get all custom fields for Deal model
        $customFieldsGroupsId = \App\Models\CustomFieldGroup::where('model', 'App\Models\Deal')
            ->where('company_id', $this->company?->id)
            ->select('id')
            ->first();

        if (!$customFieldsGroupsId) {
            return;
        }

        $customFields = \App\Models\CustomField::where('custom_field_group_id', $customFieldsGroupsId->id)
            ->get();

        $customFieldsData = [];

        foreach ($customFields as $customField) {
            // Slugify the label to match what Excel imports
            $fieldKey = \Illuminate\Support\Str::slug($customField->label, '_');
            
            // Check if this custom field exists in the imported columns
            if ($this->isColumnExists($fieldKey)) {
                $value = $this->getColumnValue($fieldKey);
                
                // Skip if value is null or empty
                if ($value === null || $value === '') {
                    continue;
                }

                // Handle different field types
                switch ($customField->type) {
                    case 'date':
                        try {
                            // Try to parse the date using Carbon
                            $value = \Carbon\Carbon::parse($value)->format('Y-m-d');
                        } catch (\Exception $e) {
                            // Skip invalid dates
                            continue 2;
                        }
                        break;
                        
                    case 'select':
                        // For select fields, find the index of the value
                        $options = json_decode($customField->values, true);
                        if (is_array($options)) {
                            $key = array_search($value, $options);
                            if ($key !== false) {
                                $value = $key;
                            } else {
                                // Skip if value doesn't match any option
                                continue 2;
                            }
                        }
                        break;
                        
                    case 'checkbox':
                        // For checkbox, convert comma-separated values
                        if (is_string($value)) {
                            $value = str_replace([';', '|'], ',', $value);
                        }
                        break;
                        
                    case 'number':
                        // Ensure numeric value
                        if (!is_numeric($value)) {
                            continue 2;
                        }
                        break;
                }

                // Store with field_ prefix for saving (updateCustomFieldData expects field_X format)
                $saveKey = 'field_' . $customField->id;
                $customFieldsData[$saveKey] = $value;
            }
        }

        // Save custom fields data if any
        if (!empty($customFieldsData)) {
            $deal->updateCustomFieldData($customFieldsData);
        }
    }

}

