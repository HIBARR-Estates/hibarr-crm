<?php

namespace App\Services\EntitySummary;

use App\Models\Deal;
use App\Models\EntityAiSummary;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;

class DealSummaryService
{
    public function __construct(
        private DealSummaryAgentService $agentService,
        private DealSummaryInputBuilder $inputBuilder,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function getCached(Deal $deal): ?array
    {
        $record = EntityAiSummary::query()
            ->where('company_id', $deal->company_id)
            ->where('entity_type', EntityAiSummary::TYPE_DEAL)
            ->where('entity_id', $deal->id)
            ->first();

        if (! $record) {
            return null;
        }

        $currentHash = $this->inputBuilder->inputHash($deal);

        if ($record->input_hash !== $currentHash) {
            return null;
        }

        return $record->summary_json;
    }

    /**
     * @return array<string, mixed>
     */
    public function regenerate(Deal $deal): array
    {
        $result = $this->agentService->generate($deal);
        $summary = $result['summary'];

        EntityAiSummary::updateOrCreate(
            [
                'company_id' => $deal->company_id,
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

        return $summary;
    }
}
