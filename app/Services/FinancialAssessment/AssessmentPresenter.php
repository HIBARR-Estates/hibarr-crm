<?php

namespace App\Services\FinancialAssessment;

use App\Enums\FinancialAssessmentStatus;
use App\Models\FinancialAssessment;
use App\Models\FinancialAssessmentKind;
use App\Models\FinancialAssessmentLine;
use App\Models\FinancialAssessmentLineType;
use App\Models\Lead;
use App\Models\LeadFinancialSummary;
use App\Scopes\CompanyScope;
use App\Services\FinancialAssessment\Rates\CryptoRateService;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Builds the single payload the lead page's Financials tab reads: the current
 * assessment, the open draft (with carried-forward / edited / new markers and
 * indicative totals), the history, and the vocabulary to add lines from.
 *
 * Every mutation endpoint answers with this same payload, so the page replaces
 * its local state from the response and never needs an Inertia reload.
 */
class AssessmentPresenter
{
    /** How many finalised assessments (with their lines) the tab receives. */
    private const HISTORY_LIMIT = 12;

    public function __construct(
        private readonly AssessmentService $assessments,
        private readonly CryptoRateService $crypto,
    ) {}

    /**
     * @param  array{view: bool, edit: bool}  $permissions
     * @return array<string, mixed>
     */
    public function workspace(Lead $lead, array $permissions): array
    {
        $companyId = (int) $lead->company_id;

        $assessments = FinancialAssessment::withoutGlobalScope(CompanyScope::class)
            ->where('lead_id', $lead->id)
            ->with(['lines.type.kind', 'preparedBy:id,name', 'verifiedBy:id,name'])
            ->orderByDesc('as_of_date')->orderByDesc('id')
            ->get();

        $draft = $assessments->first(fn (FinancialAssessment $a) => $a->status === FinancialAssessmentStatus::Draft);
        $final = $assessments->first(fn (FinancialAssessment $a) => $a->status === FinancialAssessmentStatus::Final);
        $past = $assessments
            ->filter(fn (FinancialAssessment $a) => $a->status !== FinancialAssessmentStatus::Draft)
            ->take(self::HISTORY_LIMIT)
            ->values();

        $previousLines = $this->previousLines($draft);

        return [
            'permissions' => $permissions,
            'summary' => $this->summary($lead),
            'current' => $final ? $this->assessment($final, null) : null,
            'draft' => $draft ? $this->draft($draft, $previousLines) : null,
            'history' => $past->map(fn (FinancialAssessment $a) => $this->assessment($a, null))->all(),
            'options' => $this->options($companyId),
            'settings' => [
                'reporting_currency' => $this->assessments->reportingCurrency($companyId),
                'refresh_after_days' => $this->assessments->refreshAfterDays($companyId),
                'crypto_provider_ready' => $this->crypto->isConfigured(),
            ],
        ];
    }

    /**
     * One finalised (or superseded) assessment for the external read API. Narrower than the page
     * payload on purpose: no internal user, file or line ids, and no override reason.
     *
     * @return array<string, mixed>
     */
    public function forApi(FinancialAssessment $assessment, bool $withLines = true): array
    {
        $assessment->loadMissing(['lines.type.kind']);
        $totals = $assessment->totals ?? [];
        $base = $assessment->currency;
        $rates = $totals['rates'] ?? [];

        $data = [
            'id' => (int) $assessment->id,
            'status' => $assessment->status->value,
            'is_current' => $assessment->current_lead_id !== null,
            'source' => $assessment->source->value,
            'as_of_date' => $assessment->as_of_date->toDateString(),
            'currency' => $base,
            'finalised_at' => $assessment->finalised_at?->toIso8601String(),
            'verified' => $assessment->verified_at !== null,
            'verified_at' => $assessment->verified_at?->toIso8601String(),
            'available_now_overridden' => $assessment->available_now_override !== null,
            'totals' => $totals,
        ];

        if ($withLines) {
            $data['lines'] = $assessment->lines->map(function (FinancialAssessmentLine $line) use ($base, $rates) {
                $currency = strtoupper($line->currency);
                $rate = $currency === strtoupper($base) ? 1.0 : ($rates[$currency]['rate'] ?? null);

                return [
                    'type' => $line->type->key,
                    'type_label' => $line->type->label,
                    'kind' => $line->type->kind->key,
                    'role' => $line->type->kind->role->value,
                    'amount' => (float) $line->amount,
                    'currency' => $currency,
                    'frequency' => $line->frequency->value,
                    'certainty' => $line->certainty->value,
                    'available_from' => $line->available_from?->toDateString(),
                    'contributor' => $line->contributor_label,
                    'note' => $line->note,
                    'converted_amount' => $rate !== null ? round((float) $line->amount * $rate, 2) : null,
                ];
            })->all();
        }

        return $data;
    }

