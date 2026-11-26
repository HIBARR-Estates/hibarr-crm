<?php

namespace App\Services\FinancialAssessment;

use App\Models\DealAutomation;
use App\Models\Lead;
use App\Scopes\CompanyScope;
use App\Services\DealAutomationService;
use App\Support\AutomationV2Feature;
use Illuminate\Support\Facades\Log;

/**
 * Runs lead-subject automations for a financial assessment event. Never throws:
 * an automation that misbehaves must not stop a person finalising or verifying.
 */
class FinancialAutomationTrigger
{
    public function __construct(private readonly DealAutomationService $automations) {}

    public function finalised(int $leadId): bool
    {
        return $this->fire($leadId, DealAutomation::TRIGGER_FINANCIAL_ASSESSMENT_FINALISED);
    }

    public function verified(int $leadId): bool
    {
        return $this->fire($leadId, DealAutomation::TRIGGER_FINANCIAL_ASSESSMENT_VERIFIED);
    }

    public function stale(int $leadId): bool
    {
        return $this->fire($leadId, DealAutomation::TRIGGER_FINANCIAL_ASSESSMENT_STALE);
    }

    /** @return bool whether the automations were processed without an error */
    private function fire(int $leadId, string $trigger): bool
    {
        if (! app(FinancialAutomationFields::class)->enabled() || ! AutomationV2Feature::enabled()) {
            return true;
        }

        try {
            $lead = Lead::withoutGlobalScope(CompanyScope::class)->find($leadId);
            if ($lead === null) {
                return true;
            }

            $this->automations->processLead($lead, $trigger);

            return true;
        } catch (\Throwable $e) {
            Log::error('[FinancialAutomationTrigger] automations failed', [
                'lead_id' => $leadId,
                'trigger' => $trigger,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
