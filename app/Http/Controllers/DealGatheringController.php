<?php

namespace App\Http\Controllers;

use App\Http\Controllers\AccountBaseController;
use App\Services\DealGatheringService;
use Illuminate\Http\Request;
use App\Models\Lead;
use App\Models\Deal;
use App\Enums\DealUpdateType;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Support\Facades\Log;
use App\Helper\Files;

class DealGatheringController extends AccountBaseController
{
    protected $service;

    public function __construct(DealGatheringService $service)
    {
        parent::__construct();
        $this->service = $service;
    }

    /**
     * Step 1: Initialize Deal (Search/Create Lead & Create Deal)
     * Also handles updating existing deal's lead association
     */
    public function init(Request $request)
    {
        $request->validate([
            'deal_id' => 'nullable|exists:deals,id',
            'lead_id' => 'nullable|exists:leads,id',
            'lead_data' => 'nullable|array',
            'lead_type' => 'nullable|in:agent,client',
            'pipeline_id' => 'nullable|exists:lead_pipelines,id',
        ]);

        // Get the pipeline ID from the request (for new deal creation)
        $pipelineId = $request->filled('pipeline_id') ? (int) $request->pipeline_id : null;

        // Determine if we're updating an existing deal or creating new
        $existingDeal = $request->filled('deal_id') 
            ? Deal::findOrFail($request->deal_id) 
            : null;

        // Get or create the lead
        if ($request->filled('lead_id')) {
            // Using an existing lead (either same or different from current)
            $lead = Lead::findOrFail($request->lead_id);
            
            // If updating an existing deal with a different lead
            if ($existingDeal && $existingDeal->lead_id !== $lead->id) {
                $existingDeal = $this->service->updateDealLead($existingDeal, $lead);
            }
        } else if ($request->filled('lead_data')) {
            // Creating new lead or updating existing lead's info
            $rules = [
                'lead_data.name' => 'required|string',
                'lead_data.email' => 'nullable|email',
                'lead_data.phone' => 'nullable|string',
            ];

            if ($request->lead_type === 'agent') {
                $rules['lead_data.company_name'] = 'required|string';
            }

            $request->validate($rules);
            
            // If we have an existing deal, update its lead; otherwise create new
            if ($existingDeal) {
                $lead = $this->service->updateLead($existingDeal->lead_id, $request->lead_data);
                // Update deal name to match updated lead info
                $existingDeal->update(['name' => 'New Deal - ' . $lead->client_name]);
            } else {
                $lead = $this->service->createLead($request->lead_data);
            }
        } else {
            // No lead_id and no lead_data - this shouldn't happen for new deals
            if (!$existingDeal) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Lead information is required'
                ], 422);
            }
            // For existing deals with no changes, just return current state
            $lead = Lead::findOrFail($existingDeal->lead_id);
        }

        // Create or return existing deal (passing pipeline_id for new deals)
        $deal = $existingDeal ?? $this->service->initializeDeal($lead, $pipelineId);

        return response()->json([
            'status' => 'success',
            'deal' => $deal->fresh(),
            'lead' => $lead->fresh()
        ]);
    }

    /**
     * Get Steps configuration
     */
    public function getSteps()
    {
        $steps = $this->service->getSteps();
        
        return response()->json([
            'steps' => $steps
        ]);
    }
    
    /**
     * Search Leads
     */
    public function searchLeads(Request $request)
    {
        $query = $request->get('query');
        $leads = $this->service->searchLeads($query);
        return response()->json($leads);
    }

    /**
     * Update Deal Step (Custom fields)
     */
    public function updateStep(Request $request, $id)
    {
        $deal = Deal::findOrFail($id);
        
        // This relies on CustomFieldsTrait
        if ($request->has('custom_fields_data')) {
            $deal->updateCustomFieldData($request->input('custom_fields_data'));
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * Get Deal's Custom Fields Data
     */
    public function getDealCustomFields($id)
    {
        $deal = Deal::findOrFail($id);
        $customFieldsData = $deal->getCustomFieldsData();

        return response()->json([
            'status' => 'success',
            'custom_fields_data' => $customFieldsData
        ]);
    }

    /**
     * Inline update for deal fields
     */
    public function updateInline(Request $request, $id)
    {
        try {
            // Check if type is present
            $type = $request->input('type');
            
            if (!$type) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'The type field is required.',
                ], 422);
            }

            // Validate type
            $request->merge(['type' => $type]);
            $request->validate([
                'type' => ['required', new Enum(DealUpdateType::class)],
            ]);

            $deal = Deal::findOrFail($id);

            // Process data to handle file uploads
            $data = [];
            
            // Method 1: Check if data is already parsed as an array (normal case)
            if ($request->has('data')) {
                if (is_array($request->data)) {
                    $data = $request->data;
                }
            }
            
            // Method 2: Check for files using dot notation (data.fieldName)
            // Laravel parses FormData with brackets as dot notation
            $allFiles = $request->allFiles();
            foreach ($allFiles as $key => $file) {
                if (strpos($key, 'data.') === 0) {
                    $fieldName = substr($key, 5); // Remove "data." prefix
                    $data[$fieldName] = $file;
                }
            }
            
            // Method 3: Also check direct file access with hasFile
            // Try common hibarr field names
            $hibarrFileFields = ['reservation_agreement', 'sales_contract'];
            foreach ($hibarrFileFields as $fieldName) {
                if ($request->hasFile("data.{$fieldName}")) {
                    $data[$fieldName] = $request->file("data.{$fieldName}");
                }
            }
            
            // Method 4: For non-file data, check all input
            foreach ($request->all() as $key => $value) {
                // Skip if it's already in data or if it's a file
                if (isset($data[$key]) || $value instanceof \Illuminate\Http\UploadedFile) {
                    continue;
                }
                
                // Check for data[fieldName] pattern
                if (preg_match('/^data\[(.+)\]$/', $key, $matches)) {
                    $fieldName = $matches[1];
                    $data[$fieldName] = $value;
                }
            }
            
            // Validate that we have some data
            if (empty($data)) {
                Log::error('DealGatheringController: No data extracted', [
                    'type' => $type,
                    'has_files' => !empty($request->allFiles()),
                ]);
                
                return response()->json([
                    'status' => 'error',
                    'message' => 'No data provided. Please check the request format.'
                ], 422);
            }

        // Get regular data values
        $data = $request->input('data', []);
        
        // Merge file uploads into data array for custom field file uploads
        // Files uploaded as data[field_X] or data[field_X][0], [1], etc. for multiple
        if ($request->hasFile('data')) {
            $dataFiles = $request->file('data');
            if (is_array($dataFiles)) {
                foreach ($dataFiles as $fieldKey => $fileOrFiles) {
                    if ($fileOrFiles instanceof \Illuminate\Http\UploadedFile) {
                        // Single file
                        $data[$fieldKey] = $fileOrFiles;
                    } elseif (is_array($fileOrFiles)) {
                        // Multiple files - array of UploadedFile objects
                        $uploadedFiles = [];
                        foreach ($fileOrFiles as $file) {
                            if ($file instanceof \Illuminate\Http\UploadedFile) {
                                $uploadedFiles[] = $file;
                            }
                        }
                        if (!empty($uploadedFiles)) {
                            $data[$fieldKey] = $uploadedFiles;
                        }
                    }
                }
            }
        }

        $updatedDeal = $this->service->updateDealInline(
            $deal,
            DealUpdateType::from($request->type),
            $data
        );

            // Refresh deal with all relationships and custom fields data
            $freshDeal = $updatedDeal->fresh(['contact', 'hibarrFields', 'leadAgent.user', 'addedBy', 'leadSource', 'category', 'leadStage', 'pipeline', 'packages', 'products', 'dealWatchers', 'dealParticipants']);
            $freshDeal->withCustomFields();

            return response()->json([
                'status' => 'success',
                'data' => $freshDeal,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('DealGatheringController: Exception', [
                'message' => $e->getMessage(),
                'type' => $request->input('type'),
            ]);
            return response()->json([
                'status' => 'error',
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper function to convert human-readable size to bytes
     */
    private function returnBytes($val)
    {
        return Files::returnBytes($val);
    }
}
