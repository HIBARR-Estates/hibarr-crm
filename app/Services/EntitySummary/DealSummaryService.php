<?php

namespace App\Services\EntitySummary;

use App\Exceptions\EntityAiSummaryGenerationException;
use App\Models\Deal;
use App\Models\EntityAiSummary;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

class DealSummaryService
{
    private const REGEN_MAX_ATTEMPTS = 5;

    private const REGEN_DECAY_SECONDS = 60;

    public function __construct(
        private DealSummaryAgentService $agentService,
        private DealSummaryInputBuilder $inputBuilder,
    ) {}

    /**
     * Return the stored summary (even if stale). Null only when no row exists.
     * Enriches meta with is_stale + source.
     *
     * @return array<string, mixed>|null
     */
    public function getCached(Deal $deal): ?array
    {
        $record = $this->findRecord($deal);

        if (! $record) {
            return null;
        }

        return $this->enrichSummary($deal, $record);
    }

    /**
     * @return array<string, mixed>
     */
    public function regenerate(Deal $deal): array
    {
        $rateLimitKey = $this->rateLimitKey($deal);

        if (RateLimiter::tooManyAttempts($rateLimitKey, self::REGEN_MAX_ATTEMPTS)) {
            throw new EntityAiSummaryGenerationException(
                'Too many AI summary requests. Please wait a minute and try again.',
                $this->getCached($deal),
                429,
            );
        }

        $lock = Cache::lock($this->lockKey($deal), 90);

        if (! $lock->get()) {
            throw new EntityAiSummaryGenerationException(
                'An AI summary is already being generated for this deal.',
                $this->getCached($deal),
                429,
            );
        }

        RateLimiter::hit($rateLimitKey, self::REGEN_DECAY_SECONDS);

        try {
            return $this->generateAndPersist($deal);
        } finally {
            $lock->release();
        }
    }

    /**
     * Generate only when no stored summary exists (used by lead snapshot embedding).
     *
     * @return array<string, mixed>
     */
    public function ensureExists(Deal $deal): array
    {
        $cached = $this->getCached($deal);

        if ($cached !== null) {
            return $cached;
        }

        return $this->regenerate($deal);
    }

    /**
     * @return array<string, mixed>
     */
    private function generateAndPersist(Deal $deal): array
    {
        $existing = $this->findRecord($deal);

        try {
            $result = $this->agentService->generate($deal);
            $summary = $result['summary'];
            $source = $result['source'] ?? 'ai';
        } catch (\Throwable $e) {
            Log::warning('DealSummaryService: AI generation failed', [
                'deal_id' => $deal->id,
                'message' => $e->getMessage(),
            ]);

            if ($existing && $this->isPreferableExisting($existing->summary_json ?? [])) {
                throw new EntityAiSummaryGenerationException(
                    'Failed to generate AI summary. Your previous summary was kept.',
                    $this->enrichSummary($deal, $existing),
                    503,
                    $e,
                );
            }

            $result = $this->agentService->heuristicOnly($deal);
            $summary = $result['summary'];
            $source = 'heuristic';
        }

        $summary['meta'] = array_merge($summary['meta'] ?? [], [
            'source' => $source,
            'is_stale' => false,
        ]);

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

    protected function findRecord(Deal $deal): ?EntityAiSummary
    {
        return EntityAiSummary::query()
            ->where('company_id', $deal->company_id)
            ->where('entity_type', EntityAiSummary::TYPE_DEAL)
            ->where('entity_id', $deal->id)
            ->first();
    }

    /**
     * @param  array<string, mixed>  $summary
     */
    private function isPreferableExisting(array $summary): bool
    {
        $source = $summary['meta']['source'] ?? 'ai';

        return $source !== 'heuristic';
    }

    /**
     * @return array<string, mixed>
     */
    private function enrichSummary(Deal $deal, EntityAiSummary $record): array
    {
        $summary = $record->summary_json ?? [];
        $currentHash = $this->inputBuilder->inputHash($deal);
        $isStale = $record->input_hash !== $currentHash;

        $summary['meta'] = array_merge($summary['meta'] ?? [], [
            'is_stale' => $isStale,
            'source' => $summary['meta']['source'] ?? 'ai',
        ]);

        return $summary;
    }

    private function rateLimitKey(Deal $deal): string
    {
        return 'entity-ai-summary:deal:'.$deal->id.':user:'.(Auth::id() ?? 'guest');
    }

    private function lockKey(Deal $deal): string
    {
        return 'entity-ai-summary:deal:'.$deal->id;
    }
}
