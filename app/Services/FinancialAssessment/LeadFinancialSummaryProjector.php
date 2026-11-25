<?php

namespace App\Services\FinancialAssessment;

use App\Models\FinancialAssessment;
use App\Models\LeadFinancialSummary;

/**
 * Keeps `lead_financial_summaries` (one row per lead) in step with the lead's
 * current final assessment. Drafts are deliberately never projected: a
 * half-entered number must not move a filter or fire an automation.
 */
class LeadFinancialSummaryProjector
{
    public function project(FinancialAssessment $final, int $refreshAfterDays): LeadFinancialSummary
    {
        $totals = (array) $final->totals;

        return LeadFinancialSummary::withoutGlobalScopes()->updateOrCreate(
            ['lead_id' => $final->lead_id],
            [
                'company_id' => $final->company_id,
                'current_assessment_id' => $final->id,
                'currency' => $final->currency,
                'as_of_date' => $final->as_of_date->toDateString(),
                'finalised_at' => $final->finalised_at,
                'refresh_due_on' => $final->as_of_date->copy()->addDays($refreshAfterDays)->toDateString(),
                'verified' => $final->verified_at !== null,
                'verified_at' => $final->verified_at,
                'available_now' => $totals['available_now'] ?? 0,
                'available_now_overridden' => ($totals['available_now_override'] ?? null) !== null,
                'available_projected' => $totals['available_projected'] ?? 0,
                'uncertain_total' => $totals['uncertain_total'] ?? 0,
                'income_monthly' => $totals['income_monthly'] ?? 0,
                'commitments_monthly' => $totals['commitments_monthly'] ?? 0,
                'disposable_monthly' => $totals['disposable_monthly'] ?? 0,
                'assets_total' => $totals['assets_total'] ?? 0,
                'funding_total' => $totals['funding_total'] ?? 0,
                'by_kind' => $totals['by_kind'] ?? [],
                'by_type' => $totals['by_type'] ?? [],
            ],
        );
    }

    public function forget(int $leadId): void
    {
        LeadFinancialSummary::withoutGlobalScopes()->where('lead_id', $leadId)->delete();
    }
}
