<?php

namespace App\Services\EntitySummary;

use App\Exceptions\EntityAiSummaryGenerationException;
use App\Contracts\EntitySummaryAgentInterface;
use App\Models\Deal;
use App\Models\EntityAiSummary;
use App\Models\Lead;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

class LeadSummaryService
{
    private const REGEN_MAX_ATTEMPTS = 5;

    private const REGEN_DECAY_SECONDS = 60;

    public function __construct(
        private EntitySummaryAgentInterface $agent,
        private LeadSummaryInputBuilder $inputBuilder,
        private EntitySummaryValidator $validator,
        private DealSummarySnapshotService $dealSnapshotService,
    ) {}

    /**
     * Return stored summary (even if stale). Null only when no row exists.
     *
     * @return array<string, mixed>|null
     */
    public function getCached(Lead $lead): ?array
    {
        $record = $this->findRecord($lead);

        if (! $record) {
            return null;
        }

        return $this->enrichSummary($lead, $record);
    }

    /**
     * Whether a stored summary still has to be generated: there is none, or it was marked stale
     * (the lead changed since it was written). A summary that is current is never regenerated
     * automatically, however old; a person can still ask for a fresh one.
     *
     * @param  array<string, mixed>|null  $cached  As returned by getCached()
     */
    public function needsGeneration(?array $cached): bool
    {
        return $cached === null || (bool) ($cached['meta']['is_stale'] ?? false);
    }

    /**
     * Generate a summary. With $onlyIfNeeded (the page-load auto-generation) this is a no-op that
     * returns what is stored unless there is none or it is stale. The check is repeated once the
     * generation lock is held, so two tabs opening the same lead produce one generation, not two.
     *
     * @return array<string, mixed>
     */
    public function regenerate(Lead $lead, bool $onlyIfNeeded = false): array
    {
        if ($onlyIfNeeded) {
            $cached = $this->getCached($lead);

            if (! $this->needsGeneration($cached)) {
                return $cached;
            }
        }

        $rateLimitKey = $this->rateLimitKey($lead);

        if (RateLimiter::tooManyAttempts($rateLimitKey, self::REGEN_MAX_ATTEMPTS)) {
            throw new EntityAiSummaryGenerationException(
                'Too many AI summary requests. Please wait a minute and try again.',
                $this->getCached($lead),
                429,
            );
        }

        $lock = Cache::lock($this->lockKey($lead), 90);

        if (! $lock->get()) {
            throw new EntityAiSummaryGenerationException(
                'An AI summary is already being generated for this lead.',
                $this->getCached($lead),
                429,
            );
        }

        try {
            if ($onlyIfNeeded) {
                // Someone else may have finished while we waited for the lock.
                $cached = $this->getCached($lead);

                if (! $this->needsGeneration($cached)) {
                    return $cached;
                }
            }

            RateLimiter::hit($rateLimitKey, self::REGEN_DECAY_SECONDS);

            return $this->generateAndPersist($lead);
        } finally {
            $lock->release();
        }
    }

