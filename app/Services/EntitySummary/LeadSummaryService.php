<?php

namespace App\Services\EntitySummary;

use App\Contracts\EntitySummaryAgentInterface;
use App\Models\EntityAiSummary;
use App\Models\Lead;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class LeadSummaryService
{
    private const PROMPT_VERSION = 'v1';

    public function __construct(
        private EntitySummaryAgentInterface $agent,
        private EntitySummaryPromptLoader $promptLoader,
        private LeadSummaryInputBuilder $inputBuilder,
        private EntitySummaryValidator $validator,
        private DealSummarySnapshotService $dealSnapshotService,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function getCached(Lead $lead): ?array
    {
        $record = EntityAiSummary::query()
            ->where('company_id', $lead->company_id)
            ->where('entity_type', EntityAiSummary::TYPE_LEAD)
            ->where('entity_id', $lead->id)
            ->first();

        return $record?->summary_json;
    }

    /**
     * @return array<string, mixed>
     */
    public function regenerate(Lead $lead): array
    {
        $input = $this->inputBuilder->build($lead);
        $inputHash = $this->inputBuilder->inputHash($lead);

        if (! empty($input['sections']['deals'])) {
            $deals = \App\Models\Deal::where('lead_id', $lead->id)->get();
            foreach ($deals as $deal) {
                $this->dealSnapshotService->getOrGenerate($deal, forceRegenerate: true);
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
        } catch (\Throwable $e) {
            Log::warning('LeadSummaryService: AI failed, using heuristic fallback', [
                'lead_id' => $lead->id,
                'message' => $e->getMessage(),
            ]);
            $summary = $this->heuristicFallback($lead, $input);
        }

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
            ],
        ];
    }
}
