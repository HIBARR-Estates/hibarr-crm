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

class ImportDealJob implements ShouldQueue
{

    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels, UniversalSearchTrait;
    use ExcelImportable;

    private $row;
    private $columns;
    private $company;
    private $pipelineId;
    
    // Cache for common lookups to avoid repeated queries
    private static $pipelinesCache = [];
    private static $customFieldsCache = [];
    private static $usersCache = [];
    private static $leadAgentsCache = [];

    /**
     * Create a new job instance.
     *
     * @return void
     */
    public function __construct($row, $columns, $company = null, $userId = null, $pipelineId = null)
    {
        $this->row = $row;
        $this->columns = $columns;
        $this->company = $company;
        $this->pipelineId = $pipelineId;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        // Validate required columns
        if (
            !$this->isColumnExists('lead_contact_email') ||
            !$this->isColumnExists('deal_name') ||
            !$this->isColumnExists('deal_value') ||
            !$this->isColumnExists('close_date')
        ) {
            $this->failJob(__('messages.invalidData'));
            return;
        }

        try {
            // Do all reads outside transaction
            $lead = $this->findOrCreateLead();

            // Get stage (from ID or name, with default fallback)
            $stageData = $this->getStageData();
            if (!$stageData) {
                throw new Exception('No valid stage found and no default stage available');
            }

            $agentId = null;
            if ($this->isColumnExists('responsible_name')) {
                $agentId = $this->findOrCreateAgent($this->getColumnValue('responsible_name'));
            }

            // Prepare custom fields data
            $customFieldsData = $this->prepareCustomFieldsData();
            
            // Prepare marketing data
            $marketingData = $this->prepareMarketingData();
            
            // Prepare Hibarr custom fields data
            $hibarrFieldsData = $this->prepareHibarrFieldsData();

            // Create deal - wrapped in transaction
            $deal = DB::transaction(function () use ($lead, $stageData, $agentId, $customFieldsData, $hibarrFieldsData) {
                $deal = new Deal();
                $deal->name = $this->getColumnValue('deal_name');
                $deal->lead_id = $lead->id;
                $deal->next_follow_up = 'yes';
                $deal->lead_pipeline_id = $stageData['pipeline_id'];
                $deal->pipeline_stage_id = $stageData['stage_id'];
                $deal->close_date = Carbon::parse($this->getColumnValue('close_date'))->format('Y-m-d');
                $deal->value = ($this->getColumnValue('deal_value')) ?: 0;
                $deal->currency_id = $this->company->currency_id;
                
                if ($agentId) {
                    $deal->agent_id = $agentId;
                }

                $deal->save();

                // Save custom fields in same transaction as deal
                if (!empty($customFieldsData)) {
                    $deal->updateCustomFieldData($customFieldsData);
                }
                
                // Save Hibarr custom fields in same transaction as deal
                if (!empty($hibarrFieldsData)) {
                    \App\Models\HibarrDealFields::updateOrCreate(
                        ['deal_id' => $deal->id],
                        $hibarrFieldsData
                    );
                }
                
                return $deal;
            });
            
            // Save marketing data - separate transaction
            if (!empty($marketingData)) {
                DB::transaction(function () use ($lead, $marketingData) {
                    $marketingData['lead_id'] = $lead->id;
                    \App\Models\LeadMarketing::updateOrCreate(
                        ['lead_id' => $lead->id],
                        $marketingData
                    );
                });
            }
            
        } catch (Exception $e) {
            $this->failJobWithMessage($e->getMessage());
        }
    }

    /**
     * Find or create lead
     *
     * @return Lead
     */
    private function findOrCreateLead()
    {
        $email = $this->getColumnValue('lead_contact_email');
        
        $lead = Lead::withoutGlobalScopes()
            ->where('client_email', $email)
            ->where('company_id', $this->company?->id)
            ->first();

        if (!$lead) {
            // Wrap lead creation in transaction
            $lead = DB::transaction(function () use ($email) {
                $lead = new Lead();
                $lead->company_id = $this->company?->id;
                $lead->client_email = $email;
                $lead->client_name = $this->getColumnValue('deal_name');
                $lead->status_id = 1;
                $lead->column_priority = 0;
                $lead->added_by = user()?->id;
                $lead->save();
                
                return $lead;
            });
        }

        return $lead;
    }