    /** The lead's one-row summary for the external read API, or null when it has no finalised assessment. */
    public function summaryForApi(Lead $lead): ?array
    {
        return $this->summary($lead);
    }

    // ------------------------------------------------------------------ pieces

    /** @return array<string, mixed>|null */
    private function summary(Lead $lead): ?array
    {
        $summary = LeadFinancialSummary::withoutGlobalScope(CompanyScope::class)->find($lead->id);

        if ($summary === null) {
            return null;
        }

        $today = now()->startOfDay();
        $due = $summary->refresh_due_on;
        $daysUntilDue = $due ? (int) $today->diffInDays($due->copy()->startOfDay(), false) : null;

        return [
            'currency' => $summary->currency,
            'as_of_date' => $summary->as_of_date->toDateString(),
            'finalised_at' => $summary->finalised_at?->toIso8601String(),
            'refresh_due_on' => $due?->toDateString(),
            'days_until_due' => $daysUntilDue,
            'is_refresh_due' => $daysUntilDue !== null && $daysUntilDue < 0,
            'verified' => (bool) $summary->verified,
            'verified_at' => $summary->verified_at?->toIso8601String(),
            'available_now' => (float) $summary->available_now,
            'available_now_overridden' => (bool) $summary->available_now_overridden,
            'available_projected' => (float) $summary->available_projected,
            'uncertain_total' => (float) $summary->uncertain_total,
            'income_monthly' => (float) $summary->income_monthly,
            'commitments_monthly' => (float) $summary->commitments_monthly,
            'disposable_monthly' => (float) $summary->disposable_monthly,
        ];
    }

    /**
     * @param  array<int, FinancialAssessmentLine>  $previousLines
     * @return array<string, mixed>
     */
    private function draft(FinancialAssessment $draft, array $previousLines): array
    {
        $preview = $this->safePreview($draft);
        $rates = $preview['rates'];

        $data = $this->assessment($draft, $rates, $previousLines);
        $data['preview'] = [
            'totals' => $preview['totals'],
            'missing_rates' => $preview['missing'],
        ];
        $data['rates'] = $rates;

        return $data;
    }

    /** @return array{totals: array<string, mixed>|null, rates: array<string, array<string, mixed>>, missing: list<string>} */
    private function safePreview(FinancialAssessment $draft): array
    {
        try {
            return $this->assessments->preview($draft);
        } catch (Throwable $e) {
            report($e);

            return ['totals' => null, 'rates' => [], 'missing' => []];
        }
    }

    /**
     * One assessment with its lines. A final one converts lines at its frozen
     * rates; a draft at the live indicative rates passed in.
     *
     * @param  array<string, array<string, mixed>>|null  $liveRates
     * @param  array<int, FinancialAssessmentLine>  $previousLines
     * @return array<string, mixed>
     */
    private function assessment(FinancialAssessment $assessment, ?array $liveRates, array $previousLines = []): array
    {
        $totals = $assessment->totals;
        $rates = $liveRates ?? ($totals['rates'] ?? []);

        return [
            'id' => (int) $assessment->id,
            'status' => $assessment->status->value,
            'source' => $assessment->source->value,
            'as_of_date' => $assessment->as_of_date->toDateString(),
            'currency' => $assessment->currency,
            'notes' => $assessment->notes,
            'finalised_at' => $assessment->finalised_at?->toIso8601String(),
            'verified_at' => $assessment->verified_at?->toIso8601String(),
            'verified_by' => $assessment->verifiedBy ? ['id' => (int) $assessment->verifiedBy->id, 'name' => $assessment->verifiedBy->name] : null,
            'prepared_by' => $assessment->preparedBy ? ['id' => (int) $assessment->preparedBy->id, 'name' => $assessment->preparedBy->name] : null,
            'available_now_override' => $assessment->available_now_override !== null ? (float) $assessment->available_now_override : null,
            'override_reason' => $assessment->override_reason,
            'supersedes_assessment_id' => $assessment->supersedes_assessment_id ? (int) $assessment->supersedes_assessment_id : null,
            'totals' => $assessment->status === FinancialAssessmentStatus::Draft ? null : $totals,
            'lines' => $assessment->lines->map(fn (FinancialAssessmentLine $line) => $this->line($line, $assessment->currency, $rates, $previousLines))->all(),
        ];
    }

