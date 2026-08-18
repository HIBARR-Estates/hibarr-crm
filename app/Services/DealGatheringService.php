<?php

namespace App\Services;

use App\Enums\DealUpdateType;
use App\Helper\Files;
use App\Models\Currency;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Package;
use App\Models\Product;
use App\Models\Property;
use App\Models\User;
use App\Support\LeadSearchQuery;

class DealGatheringService
{
    protected DealNotificationService $notificationService;

    protected DealAutomationService $dealAutomationService;

    protected DealValueResolver $dealValueResolver;

    protected FileStorageService $fileStorageService;

    protected PipelineScopeResolverService $scopeResolver;

    protected PackagePipelineRouterService $packageRouter;

    public function __construct(
        DealNotificationService $notificationService,
        DealAutomationService $dealAutomationService,
        DealValueResolver $dealValueResolver,
        FileStorageService $fileStorageService,
        PipelineScopeResolverService $scopeResolver,
        PackagePipelineRouterService $packageRouter
    ) {
        $this->notificationService = $notificationService;
        $this->dealAutomationService = $dealAutomationService;
        $this->dealValueResolver = $dealValueResolver;
        $this->fileStorageService = $fileStorageService;
        $this->scopeResolver = $scopeResolver;
        $this->packageRouter = $packageRouter;
    }

    /**
     * Search for existing leads
     */
    public function searchLeads($query)
    {
        return Lead::query()
            ->where(function ($leadQuery) use ($query) {
                $term = '%'.$query.'%';
                $leadQuery->where('client_name', 'like', $term)
                    ->orWhere('client_email', 'like', $term)
                    ->orWhere('company_name', 'like', $term);
                LeadSearchQuery::applyMobileMatch($leadQuery, $query);
            })
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

        if (! empty($data['referral'])) {
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
            'name' => 'New Deal - '.$newLead->client_name,
        ]);