    /**
     * Get stage data with priority: stage_id > deal_stage name > default stage
     *
     * @return array|null Returns ['stage_id' => x, 'pipeline_id' => y, 'stage_name' => 'name'] or null
     */
    private function getStageData()
    {
        // Priority 1: Check if stage_id is provided
        if ($this->isColumnExists('stage_id')) {
            $stageId = $this->getColumnValue('stage_id');
            if ($stageId) {
                $stageData = $this->getStageById($stageId);
                if ($stageData) {
                    return $stageData;
                }
            }
        }

        // Priority 2: Check if deal_stage name is provided
        if ($this->isColumnExists('deal_stage')) {
            $stageName = $this->getColumnValue('deal_stage');
            if ($stageName) {
                $stageData = $this->getStageByName($stageName);
                if ($stageData) {
                    return $stageData;
                }
            }
        }

        // Priority 3: Get default stage (first stage of first pipeline)
        return $this->getDefaultStage();
    }

    /**
     * Get stage by ID with caching
     *
     * @param int $stageId
     * @return array|null
     */
    private function getStageById($stageId)
    {
        $cacheKey = $this->company->id . '_stage_id_' . $stageId . '_' . ($this->pipelineId ?? 'all');

        if (!isset(self::$pipelinesCache[$cacheKey])) {
            $query = \App\Models\PipelineStage::withoutGlobalScopes()
                ->select('id', 'name', 'lead_pipeline_id')
                ->whereHas('pipeline', function ($query) {
                    $query->where('company_id', $this->company?->id);
                })
                ->where('id', $stageId);

            // If pipeline is selected, ensure stage belongs to that pipeline
            if ($this->pipelineId) {
                $query->where('lead_pipeline_id', $this->pipelineId);
            }

            $stage = $query->first();

            if ($stage) {
                self::$pipelinesCache[$cacheKey] = [
                    'stage_id' => $stage->id,
                    'pipeline_id' => $stage->lead_pipeline_id,
                    'stage_name' => $stage->name,
                ];
            } else {
                self::$pipelinesCache[$cacheKey] = null;
            }
        }

        return self::$pipelinesCache[$cacheKey];
    }

    /**
     * Get stage by name with caching
     *
     * @param string $stageName
     * @return array|null
     */
    private function getStageByName($stageName)
    {
        $cacheKey = $this->company->id . '_stage_name_' . $stageName . '_' . ($this->pipelineId ?? 'all');

        if (!isset(self::$pipelinesCache[$cacheKey])) {
            $query = \App\Models\PipelineStage::withoutGlobalScopes()
                ->select('id', 'name', 'lead_pipeline_id')
                ->whereHas('pipeline', function ($query) {
                    $query->where('company_id', $this->company?->id);
                })
                ->where('name', $stageName);

            // If pipeline is selected, only look in that pipeline
            if ($this->pipelineId) {
                $query->where('lead_pipeline_id', $this->pipelineId);
            }

            $stage = $query->first();

            if ($stage) {
                self::$pipelinesCache[$cacheKey] = [
                    'stage_id' => $stage->id,
                    'pipeline_id' => $stage->lead_pipeline_id,
                    'stage_name' => $stage->name,
                ];
            } else {
                self::$pipelinesCache[$cacheKey] = null;
            }
        }

        return self::$pipelinesCache[$cacheKey];
    }