    /**
     * @return array<string, mixed>
     */
    protected function generateAndPersist(Lead $lead): array
    {
        $existing = $this->findRecord($lead);
        $input = $this->inputBuilder->build($lead);
        $inputHash = $this->inputBuilder->inputHash($lead);

        // Use cached/stale deal snapshots only — never force-regen all deals.
        if (! empty($input['sections']['deals'])) {
            $deals = Deal::where('lead_id', $lead->id)
                ->orderByDesc('updated_at')
                ->limit(5)
                ->get();

            foreach ($deals as $deal) {
                $this->dealSnapshotService->getOrGenerate($deal, forceRegenerate: false);
            }

            $input = $this->inputBuilder->build($lead);
        }

        try {
            $summary = $this->agent->executeAgentBySlug($this->agentSlug(), $input);
            $this->validator->validateLeadSummary($summary);
            // The model writes name tokens, never the name; keep only the ones the card fills in.
            $summary = LeadSummaryTokens::sanitize($summary);
            $source = 'ai';
        } catch (\Throwable $e) {
            Log::warning('LeadSummaryService: AI generation failed', [
                'lead_id' => $lead->id,
                'message' => $e->getMessage(),
            ]);

            if ($existing && $this->isPreferableExisting($existing->summary_json ?? [])) {
                throw new EntityAiSummaryGenerationException(
                    'Failed to generate AI summary. Your previous summary was kept.',
                    $this->enrichSummary($lead, $existing),
                    503,
                    $e,
                );
            }

            $summary = $this->heuristicFallback($lead, $input);
            $this->validator->validateLeadSummary($summary);
            $source = 'heuristic';
        }

        $summary['meta'] = array_merge($summary['meta'] ?? [], [
            'source' => $source,
            'is_stale' => false,
        ]);

        EntityAiSummary::updateOrCreate(
            [
                'company_id' => $lead->company_id,
                'entity_type' => EntityAiSummary::TYPE_LEAD,
                'entity_id' => $lead->id,
            ],
            [
                'summary_json' => $summary,
                'input_hash' => $inputHash,
                // The prompt lives on the saved AI config now, so the slug is the
                // closest thing to a version; the prompt itself can change under it.
                'prompt_version' => mb_substr($this->agentSlug(), 0, 32), // column is varchar(32)
                'generated_at' => Carbon::parse($summary['meta']['generated_at'] ?? now()),
                'generated_by' => Auth::id(),
            ],
        );

        return $summary;
    }

    private function agentSlug(): string
    {
        return (string) config('services.ai.lead_summary_slug', 'lead-summary');
    }