        return $deal;
    }

    /**
     * Initialize a Deal for a Lead
     *
     * @param  Lead  $lead  The lead to associate with the deal
     * @param  int|null  $pipelineId  Optional pipeline ID. If null, uses default pipeline.
     */
    public function initializeDeal(Lead $lead, ?int $pipelineId = null)
    {
        $dealName = 'New Deal - '.$lead->client_name;

        // Get the pipeline ID: use provided, or fall back to default
        $leadPipelineId = $pipelineId;
        if (! $leadPipelineId) {
            $defaultPipeline = \App\Models\LeadPipeline::where('default', 1)->first();
            $leadPipelineId = $defaultPipeline?->id ?? 1;
        }

        // Get the first stage for the selected pipeline
        $firstStage = \App\Models\PipelineStage::where('lead_pipeline_id', $leadPipelineId)
            ->orderBy('priority', 'asc')
            ->first();
        $pipelineStageId = $firstStage?->id ?? 1;

        $agentId = app(DealAgentAssignmentService::class)->resolveAgentId(
            null,
            $lead->lead_owner ? (int) $lead->lead_owner : null,
            user()?->id,
            $lead->category_id ? (int) $lead->category_id : null
        );

        $deal = Deal::create([
            'lead_id' => $lead->id,
            'name' => $dealName,
            'lead_pipeline_id' => $leadPipelineId,
            'pipeline_stage_id' => $pipelineStageId,
            'agent_id' => $agentId,
            'value' => 0,
            'manual_value' => 0,
            'calculated_value' => 0,
            'value_source' => DealValueResolver::SOURCE_CALCULATED,
            'added_by' => user()->id,
            'close_date' => null,
        ]);

        return $deal;
    }

    /**
     * Get dynamic steps based on Custom Field Categories.
     * When $pipelineId is provided, steps are filtered to that pipeline's categories (and optional stage).
     */
    public function getSteps(?int $pipelineId = null, ?int $stageId = null)
    {
        return $this->scopeResolver->getStepsForPipeline($pipelineId, $stageId);
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
                    'note', 'next_follow_up', 'status', 'currency_id',
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
                if (isset($cleanData['manual_value']) && ! array_key_exists('value_source', $data)) {
                    $cleanData['value_source'] = 'manual';
                }

                if (array_key_exists('value_source', $cleanData)) {
                    $cleanData['value_source'] = $this->dealValueResolver->normalizeSource($cleanData['value_source']);
                }

                if (! empty($cleanData)) {
                    $deal->update($cleanData);
                    $this->dealValueResolver->resolveAndPersist($deal->fresh());
                }

                // Handle relationships
                if (array_key_exists('product_id', $data)) {
                    $oldProductIds = $deal->products()->pluck('products.id')->map(fn ($id) => (int) $id)->all();
                    $newProductIds = array_values(array_unique(array_map(
                        'intval',
                        is_array($data['product_id']) ? $data['product_id'] : [$data['product_id']],
                    )));

                    $deal->products()->sync($newProductIds);
                    $deal = $deal->fresh(['products', 'packages', 'company']);
                    $this->dealValueResolver->resolveAndPersist($deal);

                    $addedProductIds = array_diff($newProductIds, $oldProductIds);
                    $removedProductIds = array_diff($oldProductIds, $newProductIds);

                    if ($addedProductIds !== [] || $removedProductIds !== []) {
                        $changedProducts = Product::with('property')
                            ->whereIn('id', array_merge($addedProductIds, $removedProductIds))
                            ->get()
                            ->keyBy('id');

                        foreach ($addedProductIds as $productId) {
                            $product = $changedProducts->get($productId);
                            if ($product?->property) {
                                $this->notificationService->notifyPropertyLinked(
                                    $deal,
                                    $this->propertyLabel($product->property, $product),
                                    (int) $product->property->id,
                                );
                            }
                        }

                        foreach ($removedProductIds as $productId) {
                            $product = $changedProducts->get($productId);
                            if ($product?->property) {
                                $this->notificationService->notifyPropertyUnlinked(
                                    $deal,
                                    $this->propertyLabel($product->property, $product),
                                    (int) $product->property->id,
                                );
                            }
                        }
                    }
                }

                if (array_key_exists('package_id', $data)) {
                    $currentPackageIds = $deal->packages()->pluck('packages.id')->toArray();
                    $oldPackageNames = Package::whereIn('id', $currentPackageIds)->pluck('name', 'id')->toArray();

                    $newPackageIds = $this->packageRouter->normalizePackageIds($data['package_id'], $deal->company_id);
                    $newPackageIds = Package::query()
                        ->where('company_id', $deal->company_id)
                        ->whereIn('id', $newPackageIds)
                        ->pluck('id')
                        ->map(fn ($id) => (int) $id)
                        ->all();

                    // Detect added and removed packages
                    $addedPackageIds = array_diff($newPackageIds, $currentPackageIds);
                    $removedPackageIds = array_diff($currentPackageIds, $newPackageIds);

                    // Sync packages
                    $deal->packages()->sync($newPackageIds);
                    $newPackageNames = Package::whereIn('id', $newPackageIds)->pluck('name', 'id')->toArray();

                    // Send notifications for package changes
                    if (! empty($addedPackageIds)) {
                        $addedNames = array_values(array_filter(array_map(fn ($id) => $newPackageNames[$id] ?? null, $addedPackageIds)));
                        if (! empty($addedNames)) {
                            $this->notificationService->notifyPackageAssigned($deal, $addedNames);
                        }
                    }

                    if (! empty($removedPackageIds)) {
                        $removedNames = array_values(array_filter(array_map(fn ($id) => $oldPackageNames[$id] ?? null, $removedPackageIds)));
                        if (! empty($removedNames)) {
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

                    $this->packageRouter->routeDeal($deal->fresh(['packages']));
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

                    $this->notificationService->notifyWatchersChanged($deal, $oldWatcherIds, $newWatcherIds);
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

                    $this->notificationService->notifyParticipantsChanged($deal, $oldParticipantIds, $newParticipantIds);
                }

                $this->attemptFieldTriggerRouting($deal, $data);
                break;

            case DealUpdateType::CONTACT:
                $allowedContactFields = [
                    'client_name', 'client_email', 'mobile', 'cell', 'office',
                    'company_name', 'salutation', 'gender', 'address',
                    'postal_code', 'city', 'state', 'country', 'source_id',
                    'nationality', 'occupation', 'date_of_birth', 'age', 'languages',
                ];
                $contactData = array_intersect_key($data, array_flip($allowedContactFields));
                if (! empty($contactData) && $deal->contact) {
                    $promotedFields = ['nationality', 'occupation', 'date_of_birth', 'age', 'languages'];
                    $promotedData = array_intersect_key($contactData, array_flip($promotedFields));
                    $regularData = array_diff_key($contactData, array_flip($promotedFields));

                    if (! empty($regularData)) {
                        $deal->contact->update($regularData);
                    }

                    if (! empty($promotedData)) {
                        /** @var \App\Services\LeadCoreFieldsService $coreFields */
                        $coreFields = app(\App\Services\LeadCoreFieldsService::class);
                        if ($coreFields->useCoreFields()) {
                            $coreFields->write($deal->contact, $promotedData);
                            $deal->contact->save();
                        } else {
                            $deal->contact->update($promotedData);
                        }
                    }
                }
                break;

            case DealUpdateType::LEAD_CUSTOM_FIELD:
                if ($deal->contact) {
                    $deal->contact->updateCustomFieldData($data);
                }
                break;

            case DealUpdateType::CUSTOM_FIELD:
                // Handle dynamic custom fields
                // Data should be key-value pairs of field_id => value
                $deal->updateCustomFieldData($data);
                // Trigger deal automation for custom field updates
                // This is needed because updating custom fields doesn't trigger the Deal model's observer
                $this->dealAutomationService->process($deal, 'deal_updated');
                $this->attemptFieldTriggerRouting($deal, $data);
                break;

            case DealUpdateType::HIBARR_FIELD:
                // Handle Hibarr specific fields
                // Process file uploads for document slots (external storage + legacy fallback).
                $hibarrData = [];
                $fileFields = [
                    'deposit_confirmation',
                    'reservation_agreement',
                    'sales_contract',
                ];

                foreach ($data as $key => $value) {
                    if (in_array($key, $fileFields) && $value instanceof \Illuminate\Http\UploadedFile) {
                        // Get existing file to delete if exists
                        $existingFields = $deal->hibarrFields;
                        if ($existingFields && $existingFields->{$key}) {
                            $this->deleteHibarrFieldFile($existingFields->{$key});
                        }
                        // Upload new file via the external FileStorageService (matches
                        // CustomFieldsTrait's file-type custom fields), falling back to
                        // legacy local/S3 storage if the external service is unavailable.
                        try {
                            $result = $this->fileStorageService->upload($value, 'hibarr_fields');
                            $hibarrData[$key] = $result['downloadUrl'];
                        } catch (\Exception $e) {
                            \Log::error('Hibarr field file upload failed', [
                                'error' => $e->getMessage(),
                                'field' => $key,
                            ]);
                            $hibarrData[$key] = Files::uploadLocalOrS3($value, 'hibarr_fields');
                        }
                    } elseif (in_array($key, $fileFields) && ($value === '' || $value === null)) {
                        // Handle file deletion (empty string or null)
                        $existingFields = $deal->hibarrFields;
                        if ($existingFields && $existingFields->{$key}) {
                            $this->deleteHibarrFieldFile($existingFields->{$key});
                        }
                        $hibarrData[$key] = null;
                    } elseif ($key === 'budget_range' && is_array($value)) {
                        // budget_range is a currency-range field ({min,max,currency})
                        // but the column is a plain string — clamp and store as JSON,
                        // same convention as CustomFieldsTrait's currency/range types.
                        $min = isset($value['min']) && is_numeric($value['min']) ? max(0, (float) $value['min']) : null;
                        $max = isset($value['max']) && is_numeric($value['max']) ? max(0, (float) $value['max']) : null;
                        if ($min !== null && $max !== null) {
                            [$min, $max] = [min($min, $max), max($min, $max)];
                        }
                        $hibarrData[$key] = json_encode([
                            'min' => $min,
                            'max' => $max,
                            'currency' => is_string($value['currency'] ?? null) ? $value['currency'] : null,
                        ]);
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

    /**
     * Delete a hibarr field file, handling both external URLs (FileStorageService)
     * and legacy local/S3 files — same approach as CustomFieldsTrait::deleteCustomFieldFile().
     */
    private function deleteHibarrFieldFile(string $fileRef): void
    {
        if (empty($fileRef)) {
            return;
        }

        if (FileStorageService::isExternalUrl($fileRef)) {
            $objectPath = FileStorageService::extractObjectPathFromUrl($fileRef);
            if ($objectPath) {
                try {
                    $this->fileStorageService->delete($objectPath);
                } catch (\Exception $e) {
                    \Log::warning('Failed to delete external hibarr field file', [
                        'url' => $fileRef,
                        'objectPath' => $objectPath,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        } else {
            Files::deleteFile($fileRef, 'hibarr_fields');
        }
    }

    /**
     * Route package pipeline when field triggers match, for dynamic gathering.
     */
    protected function attemptFieldTriggerRouting(Deal $deal, array $data): void
    {
        $fieldCatalog = app(PackageRoutingFieldCatalog::class);
        $packageExplicitlySelected = array_key_exists('package_id', $data) && $data['package_id'];
        $routingFieldKeys = $fieldCatalog->routingFieldKeysFromPayload($data, $deal->company_id);

        if ($routingFieldKeys === []) {
            return;
        }

        $routed = $this->packageRouter->attemptRoutingFromDealState(
            $deal->fresh(['products', 'packages', 'company']),
            $routingFieldKeys,
            $packageExplicitlySelected,
        );

        // If triggers matched and synced a package but pipeline routing was skipped
        // (e.g. already on the target pipeline), still attempt a route when exactly
        // one package is linked.
        if (! $routed && ! $packageExplicitlySelected) {
            $deal = $deal->fresh(['packages', 'company']);
            if ($deal->packages->count() === 1) {
                $this->packageRouter->routeDeal($deal);
            }
        }
    }

    private function propertyLabel(?Property $property, Product $product): string
    {
        $label = trim((string) ($property?->title ?? $property?->reference_code ?? $product->name ?? ''));

        return $label !== '' ? $label : 'Property';
    }
}