    /**
     * Get default stage (first stage of selected or first pipeline)
     *
     * @return array|null
     */
    private function getDefaultStage()
    {
        $cacheKey = $this->company->id . '_default_stage_' . ($this->pipelineId ?? 'all');

        if (!isset(self::$pipelinesCache[$cacheKey])) {
            $query = \App\Models\PipelineStage::withoutGlobalScopes()
                ->select('pipeline_stages.id', 'pipeline_stages.name', 'pipeline_stages.lead_pipeline_id')
                ->join('lead_pipelines', 'pipeline_stages.lead_pipeline_id', '=', 'lead_pipelines.id')
                ->where('lead_pipelines.company_id', $this->company?->id);

            // If pipeline is selected, get first stage of that pipeline
            if ($this->pipelineId) {
                $query->where('lead_pipelines.id', $this->pipelineId);
            }

            $stage = $query->orderBy('lead_pipelines.id')
                ->orderBy('pipeline_stages.id')
                ->first();

            if ($stage) {
                self::$pipelinesCache[$cacheKey] = [
                    'stage_id' => $stage->id,
                    'pipeline_id' => $stage->lead_pipeline_id,
                    'stage_name' => $stage->name,
                ];
            } else {
                self::$pipelinesCache[$cacheKey] = null;
            }
        }

        return self::$pipelinesCache[$cacheKey];
    }

    /**
     * Prepare custom fields data for the deal (optimized with caching)
     *
     * @return array
     */
    private function prepareCustomFieldsData()
    {
        // Use cached custom fields to avoid repeated queries
        $customFields = $this->getCustomFields();
        
        if (empty($customFields)) {
            return [];
        }

        $customFieldsData = [];

        foreach ($customFields as $customField) {
            // Handle both object and array formats (for serialization safety)
            $label = is_object($customField) ? $customField->label : $customField['label'];
            $type = is_object($customField) ? $customField->type : $customField['type'];
            $id = is_object($customField) ? $customField->id : $customField['id'];
            $values = is_object($customField) ? $customField->values : $customField['values'];
            
            // Slugify the label to match what Excel imports
            $fieldKey = \Illuminate\Support\Str::slug($label, '_');
            
            // Check if this custom field exists in the imported columns
            if (!$this->isColumnExists($fieldKey)) {
                continue;
            }
            
            $value = $this->getColumnValue($fieldKey);
            
            // Skip if value is null or empty
            if ($value === null || $value === '') {
                continue;
            }

            // Handle different field types
            switch ($type) {
                case 'date':
                    try {
                        $value = \Carbon\Carbon::parse($value)->format('Y-m-d');
                    } catch (\Exception $e) {
                        continue 2;
                    }
                    break;
                    
                case 'select':
                    $options = json_decode($values, true);
                    if (is_array($options)) {
                        $key = array_search($value, $options);
                        if ($key !== false) {
                            $value = $key;
                        } else {
                            continue 2;
                        }
                    }
                    break;
                    
                case 'checkbox':
                    if (is_string($value)) {
                        $value = str_replace([';', '|'], ',', $value);
                    }
                    break;
                    
                case 'number':
                    if (!is_numeric($value)) {
                        continue 2;
                    }
                    break;
            }

            // Store with field_ prefix
            $saveKey = 'field_' . $id;
            $customFieldsData[$saveKey] = $value;
        }

        return $customFieldsData;
    }

    /**
     * Get custom fields with caching
     *
     * @return array
     */
    private function getCustomFields()
    {
        $cacheKey = 'deal_' . $this->company->id;

        if (!isset(self::$customFieldsCache[$cacheKey])) {
            $customFieldsGroupsId = \App\Models\CustomFieldGroup::where('model', 'App\Models\Deal')
                ->where('company_id', $this->company?->id)
                ->select('id')
                ->first();

            if (!$customFieldsGroupsId) {
                self::$customFieldsCache[$cacheKey] = [];
                return [];
            }

            // Store as array to avoid serialization issues with Collections
            $customFields = \App\Models\CustomField::where('custom_field_group_id', $customFieldsGroupsId->id)
                ->select('id', 'label', 'type', 'values')
                ->get()
                ->toArray();

            self::$customFieldsCache[$cacheKey] = $customFields;
        }

        return self::$customFieldsCache[$cacheKey];
    }
    
