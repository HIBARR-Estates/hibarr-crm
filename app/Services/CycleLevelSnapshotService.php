<?php

namespace App\Services;

use App\Models\MlmCycle;
use App\Models\MlmCycleCriteriaSnapshot;
use App\Models\MlmCycleLevelSnapshot;
use App\Models\MlmLevel;
use App\Models\MlmSetting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CycleLevelSnapshotService
{
    /**
     * Snapshot all live levels + criteria + max_commission for a cycle.
     * Should be called once when a cycle transitions to Active.
     */
    public function snapshotForCycle(MlmCycle $cycle): void
    {
        if ($cycle->hasSnapshots()) {
            Log::info("CycleLevelSnapshotService: Cycle #{$cycle->cycle_number} already has snapshots, skipping.");
            return;
        }

        $this->createSnapshots($cycle);
    }

    /**
     * Delete existing snapshots and re-create them from current live data.
     * Used for emergency mid-cycle corrections.
     */
    public function reSnapshot(MlmCycle $cycle): void
    {
        DB::transaction(function () use ($cycle) {
            // Cascade deletes criteria snapshots via FK
            $cycle->levelSnapshots()->delete();

            $this->createSnapshots($cycle);
        });

        Log::warning("CycleLevelSnapshotService: Re-snapshot performed for cycle #{$cycle->cycle_number} (company {$cycle->company_id})");
    }

    /**
     * Get snapshot levels for a cycle, ordered by rank DESC with criteria loaded.
     * This is the single read path during an active cycle.
     *
     * @return Collection<int, MlmCycleLevelSnapshot>
     */
    public function getSnapshotLevels(MlmCycle $cycle): Collection
    {
        return MlmCycleLevelSnapshot::where('cycle_id', $cycle->id)
            ->orderedDesc()
            ->with('criteriaSnapshots')
            ->get();
    }

    /**
     * Look up a snapshot level by its original source_level_id within a cycle.
     */
    public function getSnapshotLevelBySourceId(MlmCycle $cycle, int $sourceLevelId): ?MlmCycleLevelSnapshot
    {
        return MlmCycleLevelSnapshot::where('cycle_id', $cycle->id)
            ->where('source_level_id', $sourceLevelId)
            ->first();
    }

    /**
     * Copy all live levels and their criteria into snapshot tables for a cycle.
     */
    private function createSnapshots(MlmCycle $cycle): void
    {
        DB::transaction(function () use ($cycle) {
            $companyId = $cycle->company_id;

            // Snapshot max_commission_percentage from settings
            $settings = MlmSetting::forCompany($companyId);
            $cycle->update([
                'max_commission_snapshot' => $settings->max_commission_percentage,
            ]);

            // Copy all levels
            $levels = MlmLevel::where('company_id', $companyId)
                ->with('criteria')
                ->get();

            foreach ($levels as $level) {
                $snapshot = MlmCycleLevelSnapshot::create([
                    'company_id' => $companyId,
                    'cycle_id' => $cycle->id,
                    'source_level_id' => $level->id,
                    'name' => $level->name,
                    'slug' => $level->slug,
                    'rank' => $level->rank,
                    'commission_percentage' => $level->commission_percentage,
                    'direct_rate' => $level->direct_rate,
                    'override_rate' => $level->override_rate,
                    'is_hidden' => $level->is_hidden,
                ]);

                // Copy criteria
                foreach ($level->criteria as $criterion) {
                    MlmCycleCriteriaSnapshot::create([
                        'cycle_level_snapshot_id' => $snapshot->id,
                        'logic_group' => $criterion->logic_group,
                        'metric' => $criterion->metric->value,
                        'operator' => $criterion->operator,
                        'threshold' => $criterion->threshold,
                    ]);
                }
            }

            Log::info("CycleLevelSnapshotService: Snapshotted {$levels->count()} levels for cycle #{$cycle->cycle_number} (company {$companyId}, max_commission: {$settings->max_commission_percentage}%)");
        });
    }
}
