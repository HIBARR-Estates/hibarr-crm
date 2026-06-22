<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadPipeline;
use App\Models\Package;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\Currency;
use Illuminate\Support\Str;
use App\Enums\DealUpdateType;
use Illuminate\Support\Facades\DB;

class DealGatheringService
{
    protected DealNotificationService $notificationService;
    protected DealAutomationService $dealAutomationService;
    protected DealValueResolver $dealValueResolver;

    public function __construct(
        DealNotificationService $notificationService,
        DealAutomationService $dealAutomationService,
        DealValueResolver $dealValueResolver
    ) {
        $this->notificationService = $notificationService;
        $this->dealAutomationService = $dealAutomationService;
        $this->dealValueResolver = $dealValueResolver;
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
        return Lead::create($this->mapLeadDataFromRequest($data));
    }

    /**
     * Update an existing Lead
     */
    public function updateLead(int $leadId, array $data)
    {
        $lead = Lead::findOrFail($leadId);
        $lead->update($this->mapLeadDataFromRequest($data, $lead));

        return $lead;
    }

    /**
     * Map deal-gathering lead_data payload to Lead model attributes.
     */
    private function mapLeadDataFromRequest(array $data, ?Lead $existing = null): array
    {
        // IMPORTANT: Don't pass 'note' as null, because the Lead model has a note() relationship
        // and ApiModel's fill() treats null values for methods as relationship clearing,
        // which causes it to set the relationship's foreign key (lead_id) on this model
        $leadData = [
            'client_name' => $data['name'] ?? $existing?->client_name,
            'company_name' => $data['company_name'] ?? $existing?->company_name,
            'client_email' => $data['email'] ?? $existing?->client_email,
            'mobile' => $data['phone'] ?? $existing?->mobile,
            'added_by' => $existing?->added_by ?? user()->id,
            'lead_owner' => $existing?->lead_owner ?? user()->id,
        ];

        $optionalFields = [
            'salutation' => 'salutation',
            'gender' => 'gender',
            'address' => 'address',
            'postal_code' => 'postal_code',
            'city' => 'city',
            'state' => 'state',
            'country' => 'country',
        ];

        foreach ($optionalFields as $inputKey => $modelKey) {
            if (array_key_exists($inputKey, $data)) {
                $leadData[$modelKey] = $data[$inputKey] ?: null;
            } elseif ($existing) {
                $leadData[$modelKey] = $existing->{$modelKey};
            }
        }

        if (array_key_exists('lead_source_id', $data)) {
            $leadData['source_id'] = $data['lead_source_id'] ?: null;
        } elseif ($existing) {
            $leadData['source_id'] = $existing->source_id;
        }

        if (!empty($data['referral'])) {
            $leadData['note'] = $data['referral'];
        } elseif ($existing) {
            $leadData['note'] = $existing->note;
        }

        return $leadData;
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
     * 
     * @param Lead $lead The lead to associate with the deal
     * @param int|null $pipelineId Optional pipeline ID. If null, uses default pipeline.
     */
    public function initializeDeal(Lead $lead, ?int $pipelineId = null)
    {
        $dealName = 'New Deal - ' . $lead->client_name;
        
        // Get the pipeline ID: use provided, or fall back to default
        $leadPipelineId = $pipelineId;
        if (!$leadPipelineId) {
            $defaultPipeline = \App\Models\LeadPipeline::where('default', 1)->first();
            $leadPipelineId = $defaultPipeline?->id ?? 1;
        }

        // Get the first stage for the selected pipeline
        $firstStage = \App\Models\PipelineStage::where('lead_pipeline_id', $leadPipelineId)
            ->orderBy('priority', 'asc')
            ->first();
        $pipelineStageId = $firstStage?->id ?? 1;
        
        $deal = Deal::create([
            'lead_id' => $lead->id,
            'name' => $dealName,
            'lead_pipeline_id' => $leadPipelineId,
            'pipeline_stage_id' => $pipelineStageId,
            'value' => 0,
            'manual_value' => 0,
            'calculated_value' => 0,
            'value_source' => DealValueResolver::SOURCE_CALCULATED,
            'added_by' => user()->id,
            'close_date' => now()->addDays(30),
        ]);

        return $deal;
    }

    /**
     * Get dynamic steps based on Custom Field Categories.
     * When $pipelineId is provided and that pipeline has categories assigned (pivot),
     * only those categories are returned; otherwise all deal categories (backward compatibility).
     *
     * @param int|null $pipelineId Optional. When set, steps are filtered to this pipeline's categories.
     * @return array
     */
    public function getSteps(?int $pipelineId = null)
    {
        $group = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();

        if (!$group) {
            return [];
        }

        $categoriesQuery = CustomFieldCategory::where('custom_field_group_id', $group->id)
            ->where('company_id', company()->id)
            ->orderBy(DB::raw('`order`'), 'asc')
            ->orderBy('id', 'asc');

        // Filter by pipeline's assigned categories when pipeline has any
        if ($pipelineId) {
            $pipeline = LeadPipeline::with('customFieldCategories:id')->find($pipelineId);
            if ($pipeline && $pipeline->customFieldCategories->isNotEmpty()) {
                $categoryIds = $pipeline->customFieldCategories->pluck('id')->toArray();
                $categoriesQuery->whereIn('id', $categoryIds);
            }
        }

        $categories = $categoriesQuery
            ->with(['customFields' => function ($q) {
                $q->orderBy('display_order')
                    ->with([
                        'showRuleSet' => function ($query) {
                            $query->with([
                                'groups' => function ($groupQuery) {
                                    $groupQuery->where('enabled', true)
                                        ->orderBy('id')
                                        ->with('criteria.referenceField');
                                },
                                'group.criteria.referenceField'
                            ]);
                        }
                    ]);
            }])
            ->get();

        return $categories
            ->filter(fn ($category) => $category->customFields->count() > 0)
            ->map(function ($category) {
                return [
                    'id' => $category->id,
                    'title' => $category->name,
                    'fields' => $category->customFields,
                ];
            })
            ->values()
            ->all();
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
                    'name', 'manual_value', 'value_source', 'close_date', 'category_id', 'agent_id', 
                    'lead_id', 'lead_pipeline_id', 'pipeline_stage_id', 
                    'note', 'next_follow_up', 'status', 'currency_id'
                ];
                
                // Handle new currency format: { amount, currency }
                if (array_key_exists('value', $data) && is_array($data['value']) && (isset($data['value']['amount']) || isset($data['value']['currency']))) {
                    // Only update value if amount is explicitly provided
                    if (isset($data['value']['amount']) && $data['value']['amount'] !== null && $data['value']['amount'] !== '') {
                        if (is_numeric($data['value']['amount'])) {
                            $amount = (float) $data['value']['amount'];
                            $cleanData['manual_value'] = $amount;
                        }
                    }
                    // If amount is not provided, don't update the value field (preserve existing value)
                    
                    // Handle currency update
                    $currencyCode = isset($data['value']['currency']) && is_string($data['value']['currency'])
                        ? strtoupper($data['value']['currency'])
                        : null;
                    
                    // Find currency_id from currency_code
                    if ($currencyCode) {
                        $currency = Currency::where('currency_code', $currencyCode)
                            ->where('company_id', $deal->company_id)
                            ->first();
                        
                        if ($currency) {
                            $cleanData['currency_id'] = $currency->id;
                        }
                    }
                    
                    // Process other fillable fields (excluding value and currency_id which we already handled)
                    foreach ($fillable as $field) {
                        if ($field !== 'value' && $field !== 'currency_id' && array_key_exists($field, $data)) {
                            $cleanData[$field] = $data[$field];
                        }
                    }
                } else {
                    // Handle old format or direct value
                    if (array_key_exists('value', $data) && is_numeric($data['value'])) {
                        $cleanData['manual_value'] = (float) $data['value'];
                    }

                    foreach ($fillable as $field) {
                        if (array_key_exists($field, $data)) {
                            $cleanData[$field] = $data[$field];
                        }
                    }
                }

                // When the user explicitly provides a value, treat it as a manual override
                // unless they also explicitly sent a value_source in the same request
                if (isset($cleanData['manual_value']) && !array_key_exists('value_source', $data)) {
                    $cleanData['value_source'] = 'manual';
                }

                if (array_key_exists('value_source', $cleanData)) {
                    $cleanData['value_source'] = $this->dealValueResolver->normalizeSource($cleanData['value_source']);
                }

                if (!empty($cleanData)) {
                    $deal->update($cleanData);
                    $this->dealValueResolver->resolveAndPersist($deal->fresh());
                }

                // Handle relationships
                if (array_key_exists('product_id', $data)) {
                    $deal->products()->sync($data['product_id']);
                    $this->dealValueResolver->resolveAndPersist($deal->fresh());
                }
                
                if (array_key_exists('package_id', $data)) {
                    $currentPackageIds = $deal->packages()->pluck('packages.id')->toArray();
                    $oldPackageNames = Package::whereIn('id', $currentPackageIds)->pluck('name', 'id')->toArray();

                    $newPackageIds = is_array($data['package_id']) ? $data['package_id'] : [$data['package_id']];
                    $newPackageIds = array_filter($newPackageIds); // Remove empty values

                    // Detect added and removed packages
                    $addedPackageIds = array_diff($newPackageIds, $currentPackageIds);
                    $removedPackageIds = array_diff($currentPackageIds, $newPackageIds);

                    // Sync packages
                    $deal->packages()->sync($newPackageIds);
                    $newPackageNames = Package::whereIn('id', $newPackageIds)->pluck('name', 'id')->toArray();

                    // Send notifications for package changes
                    if (!empty($addedPackageIds)) {
                        $addedNames = array_values(array_filter(array_map(fn ($id) => $newPackageNames[$id] ?? null, $addedPackageIds)));
                        if (!empty($addedNames)) {
                            $this->notificationService->notifyPackageAssigned($deal, $addedNames);
                        }
                    }

                    if (!empty($removedPackageIds)) {
                        $removedNames = array_values(array_filter(array_map(fn ($id) => $oldPackageNames[$id] ?? null, $removedPackageIds)));
                        if (!empty($removedNames)) {
                            $this->notificationService->notifyPackageRemoved($deal, $removedNames);
                        }
                    }

                    app(DealActivityEventService::class)->recordPackagesUpdated(
                        $deal,
                        $currentPackageIds,
                        $newPackageIds,
                        $oldPackageNames,
                        $newPackageNames
                    );

                    $this->dealValueResolver->resolveAndPersist($deal->fresh());
                }

                if (array_key_exists('deal_watcher', $data)) {
                    $deal->loadMissing('dealWatchers');
                    $oldWatcherIds = $deal->dealWatchers->pluck('id')->toArray();
                    $oldWatcherNames = $deal->dealWatchers->pluck('name', 'id')->toArray();
                    $newWatcherIds = is_array($data['deal_watcher']) ? $data['deal_watcher'] : [$data['deal_watcher']];
                    $newWatcherIds = array_filter($newWatcherIds);

                    $deal->dealWatchers()->sync($newWatcherIds);
                    $deal->load('dealWatchers');
                    $newWatcherNames = $deal->dealWatchers->pluck('name', 'id')->toArray();

                    app(DealActivityEventService::class)->recordWatchersUpdated(
                        $deal,
                        $oldWatcherIds,
                        $newWatcherIds,
                        $oldWatcherNames,
                        $newWatcherNames
                    );
                }

                if (array_key_exists('deal_participant', $data)) {
                    $deal->loadMissing('dealParticipants');
                    $oldParticipantIds = $deal->dealParticipants->pluck('id')->toArray();
                    $oldParticipantNames = $deal->dealParticipants->pluck('name', 'id')->toArray();
                    $newParticipantIds = is_array($data['deal_participant']) ? $data['deal_participant'] : [$data['deal_participant']];
                    $newParticipantIds = array_filter($newParticipantIds);

                    $deal->dealParticipants()->sync($newParticipantIds);
                    $deal->load('dealParticipants');
                    $newParticipantNames = $deal->dealParticipants->pluck('name', 'id')->toArray();

                    app(DealActivityEventService::class)->recordParticipantsUpdated(
                        $deal,
                        $oldParticipantIds,
                        $newParticipantIds,
                        $oldParticipantNames,
                        $newParticipantNames
                    );
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
                // Trigger deal automation for custom field updates
                // This is needed because updating custom fields doesn't trigger the Deal model's observer
                $this->dealAutomationService->process($deal, 'deal_updated');
                break;

            case DealUpdateType::HIBARR_FIELD:
                // Handle Hibarr specific fields
                // Process file uploads for reservation_agreement and sales_contract
                $hibarrData = [];
                $fileFields = ['reservation_agreement', 'sales_contract'];
                
                foreach ($data as $key => $value) {
                    if (in_array($key, $fileFields) && $value instanceof \Illuminate\Http\UploadedFile) {
                        // Get existing file to delete if exists
                        $existingFields = $deal->hibarrFields;
                        if ($existingFields && $existingFields->{$key}) {
                            Files::deleteFile($existingFields->{$key}, 'hibarr_fields');
                        }
                        // Upload new file
                        $hibarrData[$key] = Files::uploadLocalOrS3($value, 'hibarr_fields');
                    } elseif (in_array($key, $fileFields) && ($value === '' || $value === null)) {
                        // Handle file deletion (empty string or null)
                        $existingFields = $deal->hibarrFields;
                        if ($existingFields && $existingFields->{$key}) {
                            Files::deleteFile($existingFields->{$key}, 'hibarr_fields');
                        }
                        $hibarrData[$key] = null;
                    } else {
                        $hibarrData[$key] = $value;
                    }
                }
                
                $deal->hibarrFields()->updateOrCreate(
                    ['deal_id' => $deal->id],
                    $hibarrData
                );
                // Trigger deal automation for Hibarr field updates
                // This is needed because updating Hibarr fields doesn't trigger the Deal model's observer
                $this->dealAutomationService->process($deal, 'deal_updated');
                break;

            case DealUpdateType::RECALCULATE_VALUE:
                $this->dealValueResolver->resolveAndPersist(
                    $deal->fresh(),
                    null,
                    DealValueResolver::SOURCE_CALCULATED,
                );
                break;
        }

        return $deal->fresh();
    }
}
