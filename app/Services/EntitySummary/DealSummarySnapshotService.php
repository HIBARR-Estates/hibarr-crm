<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;
use App\Models\EntityAiSummary;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;

class DealSummarySnapshotService
{
    public function __construct(
        private DealSummaryInputBuilder $inputBuilder,
        private DealSummaryAgentService $agentService,
        private EntitySummaryValidator $validator,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function getOrGenerate(Deal $deal, bool $forceRegenerate = false): array
    {
        $inputHash = $this->inputBuilder->inputHash($deal);
        $companyId = (int) $deal->company_id;

        if (! $forceRegenerate) {
            $cached = EntityAiSummary::query()
                ->where('company_id', $companyId)
                ->where('entity_type', EntityAiSummary::TYPE_DEAL)
                ->where('entity_id', $deal->id)
                ->first();

            if ($cached && $cached->input_hash === $inputHash) {
                return $this->validator->toLeadConsumerShape($cached->summary_json);
            }
        }

        $result = $this->agentService->generate($deal);
        $summary = $result['summary'];

        EntityAiSummary::updateOrCreate(
            [
                'company_id' => $companyId,
                'entity_type' => EntityAiSummary::TYPE_DEAL,
                'entity_id' => $deal->id,
            ],
            [
                'summary_json' => $summary,
                'input_hash' => $result['input_hash'],
                'prompt_version' => $result['prompt_version'],
                'generated_at' => Carbon::parse($summary['meta']['generated_at'] ?? now()),
                'generated_by' => Auth::id(),
            ],
        );

        return $this->validator->toLeadConsumerShape($summary);
    }
}
