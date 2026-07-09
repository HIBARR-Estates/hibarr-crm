<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;

class DealSummarySnapshotService
{
    public function __construct(
        private DealSummaryInputBuilder $inputBuilder,
        private DealSummaryService $dealSummaryService,
        private EntitySummaryValidator $validator,
    ) {}

    /**
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

        $summary = $this->dealSummaryService->regenerate($deal);

        return $this->validator->toLeadConsumerShape($summary, $deal);
    }
}
