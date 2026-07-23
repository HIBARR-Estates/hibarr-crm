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
    private const PROMPT_VERSION = 'v1';

    private const REGEN_MAX_ATTEMPTS = 5;

    private const REGEN_DECAY_SECONDS = 60;

    public function __construct(
        private EntitySummaryAgentInterface $agent,
        private EntitySummaryPromptLoader $promptLoader,
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
     * @return array<string, mixed>
     */
    public function regenerate(Lead $lead): array
    {
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

        RateLimiter::hit($rateLimitKey, self::REGEN_DECAY_SECONDS);

        try {
            return $this->generateAndPersist($lead);
        } finally {
            $lock->release();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function generateAndPersist(Lead $lead): array
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
            $systemPrompt = $this->promptLoader->loadLeadSummaryPrompt();
            $summary = $this->agent->executeStructuredAgent(
                'lead_summary',
                $systemPrompt,
                $input,
            );
            $this->validator->validateLeadSummary($summary);
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
                'prompt_version' => self::PROMPT_VERSION,
                'generated_at' => Carbon::parse($summary['meta']['generated_at'] ?? now()),
                'generated_by' => Auth::id(),
            ],
        );

        return $summary;
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
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function heuristicFallback(Lead $lead, array $input): array
    {
        $leadData = $input['lead'];
        $deals = $input['sections']['deals'] ?? [];
        $atRisk = array_filter($deals, fn ($d) => in_array($d['risk_level'] ?? '', ['medium', 'high'], true));

        $primaryRiskSource = count($atRisk) > 0 ? 'linked_deal' : 'lead';
        $riskLevel = 'low';

        foreach ($deals as $deal) {
            if (($deal['risk_level'] ?? '') === 'high') {
                $riskLevel = 'high';
                break;
            }
            if (($deal['risk_level'] ?? '') === 'medium' && $riskLevel !== 'high') {
                $riskLevel = 'medium';
            }
        }

        $statusLine = "Lead {$leadData['name']} was sourced from " . ($leadData['source'] ?? 'an unknown source') . '.';

        if (count($atRisk) === 1) {
            $deal = array_values($atRisk)[0];
            $statusLine = "This lead has a linked deal ({$deal['deal_name']}) flagged as at-risk in {$deal['stage_label']}.";
        } elseif (count($atRisk) > 1) {
            $statusLine = 'This lead has ' . count($atRisk) . ' linked deals currently flagged as at-risk.';
        }

        $chips = [];

        if (! empty($input['sections']['contact'])) {
            $contact = $input['sections']['contact'];
            $reachable = ! empty($contact['email']) || ! empty($contact['mobile']);
            $chips[] = [
                'id' => 'contactability',
                'label' => 'Contactability',
                'value' => $reachable ? 'Reachable' : 'Unreachable',
                'tone' => $reachable ? 'green' : 'red',
                'sublabel' => $reachable ? 'Contact details on file' : 'Missing contact channels',
            ];
        }

        if (count($deals) > 0) {
            $chips[] = [
                'id' => 'linked_deals',
                'label' => 'Linked deals',
                'value' => count($atRisk) > 0 ? count($atRisk) . ' at risk' : count($deals) . ' active',
                'tone' => count($atRisk) > 0 ? 'amber' : 'green',
                'sublabel' => count($deals) . ' deal(s) linked',
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
            'target_deal_id' => count($atRisk) === 1 ? (string) array_values($atRisk)[0]['deal_id'] : null,
            'label' => count($atRisk) === 1
                ? 'Open linked deal'
                : (count($atRisk) > 1 ? 'Review at-risk deals' : 'Contact lead'),
            'rationale' => 'Based on available CRM activity for this lead.',
            'urgency' => $riskLevel === 'high' ? 'immediate' : 'this_week',
        ];

        return [
            'status_line' => $statusLine,
            'risk_level' => $riskLevel,
            'primary_risk_source' => $primaryRiskSource,
            'chips' => $chips,
            'bullets' => [
                'This is a heuristic summary generated while the AI service was unavailable.',
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
