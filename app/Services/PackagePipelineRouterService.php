<?php

namespace App\Services;

use App\Enums\DealPackageMode;
use App\Models\Company;
use App\Models\Deal;
use App\Models\LeadPipeline;
use App\Models\Package;
use App\Models\PackagePipeline;
use App\Models\PackageRoutingTrigger;
use App\Models\PipelineStage;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class PackagePipelineRouterService
{
    public function __construct(
        protected PipelineScopeResolverService $scopeResolver,
        protected DealActivityEventService $activityEvents,
        protected PackageRoutingFieldCatalog $fieldCatalog,
    ) {
    }

    public function shouldRoute(Deal $deal): bool
    {
        return $this->getRoutingSkipReason($deal) === null;
    }

    public function getRoutingSkipReason(Deal $deal): ?string
    {
        $deal->loadMissing('company', 'packages');

        if ($deal->is_locked) {
            return 'deal_locked';
        }

        $company = $this->resolveCompany($deal);

        if (!$company) {
            return 'company_not_found';
        }

        if (!$company->package_pipeline_routing_enabled) {
            return 'routing_disabled';
        }

        $packageMode = DealPackageMode::tryFrom($company->deal_package_mode ?? DealPackageMode::Multiple->value)
            ?? DealPackageMode::Multiple;

        if (!$packageMode->allowsPipelineRouting()) {
            return 'multiple_package_mode';
        }

        $packageCount = $deal->packages->count();

        if ($packageCount === 0) {
            return 'no_packages';
        }

        if ($packageCount > 1) {
            return 'multiple_packages';
        }

        $targetPipeline = $this->resolveTargetPipeline($deal->packages, $deal->company_id);

        if (!$targetPipeline) {
            return 'no_package_pipeline_mapping';
        }

        return null;
    }

    protected function resolveCompany(Deal $deal): ?Company
    {
        if ($deal->relationLoaded('company') && $deal->company) {
            return $deal->company;
        }

        if ($deal->company_id) {
            return Company::find($deal->company_id);
        }

        $sessionCompany = company();

        return $sessionCompany instanceof Company ? $sessionCompany : null;
    }

    public function resolveTargetPipeline(Collection $packages, ?int $companyId = null): ?LeadPipeline
    {
        if ($packages->count() !== 1) {
            return null;
        }

        /** @var Package $package */
        $package = $packages->first();

        $mapping = PackagePipeline::query()
            ->where('package_id', $package->id)
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->first();

        if (!$mapping) {
            return null;
        }

        return LeadPipeline::find($mapping->pipeline_id);
    }

    public function resolveTargetStageId(Package $package, int $pipelineId, ?int $companyId = null): ?int
    {
        $mapping = PackagePipeline::query()
            ->where('package_id', $package->id)
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->first();

        if ($mapping?->default_stage_id) {
            $stage = PipelineStage::where('id', $mapping->default_stage_id)
                ->where('lead_pipeline_id', $pipelineId)
                ->first();

            if ($stage) {
                return $stage->id;
            }
        }

        return PipelineStage::where('lead_pipeline_id', $pipelineId)
            ->orderBy('priority', 'asc')
            ->value('id');
    }

    public function routeDeal(Deal $deal): bool
    {
        $deal->loadMissing('company', 'packages');

        $skipReason = $this->getRoutingSkipReason($deal);

        if ($skipReason !== null) {
            Log::debug('Package pipeline routing skipped', [
                'deal_id' => $deal->id,
                'reason' => $skipReason,
            ]);

            return false;
        }

        return $this->routeDealToPackage($deal, $deal->packages->first());
    }

    public function routeDealToPackage(Deal $deal, Package $package): bool
    {
        $deal->loadMissing('company');

        if ($deal->is_locked) {
            return false;
        }

        $company = $this->resolveCompany($deal);

        if (!$company || !$company->package_pipeline_routing_enabled) {
            return false;
        }

        $targetPipeline = $this->resolveTargetPipeline(collect([$package]), $deal->company_id);

        if (!$targetPipeline) {
            return false;
        }

        $targetStageId = $this->resolveTargetStageId($package, $targetPipeline->id, $deal->company_id);

        if ($targetStageId === null) {
            return false;
        }

        $previousPipelineId = (int) $deal->lead_pipeline_id;
        $previousStageId = (int) $deal->pipeline_stage_id;
        $pipelineChanged = $previousPipelineId !== (int) $targetPipeline->id;
        $stageChanged = $previousStageId !== (int) $targetStageId;

        if (!$pipelineChanged && !$stageChanged) {
            return false;
        }

        $deal->lead_pipeline_id = $targetPipeline->id;
        $deal->pipeline_stage_id = $targetStageId;

        // saveQuietly skips DealObserver, which is what stamps the stage dwell
        // clock. DealActivityEventService records the crm_event separately, so
        // only this half was missing.
        if ($stageChanged) {
            $deal->stage_entered_at = now();
        }

        $deal->saveQuietly();

        Log::info('Deal routed to pipeline via package linkage', [
            'deal_id' => $deal->id,
            'package_id' => $package->id,
            'previous_pipeline_id' => $previousPipelineId,
            'previous_stage_id' => $previousStageId,
            'target_pipeline_id' => $targetPipeline->id,
            'target_stage_id' => $targetStageId,
        ]);

        $this->activityEvents->recordPackagePipelineRouted(
            $deal,
            $package,
            $previousPipelineId,
            $previousStageId,
            $targetPipeline,
            $targetStageId,
        );

        return true;
    }

    /**
     * Route a deal to a package based on custom-field trigger values.
     *
     * Candidates are collected across all updated fields before anything is
     * written: routing only happens when every matching field agrees on a
     * single package, so the result no longer depends on payload/array order.
     *
     * @param bool $packageExplicitlySelected Set when the same request already
     *   set package_id directly — field-trigger routing must not override a
     *   package the user picked themselves.
     */
    public function attemptRoutingFromFieldUpdates(
        Deal $deal,
        array $updatedFields,
        bool $packageExplicitlySelected = false,
    ): bool {
        if ($packageExplicitlySelected) {
            return false;
        }

        $deal->loadMissing(['company', 'packages']);

        if ($deal->is_locked) {
            return false;
        }

        $company = $this->resolveCompany($deal);

        if (!$company || !$company->package_pipeline_routing_enabled) {
            return false;
        }

        $packageMode = DealPackageMode::tryFrom($company->deal_package_mode ?? DealPackageMode::Multiple->value)
            ?? DealPackageMode::Multiple;

        if (!$packageMode->allowsPipelineRouting()) {
            return false;
        }

        if ($deal->packages->count() > 1) {
            Log::debug('Package pipeline field routing skipped', [
                'deal_id' => $deal->id,
                'reason' => 'multiple_packages',
                'package_ids' => $deal->packages->pluck('id')->all(),
            ]);

            return false;
        }

        /** @var array<int, Package> $candidatePackages */
        $candidatePackages = [];

        foreach ($updatedFields as $fieldKey => $value) {
            if ($fieldKey === 'package_id') {
                continue;
            }

            if ($value === null || $value === '' || $value === []) {
                continue;
            }

            $matchingPackages = $this->fieldCatalog->packagesMatchingFieldValue(
                (int) $deal->company_id,
                (string) $fieldKey,
                $value,
            );

            if ($matchingPackages->count() !== 1) {
                if ($matchingPackages->count() > 1) {
                    Log::debug('Package pipeline field routing skipped', [
                        'deal_id' => $deal->id,
                        'field_key' => $fieldKey,
                        'reason' => 'ambiguous_package_match',
                        'package_ids' => $matchingPackages->pluck('id')->all(),
                    ]);
                }

                continue;
            }

            /** @var Package $package */
            $package = $matchingPackages->first();

            if (!$package->packagePipeline) {
                Log::debug('Package pipeline field routing skipped', [
                    'deal_id' => $deal->id,
                    'field_key' => $fieldKey,
                    'package_id' => $package->id,
                    'reason' => 'no_package_pipeline_mapping',
                ]);

                continue;
            }

            $candidatePackages[$package->id] = $package;
        }

        if (count($candidatePackages) !== 1) {
            if (count($candidatePackages) > 1) {
                Log::debug('Package pipeline field routing skipped', [
                    'deal_id' => $deal->id,
                    'reason' => 'conflicting_field_triggers',
                    'package_ids' => array_keys($candidatePackages),
                ]);
            }

            return false;
        }

        /** @var Package $package */
        $package = reset($candidatePackages);

        $normalizedPackageIds = $this->normalizePackageIds([$package->id], $deal->company_id);
        $deal->packages()->sync($normalizedPackageIds);
        $deal->load('packages');

        return $this->routeDealToPackage($deal->fresh(['packages', 'company']), $package);
    }

    /**
     * Re-evaluate configured package field triggers from persisted deal state.
     *
     * @param array<int, string>|null $fieldKeys Limit evaluation to these enabled trigger fields.
     */
    public function attemptRoutingFromDealState(
        Deal $deal,
        ?array $fieldKeys = null,
        bool $packageExplicitlySelected = false,
    ): bool {
        $updatedFields = $this->fieldCatalog->buildTriggerFieldsFromDeal($deal, $fieldKeys);

        if ($updatedFields === []) {
            return false;
        }

        return $this->attemptRoutingFromFieldUpdates(
            $deal,
            $updatedFields,
            $packageExplicitlySelected,
        );
    }

    /**
     * @param array<int, array{field_key?: string, match_value?: string|null}> $rows
     */
    /**
     * Point a package at a pipeline (and optionally a default stage), or clear
     * the mapping when no pipeline is given.
     *
     * Shared by the Blade package form and the React packages settings page so
     * the two cannot drift.
     */
    public function syncPackagePipeline(Package $package, ?int $pipelineId, ?int $defaultStageId = null): void
    {
        PackagePipeline::where('package_id', $package->id)->delete();

        if (!$pipelineId) {
            return;
        }

        PackagePipeline::create([
            'company_id' => $package->company_id ?? company()?->id,
            'package_id' => $package->id,
            'pipeline_id' => $pipelineId,
            'default_stage_id' => $defaultStageId ?: null,
        ]);
    }

    public function syncPackageRoutingTriggers(Package $package, array $rows): void
    {
        $companyId = $package->company_id ?? company()?->id;
        $normalized = $this->fieldCatalog->normalizeTriggerRows($rows, $companyId);

        \Illuminate\Support\Facades\DB::transaction(function () use ($package, $normalized, $companyId) {
            PackageRoutingTrigger::where('package_id', $package->id)->delete();

            foreach ($normalized as $row) {
                PackageRoutingTrigger::create([
                    'company_id' => $companyId,
                    'package_id' => $package->id,
                    'field_key' => $row['field_key'],
                    'match_mode' => $row['match_mode'],
                    'match_value' => $row['match_value'],
                ]);
            }
        });
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function extractTriggerFieldsFromPayload(array $payload, ?int $companyId = null): array
    {
        return collect($payload)
            ->except(['package_id'])
            ->filter(fn ($value, $key) => $this->fieldCatalog->isFieldEnabled((string) $key, $companyId))
            ->all();
    }

    /**
     * @param array<int|string>|int|string|null $packageIds
     * @return array<int>
     */
    public function normalizePackageIds(array|int|string|null $packageIds, ?int $companyId = null): array
    {
        if ($packageIds === null || $packageIds === '' || $packageIds === []) {
            return [];
        }

        $ids = is_array($packageIds) ? $packageIds : [$packageIds];
        $ids = array_values(array_filter(array_map('intval', $ids), fn ($id) => $id > 0));

        $company = $companyId
            ? Company::find($companyId)
            : company();

        $mode = $company?->deal_package_mode ?? 'multiple';

        if ($mode === 'single' && count($ids) > 1) {
            $ids = [reset($ids)];
        }

        return $ids;
    }

    public function getDealPackageSettings(?int $companyId = null): array
    {
        $company = $companyId ? Company::find($companyId) : company();

        $triggerFields = $company?->package_pipeline_routing_trigger_fields;
        if (is_string($triggerFields)) {
            $triggerFields = json_decode($triggerFields, true);
        }

        return [
            'packagePipelineRoutingEnabled' => (bool) ($company?->package_pipeline_routing_enabled ?? false),
            'dealPackageMode' => $company?->deal_package_mode ?? 'multiple',
            'packagePipelineRoutingTriggerFields' => is_array($triggerFields) ? $triggerFields : [],
        ];
    }

    public function syncDealPackages(Deal $deal, array|int|string|null $packageIds): void
    {
        $normalized = $this->normalizePackageIds($packageIds, $deal->company_id);
        $deal->packages()->sync($normalized);
        $deal->load('packages');
        $this->routeDeal($deal->fresh(['packages', 'company']));
    }
}