    protected function findRecord(Lead $lead): ?EntityAiSummary
    {
        return EntityAiSummary::query()
            ->where('company_id', $lead->company_id)
            ->where('entity_type', EntityAiSummary::TYPE_LEAD)
            ->where('entity_id', $lead->id)
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
    private function enrichSummary(Lead $lead, EntityAiSummary $record): array
    {
        $summary = $record->summary_json ?? [];
        $currentHash = $this->inputBuilder->inputHash($lead);
        $isStale = $record->input_hash !== $currentHash;

        $summary['meta'] = array_merge($summary['meta'] ?? [], [
            'is_stale' => $isStale,
            'source' => $summary['meta']['source'] ?? 'ai',
        ]);

        return $summary;
    }

    private function rateLimitKey(Lead $lead): string
    {
        return 'entity-ai-summary:lead:'.$lead->id.':user:'.(Auth::id() ?? 'guest');
    }

    private function lockKey(Lead $lead): string
    {
        return 'entity-ai-summary:lead:'.$lead->id;
    }

    /**
     * Minimal summary built from the same input the model would have read, used
     * only when the AI call fails and there is no earlier AI summary to keep.
     * It states what is on file; it does not try to interpret it.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function heuristicFallback(Lead $lead, array $input): array
    {
        $leadData = $input['lead'];
        $sections = $input['sections'] ?? [];
        $deals = $sections['deals'] ?? [];
        $atRisk = array_values(array_filter(
            $deals,
            fn ($d) => in_array($d['risk_level'] ?? '', ['medium', 'high'], true)
        ));

        $riskLevel = 'low';

        foreach ($deals as $deal) {
            if (($deal['risk_level'] ?? '') === 'high') {
                $riskLevel = 'high';
                break;
            }
            if (($deal['risk_level'] ?? '') === 'medium') {
                $riskLevel = 'medium';
            }
        }

        $source = $leadData['source'] ?? null;
        $age = $leadData['days_since_created'] ?? null;
        $statusLine = 'AI summary unavailable. This '.($leadData['type'] ?? 'buyer').' lead'
            .($source ? " came in via {$source}" : ' is on file')
            .($age !== null ? ' '.($age === 1 ? '1 day' : "{$age} days").' ago.' : '.');

        if (count($atRisk) === 1) {
            $statusLine = "This lead has a linked deal in {$atRisk[0]['stage_label']} flagged as at-risk.";
        } elseif (count($atRisk) > 1) {
            $statusLine = 'This lead has '.count($atRisk).' linked deals currently flagged as at-risk.';
        }

        $chips = [];

        if ($source) {
            $chips[] = [
                'id' => 'source',
                'label' => 'Source',
                'value' => (string) $source,
                'tone' => 'neutral',
                'sublabel' => $leadData['category'] ?? 'How this lead arrived',
            ];
        }

        if (! empty($sections['qualification_calls'])) {
            $answered = array_sum(array_map(fn ($call) => count($call['answers'] ?? []), $sections['qualification_calls']));
            $chips[] = [
                'id' => 'qualification_calls',
                'label' => 'Qualification call',
                'value' => $answered.' answers',
                'tone' => 'neutral',
                'sublabel' => 'Captured on the latest call',
            ];
        }

        if (! empty($sections['notes'])) {
            $lastNote = $sections['notes'][0]['days_ago'] ?? null;
            $chips[] = [
                'id' => 'notes',
                'label' => 'Notes',
                'value' => count($sections['notes']).' logged',
                'tone' => 'neutral',
                'sublabel' => $lastNote !== null ? "Latest {$lastNote} days ago" : 'Latest note date unknown',
            ];
        }

        if (count($deals) > 0) {
            $chips[] = [
                'id' => 'linked_deals',
                'label' => 'Linked deals',
                'value' => count($atRisk) > 0 ? count($atRisk).' at risk' : count($deals).' linked',
                'tone' => count($atRisk) > 0 ? 'amber' : 'neutral',
                'sublabel' => count($deals).' deal(s) linked',
            ];
        }

        if ($chips === []) {
            $chips[] = [
                'id' => 'profile',
                'label' => 'Profile',
                'value' => 'Limited data',
                'tone' => 'neutral',
                'sublabel' => 'Generate again when more activity is logged',
            ];
        }

        $nextStep = [
            'action_type' => count($atRisk) === 1 ? 'OPEN_DEAL' : (count($atRisk) > 1 ? 'REVIEW_DEALS' : 'CONTACT_LEAD'),
            'target_deal_id' => count($atRisk) === 1 ? (string) $atRisk[0]['deal_id'] : null,
            'label' => count($atRisk) === 1
                ? 'Open linked deal'
                : (count($atRisk) > 1 ? 'Review at-risk deals' : 'Contact lead'),
            'rationale' => 'Based on available CRM activity for this lead.',
            'urgency' => $riskLevel === 'high' ? 'immediate' : 'this_week',
        ];

        $sentences = [$statusLine];

        if (! empty($sections['qualification_calls'])) {
            $answered = array_sum(array_map(fn ($call) => count($call['answers'] ?? []), $sections['qualification_calls']));
            $sentences[] = "The latest qualification call captured {$answered} answers.";
        }

        if (! empty($sections['notes'])) {
            $lastNote = $sections['notes'][0]['days_ago'] ?? null;
            $sentences[] = count($sections['notes']).' notes are logged'
                .($lastNote !== null ? ", the latest {$lastNote} days ago." : '.');
        }

        $sentences[] = 'Open the notes and qualification answers for the detail.';

        return [
            'status_line' => $statusLine,
            'summary' => implode(' ', $sentences),
            'risk_level' => $riskLevel,
            'primary_risk_source' => count($atRisk) > 0 ? 'linked_deal' : 'lead',
            'chips' => $chips,
            'bullets' => [
                'This is a basic summary generated while the AI service was unavailable.',
            ],
            'next_step' => $nextStep,
            'meta' => [
                'generated_at' => $input['now'],
                'data_confidence' => 'low',
                'stale_data_warning' => false,
                'source' => 'heuristic',
            ],
        ];
    }
}