    /**
     * Prepare marketing fields data for the lead
     *
     * @return array
     */
    private function prepareMarketingData()
    {
        $marketingData = [];
        
        // Map of column names to marketing field names
        $marketingFields = [
            'utm_source' => 'utm_source',
            'utm_medium' => 'utm_medium',
            'utm_campaign' => 'utm_campaign',
            'utm_term' => 'utm_term',
            'utm_content' => 'utm_content',
            'utm_audience' => 'utm_audience',
            'traffic_source_id' => 'traffic_source_id',
            'facebook_click_id' => 'facebook_click_id',
            'facebook_lead_id' => 'facebook_lead_id',
            'has_registered_for_the_webinar' => 'has_registered_for_the_webinar',
            'has_joined_the_facebook_group' => 'has_joined_the_facebook_group',
            'has_downloaded_the_ebook' => 'has_downloaded_the_ebook',
            'has_attended_the_webinar' => 'has_attended_the_webinar',
            'registered_for_zoom_meeting' => 'registered_for_zoom_meeting',
            'last_webinar_date' => 'last_webinar_date',
            'contact_score' => 'contact_score',
        ];
        
        foreach ($marketingFields as $columnName => $fieldName) {
            if ($this->isColumnExists($columnName)) {
                $value = $this->getColumnValue($columnName);
                
                // Skip if value is null or empty
                if ($value === null || $value === '') {
                    continue;
                }
                
                // Handle boolean fields
                if (in_array($fieldName, [
                    'has_registered_for_the_webinar',
                    'has_joined_the_facebook_group',
                    'has_downloaded_the_ebook',
                    'has_attended_the_webinar',
                    'registered_for_zoom_meeting'
                ])) {
                    $value = in_array(strtolower($value), ['yes', '1', 'true', 'on']) ? 1 : 0;
                }
                
                // Handle date field
                if ($fieldName === 'last_webinar_date') {
                    try {
                        $value = \Carbon\Carbon::parse($value)->format('Y-m-d');
                    } catch (\Exception $e) {
                        continue;
                    }
                }
                
                // Handle integer field
                if ($fieldName === 'contact_score') {
                    $value = is_numeric($value) ? (int) $value : 0;
                }
                
                $marketingData[$fieldName] = $value;
            }
        }
        
        return $marketingData;
    }
    
    /**
     * Find or create agent by name (optimized with caching)
     * Converts name to email using company email convention
     *
     * @param string $name
     * @return int|null
     */
    private function findOrCreateAgent($name)
    {
        if (empty($name)) {
            return null;
        }
        
        $name = trim($name);
        
        // Check cache first
        $cacheKey = $this->company->id . '_' . strtolower($name);
        if (isset(self::$leadAgentsCache[$cacheKey])) {
            return self::$leadAgentsCache[$cacheKey];
        }
        
        // Check if it's already an email
        if (filter_var($name, FILTER_VALIDATE_EMAIL)) {
            $email = $name;
        } else {
            // Convert name to email using convention
            $email = $this->nameToEmail($name);
        }
        
        if (!$email) {
            self::$leadAgentsCache[$cacheKey] = null;
            return null;
        }
        
        // Check user cache
        $userCacheKey = $this->company->id . '_' . $email;
        if (!isset(self::$usersCache[$userCacheKey])) {
            $user = \App\Models\User::withoutGlobalScopes()
                ->where('email', $email)
                ->where('company_id', $this->company?->id)
                ->first();
            self::$usersCache[$userCacheKey] = $user;
        } else {
            $user = self::$usersCache[$userCacheKey];
        }
        
        if (!$user) {
            self::$leadAgentsCache[$cacheKey] = null;
            return null;
        }
        
        // Find or create LeadAgent record
        $leadAgent = \App\Models\LeadAgent::withoutGlobalScopes()
            ->where('user_id', $user->id)
            ->where('company_id', $this->company?->id)
            ->first();
        
        if (!$leadAgent) {
            // Wrap LeadAgent creation in transaction
            $leadAgent = DB::transaction(function () use ($user) {
                $leadAgent = new \App\Models\LeadAgent();
                $leadAgent->user_id = $user->id;
                $leadAgent->company_id = $this->company?->id;
                $leadAgent->status = 'active';
                $leadAgent->added_by = user()?->id;
                $leadAgent->save();
                
                return $leadAgent;
            });
        }
        
        self::$leadAgentsCache[$cacheKey] = $leadAgent->id;
        return $leadAgent->id;
    }
    