    /**
     * @param  array<string, array<string, mixed>>  $rates
     * @param  array<int, FinancialAssessmentLine>  $previousLines
     * @return array<string, mixed>
     */
    private function line(FinancialAssessmentLine $line, string $base, array $rates, array $previousLines): array
    {
        $type = $line->type;
        $kind = $type->kind;
        $currency = strtoupper($line->currency);
        $rate = $currency === strtoupper($base) ? 1.0 : ($rates[$currency]['rate'] ?? null);
        $previous = $line->previous_line_id ? ($previousLines[$line->previous_line_id] ?? null) : null;

        return [
            'id' => (int) $line->id,
            'type_key' => $type->key,
            'type_label' => $type->label,
            'kind_key' => $kind->key,
            'kind_label' => $kind->label,
            'role' => $kind->role->value,
            'amount' => (float) $line->amount,
            'currency' => $currency,
            'frequency' => $line->frequency->value,
            'certainty' => $line->certainty->value,
            'available_from' => $line->available_from?->toDateString(),
            'contributor_label' => $line->contributor_label,
            'contributor_lead_id' => $line->contributor_lead_id ? (int) $line->contributor_lead_id : null,
            'proof_file_id' => $line->proof_file_id ? (int) $line->proof_file_id : null,
            'note' => $line->note,
            'converted_amount' => $rate !== null ? round((float) $line->amount * $rate, 2) : null,
            'rate' => $currency === strtoupper($base) ? null : $rate,
            'previous_line_id' => $line->previous_line_id ? (int) $line->previous_line_id : null,
            'previous' => $previous ? [
                'amount' => (float) $previous->amount,
                'currency' => strtoupper($previous->currency),
                'frequency' => $previous->frequency->value,
                'certainty' => $previous->certainty->value,
            ] : null,
        ];
    }

    /** @return array<int, FinancialAssessmentLine> keyed by line id */
    private function previousLines(?FinancialAssessment $draft): array
    {
        if ($draft === null) {
            return [];
        }

        $ids = $draft->lines->pluck('previous_line_id')->filter()->unique()->all();

        if ($ids === []) {
            return [];
        }

        return FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)
            ->whereIn('id', $ids)->get()->keyBy('id')->all();
    }

    /** @return array<string, mixed> */
    private function options(int $companyId): array
    {
        $kinds = FinancialAssessmentKind::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)->where('is_active', true)
            ->orderBy('sort_order')->orderBy('id')->get();

        $types = FinancialAssessmentLineType::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)->where('is_active', true)
            ->orderBy('sort_order')->orderBy('id')->get()->groupBy('kind_id');

        $fiat = DB::table('currencies')->where('company_id', $companyId)
            ->where('is_cryptocurrency', '!=', 'yes')->pluck('currency_code')
            ->map(fn ($code) => strtoupper((string) $code))
            ->push($this->assessments->reportingCurrency($companyId))
            ->unique()->sort()->values()->all();

        return [
            'kinds' => $kinds->map(fn (FinancialAssessmentKind $kind) => [
                'key' => $kind->key,
                'label' => $kind->label,
                'role' => $kind->role->value,
                'types' => ($types[$kind->id] ?? collect())->map(fn (FinancialAssessmentLineType $type) => [
                    'key' => $type->key,
                    'label' => $type->label,
                    'default_frequency' => $type->default_frequency?->value,
                    'default_certainty' => $type->default_certainty?->value,
                ])->values()->all(),
            ])->values()->all(),
            'fiat_currencies' => $fiat,
            'crypto_currencies' => $this->crypto->activeTickers($companyId),
        ];
    }
}
