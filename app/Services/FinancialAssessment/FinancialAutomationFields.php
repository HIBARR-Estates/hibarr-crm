<?php

namespace App\Services\FinancialAssessment;

use App\Models\FinancialAssessment;
use App\Models\FinancialAssessmentLineType;
use App\Models\Lead;
use App\Models\LeadFinancialSummary;
use App\Scopes\CompanyScope;
use App\Support\FeatureFlags;
use Carbon\Carbon;

/**
 * The lead financial fields automations can branch on, addressed as
 * `lead_financial_{name}` (same prefix convention as `lead_marketing_`).
 *
 * Values come from the lead's one-row read model (`lead_financial_summaries`),
 * which only ever holds the current *final* assessment, so a half-entered draft
 * can never fire an automation. Amounts are in the assessment's reporting
 * currency. Fields are condition-only: they never resolve as a merge tag (see
 * AutomationFieldCatalog::isOutboundBlockedField()).
 *
 * Numbers that need an assessment are null without one, so `exists` reads false;
 * the flags (`has_assessment`, `verified`, ...) are always 0/1.
 */
class FinancialAutomationFields
{
    public const PREFIX = 'lead_financial_';

    /** Per-type totals are addressed as `lead_financial_total_{type_key}`. */
    public const TOTAL_PREFIX = 'total_';

    public const FLAG = 'crm.lead-financial-assessments';

    /** name => [label, type] where type is number|date|boolean */
    private const METRICS = [
        'available_now' => ['Available now', 'number'],
        'available_projected' => ['Projected including likely', 'number'],
        'uncertain_total' => ['Uncertain, not counted', 'number'],
        'income_monthly' => ['Monthly income', 'number'],
        'commitments_monthly' => ['Monthly commitments', 'number'],
        'disposable_monthly' => ['Disposable per month', 'number'],
        'assets_total' => ['Assets total', 'number'],
        'funding_total' => ['Funding total', 'number'],
        'available_now_change' => ['Change in available now since the previous assessment', 'number'],
        'disposable_monthly_change' => ['Change in disposable per month since the previous assessment', 'number'],
        'verified' => ['Verified', 'boolean'],
        'has_assessment' => ['Has a finalised assessment', 'boolean'],
        'has_draft' => ['Has a draft in progress', 'boolean'],
        'is_refresh_due' => ['Refresh overdue', 'boolean'],
        'age_days' => ['Days since assessed', 'number'],
        'days_until_refresh' => ['Days until refresh is due (negative when overdue)', 'number'],
        'as_of_date' => ['Assessed as of', 'date'],
        'verified_at' => ['Verified at', 'date'],
        'refresh_due_on' => ['Refresh due on', 'date'],
    ];

    /** Summary columns that map one to one onto a metric of the same name. */
    private const SUMMARY_NUMBERS = [
        'available_now', 'available_projected', 'uncertain_total', 'income_monthly',
        'commitments_monthly', 'disposable_monthly', 'assets_total', 'funding_total',
    ];

    public static function isFinancialKey(string $fieldKey): bool
    {
        return str_starts_with($fieldKey, self::PREFIX);
    }

    public function enabled(): bool
    {
        return FeatureFlags::enabled(self::FLAG);
    }

    /**
     * Field keys and labels for the condition pickers, plus each field's value type,
     * for a company (per-type totals follow its active types). Empty while the flag is off.
     *
     * @return array{fields: array<string, string>, types: array<string, string>}
     */
    public function catalog(int $companyId): array
    {
        if (! $this->enabled()) {
            return ['fields' => [], 'types' => []];
        }

        $fields = [];
        $types = [];
        foreach (self::METRICS as $name => [$label, $type]) {
            $fields[self::PREFIX.$name] = $label;
            $types[self::PREFIX.$name] = $type;
        }

        $lineTypes = FinancialAssessmentLineType::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)->where('is_active', true)
            ->orderBy('sort_order')->orderBy('id')->get(['key', 'label']);

        foreach ($lineTypes as $lineType) {
            $key = self::PREFIX.self::TOTAL_PREFIX.$lineType->key;
            $fields[$key] = 'Total of '.$lineType->label;
            $types[$key] = 'number';
        }

        return ['fields' => $fields, 'types' => $types];
    }

    /** Resolve a full `lead_financial_*` key against a lead; null when unknown, off, or not applicable. */
    public function resolveKey(?Lead $lead, string $fieldKey): mixed
    {
        if ($lead === null || ! self::isFinancialKey($fieldKey)) {
            return null;
        }

        return $this->resolve($lead, substr($fieldKey, strlen(self::PREFIX)));
    }

    public function resolve(Lead $lead, string $name): mixed
    {
        if (! $this->enabled()) {
            return null;
        }

        $isTotal = str_starts_with($name, self::TOTAL_PREFIX);
        if (! $isTotal && ! isset(self::METRICS[$name])) {
            return null;
        }

        if ($name === 'has_draft') {
            return $this->hasDraft($lead) ? 1 : 0;
        }

        $summary = LeadFinancialSummary::withoutGlobalScope(CompanyScope::class)->find($lead->id);

        if ($name === 'has_assessment') {
            return $summary !== null ? 1 : 0;
        }
        if ($name === 'verified') {
            return $summary?->verified ? 1 : 0;
        }
        if ($name === 'is_refresh_due') {
            $days = $this->daysUntilRefresh($summary);

            return $days !== null && $days < 0 ? 1 : 0;
        }

        if ($summary === null) {
            return null;
        }

        if ($isTotal) {
            $row = ($summary->by_type ?? [])[substr($name, strlen(self::TOTAL_PREFIX))] ?? null;

            return $row === null ? null : (float) ($row['counted'] ?? 0);
        }

        if (in_array($name, self::SUMMARY_NUMBERS, true)) {
            return (float) $summary->{$name};
        }

        return match ($name) {
            'available_now_change' => $this->change($summary, 'available_now'),
            'disposable_monthly_change' => $this->change($summary, 'disposable_monthly'),
            'age_days' => max(0, (int) $summary->as_of_date->copy()->startOfDay()->diffInDays(now()->startOfDay(), false)),
            'days_until_refresh' => $this->daysUntilRefresh($summary),
            'as_of_date' => $summary->as_of_date?->toDateString(),
            'verified_at' => $summary->verified_at?->toDateTimeString(),
            'refresh_due_on' => $summary->refresh_due_on?->toDateString(),
            default => null,
        };
    }

    private function hasDraft(Lead $lead): bool
    {
        return FinancialAssessment::withoutGlobalScope(CompanyScope::class)
            ->where('lead_id', $lead->id)->where('status', 'draft')->exists();
    }

    private function daysUntilRefresh(?LeadFinancialSummary $summary): ?int
    {
        if ($summary === null || $summary->refresh_due_on === null) {
            return null;
        }

        return (int) now()->startOfDay()->diffInDays(Carbon::parse($summary->refresh_due_on)->startOfDay(), false);
    }

    /** New minus previous (what the lead's current final replaced); null for a first assessment. */
    private function change(LeadFinancialSummary $summary, string $total): ?float
    {
        $current = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->find($summary->current_assessment_id);
        if ($current === null || $current->supersedes_assessment_id === null) {
            return null;
        }

        $previous = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->find($current->supersedes_assessment_id);
        $before = $previous?->totals[$total] ?? null;
        if ($before === null) {
            return null;
        }

        // Different reporting currencies make a difference meaningless.
        if ($previous->currency !== $current->currency) {
            return null;
        }

        return round((float) $summary->{$total} - (float) $before, 2);
    }
}
