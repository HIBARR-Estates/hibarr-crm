<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\Package;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use Illuminate\Support\Str;
use App\Enums\DealUpdateType;
use Illuminate\Support\Facades\DB;

class DealGatheringService
{
    protected DealNotificationService $notificationService;

    public function __construct(DealNotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

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
            ->orderBy(DB::raw('`order`'), 'asc')
            ->orderBy('id', 'asc')
            ->with(['customFields' => function($q) {
                // Order by display_order, don't filter by 'visible' as that's for table display
                $q->orderBy('display_order')
                  ->with([
                      'showRuleSet' => function($query) {
                          // Load rule set with enabled groups and their criteria
                          $query->with([
                              'groups' => function($groupQuery) {
                                  // Only load enabled groups to improve performance
                                  $groupQuery->where('enabled', true)
                                             ->orderBy('id')
                                             ->with('criteria.referenceField');
                              },
                              // Also load single group for backward compatibility
                              'group.criteria.referenceField'
                          ]);
                      }
                  ]);
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

    /**
     * Inline update for deal fields
     */
    public function updateDealInline(Deal $deal, DealUpdateType $type, array $data)
    {
        switch ($type) {
            case DealUpdateType::DETAILS:
                // Handle basic deal details
                $cleanData = [];
                $fillable = [
                    'name', 'value', 'close_date', 'category_id', 'agent_id', 
                    'lead_id', 'lead_pipeline_id', 'pipeline_stage_id', 
                    'note', 'next_follow_up', 'status', 'currency_id'
                ];
                
                foreach ($fillable as $field) {
                    if (array_key_exists($field, $data)) {
                        $cleanData[$field] = $data[$field];
                    }
                }

                if (!empty($cleanData)) {
                    $deal->update($cleanData);
                }

                // Handle relationships
                if (array_key_exists('product_id', $data)) {
                    $deal->products()->sync($data['product_id']);
                }
                
                if (array_key_exists('package_id', $data)) {
                    // Get current and new package IDs
                    $currentPackageIds = $deal->packages()->pluck('packages.id')->toArray();
                    $newPackageIds = is_array($data['package_id']) ? $data['package_id'] : [$data['package_id']];
                    $newPackageIds = array_filter($newPackageIds); // Remove empty values
                    
                    // Detect added and removed packages
                    $addedPackageIds = array_diff($newPackageIds, $currentPackageIds);
                    $removedPackageIds = array_diff($currentPackageIds, $newPackageIds);
                    
                    // Sync packages
                    $deal->packages()->sync($newPackageIds);
                    
                    // Send notifications for package changes
                    if (!empty($addedPackageIds)) {
                        $addedNames = Package::whereIn('id', $addedPackageIds)->pluck('name')->toArray();
                        if (!empty($addedNames)) {
                            $this->notificationService->notifyPackageAssigned($deal, $addedNames);
                        }
                    }
                    
                    if (!empty($removedPackageIds)) {
                        $removedNames = Package::whereIn('id', $removedPackageIds)->pluck('name')->toArray();
                        if (!empty($removedNames)) {
                            $this->notificationService->notifyPackageRemoved($deal, $removedNames);
                        }
                    }
                }

                if (array_key_exists('deal_watcher', $data)) {
                    $deal->dealWatchers()->sync($data['deal_watcher']);
                }
                break;

            case DealUpdateType::CONTACT:
                // Handle contact updates
                $contactData = [];
                if (isset($data['client_email'])) $contactData['client_email'] = $data['client_email'];
                if (isset($data['mobile'])) $contactData['mobile'] = $data['mobile'];
                if (isset($data['company_name'])) $contactData['company_name'] = $data['company_name'];

                if (!empty($contactData) && $deal->contact) {
                    $deal->contact->update($contactData);
                }
                break;

            case DealUpdateType::CUSTOM_FIELD:
                // Handle dynamic custom fields
                // Data should be key-value pairs of field_id => value
                $deal->updateCustomFieldData($data);
                break;

            case DealUpdateType::HIBARR_FIELD:
                // Handle Hibarr specific fields
                $deal->hibarrFields()->updateOrCreate(
                    ['deal_id' => $deal->id],
                    $data
                );
                break;
        }

        return $deal;
    }
}
