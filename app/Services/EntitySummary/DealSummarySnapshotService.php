<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;

class DealSummarySnapshotService
{
    public function __construct(
        private DealSummaryService $dealSummaryService,
        private EntitySummaryValidator $validator,
    ) {}

    /**
     * Prefer cached/stale snapshots. Only generate when missing (or forced).
     *
     * @return array<string, mixed>
     */
    public function getOrGenerate(Deal $deal, bool $forceRegenerate = false): array
    {
        $deal->loadMissing(['leadStage', 'currency']);

        if (! $forceRegenerate) {
            $cached = $this->dealSummaryService->getCached($deal);

            if ($cached !== null) {
                return $this->validator->toLeadConsumerShape($cached, $deal);
            }
        }

        $summary = $forceRegenerate
            ? $this->dealSummaryService->regenerate($deal)
            : $this->dealSummaryService->ensureExists($deal);

        return $this->validator->toLeadConsumerShape($summary, $deal);
    }
}
