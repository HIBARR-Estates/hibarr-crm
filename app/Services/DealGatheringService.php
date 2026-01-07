<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use Illuminate\Support\Str;
use DB;

class DealGatheringService
{
    /**
     * Search for existing leads
     */
    public function searchLeads($query)
    {
        return Lead::where('client_name', 'like', "%{$query}%")
            ->orWhere('client_email', 'like', "%{$query}%")
            ->orWhere('company_name', 'like', "%{$query}%")
            ->limit(10)
            ->get();
    }

    /**
     * Create a new Lead
     */
    public function createLead(array $data)
    {
        // Build the lead data array
        // IMPORTANT: Don't pass 'note' as null, because the Lead model has a note() relationship
        // and ApiModel's fill() treats null values for methods as relationship clearing,
        // which causes it to set the relationship's foreign key (lead_id) on this model
        $leadData = [
            'client_name' => $data['name'] ?? null,
            'company_name' => $data['company_name'] ?? null,
            'client_email' => $data['email'] ?? null,
            'mobile' => $data['phone'] ?? null,
            'added_by' => user()->id,
        ];

        // Only add note if it has a value (to avoid ApiModel treating it as a relationship)
        if (!empty($data['referral'])) {
            $leadData['note'] = $data['referral'];
        }

        return Lead::create($leadData);
    }

    /**
     * Update an existing Lead
     */
    public function updateLead(int $leadId, array $data)
    {
        $lead = Lead::findOrFail($leadId);
        
        $updateData = [
            'client_name' => $data['name'] ?? $lead->client_name,
            'company_name' => $data['company_name'] ?? $lead->company_name,
            'client_email' => $data['email'] ?? $lead->client_email,
            'mobile' => $data['phone'] ?? $lead->mobile,
        ];

        // Only update note if provided and not empty
        if (!empty($data['referral'])) {
            $updateData['note'] = $data['referral'];
        }

        $lead->update($updateData);
        
        return $lead;
    }

    /**
     * Update a Deal's lead association
     */
    public function updateDealLead(Deal $deal, Lead $newLead)
    {
        $deal->update([
            'lead_id' => $newLead->id,
            'name' => 'New Deal - ' . $newLead->client_name,
        ]);
        
        return $deal;
    }

    /**
     * Initialize a Deal for a Lead
     */
    public function initializeDeal(Lead $lead)
    {
        $dealName = 'New Deal - ' . $lead->client_name;
        
        $deal = Deal::create([
            'lead_id' => $lead->id,
            'name' => $dealName,
            'lead_pipeline_id' => 1, // Default pipeline, should probably be dynamic or first available
            'pipeline_stage_id' => 1, // Default stage
            'value' => 0,
            'added_by' => user()->id,
            'close_date' => now()->addDays(30),
        ]);

        return $deal;
    }

    /**
     * Get dynamic steps based on Custom Field Categories
     */
    public function getSteps()
    {
        // Assuming CustomFieldGroup for 'Deal' model contains categories
        // We need to fetch categories associated with Deal model
        
        $group = CustomFieldGroup::where('model', 'App\Models\Deal')->first();

        if (!$group) {
            return [];
        }

        $categories = CustomFieldCategory::where('custom_field_group_id', $group->id)
            ->with(['customFields' => function($q) {
                // Order by display_order, don't filter by 'visible' as that's for table display
                $q->orderBy('display_order');
            }])
            ->get();
            
        // Map to steps - only include categories that have fields
        return $categories
            ->filter(fn($category) => $category->customFields->count() > 0)
            ->map(function($category) {
                return [
                    'id' => $category->id,
                    'title' => $category->name,
                    'fields' => $category->customFields
                ];
            })
            ->values();
    }
}