    /**
     * Convert name to email using HIBARR email convention
     * 
     * Rules:
     * - General format: firstname.initialoflastname@hibarr.de
     *   Example: "John Doe" -> "john.d@hibarr.de"
     * - Exception: "Rabih Rabea" -> "r.r@hibarr.de"
     * - Exception: "Shirin" -> "shirin@hibarr.de"
     *
     * @param string $name
     * @return string|null
     */
    private function nameToEmail($name)
    {
        if (empty($name)) {
            return null;
        }
        
        $domain = 'hibarr.de';
        
        // Clean the name
        $name = trim($name);
        $nameLower = strtolower($name);
        
        // Special case: Rabih Rabea
        if (preg_match('/^rabih\s+rabea$/i', $name)) {
            return 'r.r@' . $domain;
        }
        
        // Special case: Shirin (single name)
        if (preg_match('/^shirin$/i', $name)) {
            return 'shirin@' . $domain;
        }
        
        // Split name into parts
        $nameParts = preg_split('/\s+/', $name);
        $nameParts = array_filter($nameParts); // Remove empty parts
        
        if (empty($nameParts)) {
            return null;
        }
        
        // Single name: use it as is
        if (count($nameParts) === 1) {
            $username = strtolower($nameParts[0]);
            // Remove special characters
            $username = preg_replace('/[^a-z0-9]/', '', $username);
            return empty($username) ? null : $username . '@' . $domain;
        }
        
        // Multiple names: firstname.initialoflastname
        $firstName = strtolower($nameParts[0]);
        $lastName = strtolower($nameParts[count($nameParts) - 1]);
        
        // Clean first name
        $firstName = preg_replace('/[^a-z0-9]/', '', $firstName);
        
        // Get initial of last name
        $lastNameInitial = substr($lastName, 0, 1);
        
        if (empty($firstName) || empty($lastNameInitial)) {
            return null;
        }
        
        return $firstName . '.' . $lastNameInitial . '@' . $domain;
    }
    
    /**
     * Prepare Hibarr custom fields data for the deal
     *
     * @return array
     */
    private function prepareHibarrFieldsData()
    {
        $hibarrFieldsData = [];
        
        // Map of column names to Hibarr field names
        $hibarrFields = [
            'interested_in' => 'interested_in',
            'motivation_comment' => 'motivation/comment',
            'purchase_timeline' => 'purchase_timeline',
            'budget_range' => 'budget_range',
            'strategy_meeting_booked' => 'strategy_meeting_booked',
            'downpayment_paid' => 'downpayment_paid',
            'inspection_trip_date' => 'inspection_trip_date',
            'deposit_confirmation' => 'deposit_confirmation',
            'reservation_agreement' => 'reservation_agreement',
        ];
        
        foreach ($hibarrFields as $columnName => $fieldName) {
            if ($this->isColumnExists($columnName)) {
                $value = $this->getColumnValue($columnName);
                
                // Skip if value is null or empty
                if ($value === null || $value === '') {
                    continue;
                }
                
                // Handle array fields (interested_in, motivation/comment, purchase_timeline, budget_range)
                if (in_array($fieldName, [
                    'interested_in',
                    'motivation/comment',
                    'purchase_timeline',
                    'budget_range'
                ])) {
                    // Convert string to array if needed
                    if (is_string($value)) {
                        // Support comma, semicolon, or pipe separated values
                        $value = str_replace([';', '|'], ',', $value);
                        $value = array_map('trim', explode(',', $value));
                        $value = array_filter($value); // Remove empty values
                    }
                }
                
                // Handle boolean fields
                if (in_array($fieldName, [
                    'strategy_meeting_booked',
                    'downpayment_paid'
                ])) {
                    $value = in_array(strtolower($value), ['yes', '1', 'true', 'on', 'booked', 'paid']) ? 1 : 0;
                }
                
                // Handle date field
                if ($fieldName === 'inspection_trip_date') {
                    try {
                        $value = \Carbon\Carbon::parse($value)->format('Y-m-d');
                    } catch (\Exception $e) {
                        continue;
                    }
                }
                
                $hibarrFieldsData[$fieldName] = $value;
            }
        }
        
        return $hibarrFieldsData;
    }

}

