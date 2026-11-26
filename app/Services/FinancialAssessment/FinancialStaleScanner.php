<?php

namespace App\Services\FinancialAssessment;

use App\Models\Company;
use App\Models\DealAutomation;
use App\Models\LeadFinancialSummary;
use App\Scopes\CompanyScope;
use App\Support\AutomationV2Feature;
use Carbon\Carbon;

/**
 * Daily scan behind the "financial assessment stale" trigger: a lead whose current
 * final assessment is past its refresh-due date fires the trigger once, then is
 * marked (`stale_notified_for`) so the next scan skips it. A new final assessment
 * has a new due date, so it re-arms by itself.
 *
 * Companies with no active stale automation are skipped without marking anything,
 * so an automation switched on later also reaches leads that are already overdue.
 */
class FinancialStaleScanner
{
    public function __construct(private readonly FinancialAutomationTrigger $trigger) {}

    /** @return int number of leads the trigger fired for */
    public function scan(?Carbon $now = null): int
    {
        if (! app(FinancialAutomationFields::class)->enabled() || ! AutomationV2Feature::enabled()) {
            return 0;
        }

        $fired = 0;

        Company::active()->chunkById(50, function ($companies) use (&$fired, $now) {
            foreach ($companies as $company) {
                session(['company' => $company]);
                $fired += $this->scanCompany($company, ($now ?? now())->copy()->setTimezone($company->timezone ?: 'UTC'));
            }
        });

        return $fired;
    }

    public function scanCompany(Company $company, Carbon $now): int
    {
        $hasAutomation = DealAutomation::withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->where('active', true)
            ->where('subject_type', DealAutomation::SUBJECT_LEAD)
            ->where('trigger', DealAutomation::TRIGGER_FINANCIAL_ASSESSMENT_STALE)
            ->exists();

        if (! $hasAutomation) {
            return 0;
        }

        $today = $now->toDateString();
        $fired = 0;

        LeadFinancialSummary::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $company->id)
            ->whereNotNull('refresh_due_on')
            ->whereDate('refresh_due_on', '<', $today)
            ->where(function ($query) {
                $query->whereNull('stale_notified_for')->orWhereColumn('stale_notified_for', '!=', 'refresh_due_on');
            })
            ->chunkById(200, function ($summaries) use (&$fired) {
                foreach ($summaries as $summary) {
                    if (! $this->trigger->stale((int) $summary->lead_id)) {
                        continue; // failed: leave it unmarked so the next scan retries
                    }

                    LeadFinancialSummary::withoutGlobalScope(CompanyScope::class)
                        ->where('lead_id', $summary->lead_id)
                        ->update(['stale_notified_for' => $summary->refresh_due_on]);
                    $fired++;
                }
            }, 'lead_id');

        return $fired;
    }
}
