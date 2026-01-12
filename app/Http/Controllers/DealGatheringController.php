<?php

namespace App\Http\Controllers;

use App\Http\Controllers\AccountBaseController;
use App\Services\DealGatheringService;
use Illuminate\Http\Request;
use App\Models\Lead;
use App\Models\Deal;
use App\Enums\DealUpdateType;
use Illuminate\Validation\Rules\Enum;

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
            'lead_type' => 'nullable|in:agent,client'
        ]);

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

        // Create or return existing deal
        $deal = $existingDeal ?? $this->service->initializeDeal($lead);

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
        $request->validate([
            'type' => ['required', new Enum(DealUpdateType::class)],
            'data' => 'required|array',
        ]);

        $deal = Deal::findOrFail($id);

        $updatedDeal = $this->service->updateDealInline(
            $deal,
            DealUpdateType::from($request->type),
            $request->data
        );

        return response()->json([
            'status' => 'success',
            'data' => $updatedDeal->fresh(['contact', 'hibarrFields', 'leadAgent', 'addedBy', 'leadSource', 'category', 'leadStage', 'pipeline', 'packages', 'products', 'dealWatchers']),
        ]);
    }
}
