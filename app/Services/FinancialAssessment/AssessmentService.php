<?php

namespace App\Services\FinancialAssessment;

use App\Enums\FinancialAssessmentSource;
use App\Enums\FinancialAssessmentStatus;
use App\Enums\FinancialLineCertainty;
use App\Enums\FinancialLineFrequency;
use App\Events\FinancialAssessmentFinalised;
use App\Events\FinancialAssessmentVerified;
use App\Models\FinancialAssessment;
use App\Models\FinancialAssessmentLine;
use App\Models\FinancialAssessmentLineType;
use App\Models\Lead;
use App\Scopes\CompanyScope;
use App\Services\FinancialAssessment\Rates\CryptoRateService;
use App\Services\FinancialAssessment\Rates\CurrencyRateResolver;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * The lifecycle of a lead's financial assessments.
 *
 *   draft ──finalise──▶ final (current) ──a newer final──▶ superseded
 *
 * Callers (controllers, the API field writer, qualification, imports) decide
 * *who may* do something; this class decides *what is valid* and keeps the data
 * consistent: one open draft and one current final per lead, finals immutable,
 * rates frozen at finalise, the per-lead summary row always in step.
 *
 * Queries here drop only the company scope (never the soft-delete scope) and
 * filter by the lead's own company, so the same code works for a logged-in
 * user, a queue job and an API call, and a discarded draft or removed line
 * stays gone.
 */
class AssessmentService
{
    public const DEFAULT_REFRESH_DAYS = 90;

    public function __construct(
        private readonly AssessmentCalculator $calculator,
        private readonly CurrencyRateResolver $rates,
        private readonly LeadFinancialSummaryProjector $projector,
        private readonly CryptoRateService $crypto,
    ) {}

    // ---------------------------------------------------------------- settings

    /** The currency new assessments are reported in: the company setting, else the company's own currency. */
    public function reportingCurrency(int $companyId): string
    {
        $configured = DB::table('lead_setting')->where('company_id', $companyId)->value('financial_reporting_currency');

        if (filled($configured)) {
            return strtoupper((string) $configured);
        }

        $own = DB::table('companies')
            ->join('currencies', 'currencies.id', '=', 'companies.currency_id')
            ->where('companies.id', $companyId)
            ->value('currencies.currency_code');

        return filled($own) ? strtoupper((string) $own) : 'EUR';
    }

    public function refreshAfterDays(int $companyId): int
    {
        $days = DB::table('lead_setting')->where('company_id', $companyId)->value('financial_refresh_after_days');

        return $days ? (int) $days : self::DEFAULT_REFRESH_DAYS;
    }

    // ------------------------------------------------------------------ reading

    public function openDraft(Lead $lead): ?FinancialAssessment
    {
        return FinancialAssessment::withoutGlobalScope(CompanyScope::class)
            ->where('lead_id', $lead->id)
            ->where('status', FinancialAssessmentStatus::Draft->value)
            ->first();
    }

    public function currentFinal(Lead $lead): ?FinancialAssessment
    {
        return FinancialAssessment::withoutGlobalScope(CompanyScope::class)
            ->where('lead_id', $lead->id)
            ->where('status', FinancialAssessmentStatus::Final->value)
            ->first();
    }

    // ------------------------------------------------------------------- drafts

    /**
     * The lead's open draft, creating it if there is none. A new draft starts as
     * a copy of the current final assessment (each line remembers the one it was
     * copied from), so an update only needs to change what is new.
     */
    public function startDraft(
        Lead $lead,
        ?int $userId = null,
        FinancialAssessmentSource $source = FinancialAssessmentSource::Manual,
        ?CarbonInterface $asOf = null,
    ): FinancialAssessment {
        if ($existing = $this->openDraft($lead)) {
            return $existing;
        }

        try {
            return DB::transaction(function () use ($lead, $userId, $source, $asOf) {
                $previous = $this->currentFinal($lead);

                $draft = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->create([
                    'company_id' => $lead->company_id,
                    'lead_id' => $lead->id,
                    'as_of_date' => ($asOf ?? now())->toDateString(),
                    'status' => FinancialAssessmentStatus::Draft,
                    'source' => $source,
                    'currency' => $this->reportingCurrency((int) $lead->company_id),
                    'prepared_by_user_id' => $userId,
                    'supersedes_assessment_id' => $previous?->id,
                    'draft_lead_id' => $lead->id,
                ]);

                if ($previous) {
                    $this->copyLines($previous, $draft);
                }

                return $draft;
            });
        } catch (UniqueConstraintViolationException $e) {
            // Another request opened a draft for this lead a moment ago: use that one.
            if ($existing = $this->openDraft($lead)) {
                return $existing;
            }

            throw $e;
        }
    }

    public function discardDraft(FinancialAssessment $assessment): void
    {
        DB::transaction(function () use ($assessment) {
            $draft = $this->lockedDraft($assessment);

            FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->delete();

            // Free the "one open draft per lead" slot before the soft delete.
            $draft->forceFill(['draft_lead_id' => null])->save();
            $draft->delete();
        });
    }

    public function updateDraft(FinancialAssessment $assessment, array $attributes): FinancialAssessment
    {
        $draft = $this->lockedDraft($assessment);

        if (array_key_exists('as_of_date', $attributes)) {
            $draft->as_of_date = $this->parseDate($attributes['as_of_date']) ?? $draft->as_of_date;
        }
        if (array_key_exists('source', $attributes)) {
            $draft->source = FinancialAssessmentSource::tryFrom((string) $attributes['source'])
                ?? throw new AssessmentException('Unknown source.', 'invalid_value');
        }
        if (array_key_exists('notes', $attributes)) {
            $draft->notes = filled($attributes['notes']) ? (string) $attributes['notes'] : null;
        }

        $draft->save();

        return $draft;
    }

    // -------------------------------------------------------------------- lines

    /** @param array<string, mixed> $attributes amount, currency, frequency, certainty, available_from, contributor_label, contributor_lead_id, proof_file_id, note */
    public function addLine(FinancialAssessment $assessment, string $typeKey, array $attributes): FinancialAssessmentLine
    {
        $draft = $this->lockedDraft($assessment);
        $type = $this->activeType((int) $draft->company_id, $typeKey);

        $values = $this->lineValues($draft, $type, $attributes, null);

        return FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->create($values + [
            'company_id' => $draft->company_id,
            'assessment_id' => $draft->id,
            'type_id' => $type->id,
            'sort_order' => $this->nextSortOrder($draft),
        ]);
    }

    /** @param array<string, mixed> $attributes */
    public function updateLine(FinancialAssessmentLine $line, array $attributes): FinancialAssessmentLine
    {
        $draft = $this->lockedDraft($line->assessment()->withoutGlobalScope(CompanyScope::class)->firstOrFail());
        $type = FinancialAssessmentLineType::withoutGlobalScopes()->findOrFail($line->type_id);

        $line->fill($this->lineValues($draft, $type, $attributes, $line))->save();

        return $line;
    }

    public function removeLine(FinancialAssessmentLine $line): void
    {
        $this->lockedDraft($line->assessment()->withoutGlobalScope(CompanyScope::class)->firstOrFail());

        $line->delete();
    }

    /**
     * Write one value for a line type into the draft, the way an external
     * writer (API field catalog, qualification mapping, import) does.
     *
     *   fill       only when the draft has no line of that type yet
     *   overwrite  update the type's line (extra lines of that type are removed)
     *   append     always add another line (e.g. a second bank account)
     *
     * @param  array<string, mixed>  $companions  currency, frequency, certainty, available_from, note, ...
     * @return array{action: 'added'|'updated'|'skipped', line: FinancialAssessmentLine|null}
     */
    public function applyValue(FinancialAssessment $assessment, string $typeKey, mixed $amount, string $mode = 'fill', array $companions = []): array
    {
        return DB::transaction(function () use ($assessment, $typeKey, $amount, $mode, $companions) {
            $draft = $this->lockedDraft($assessment);
            $type = $this->activeType((int) $draft->company_id, $typeKey);
            $attributes = ['amount' => $amount] + $companions;

            $existing = FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)
                ->where('assessment_id', $draft->id)->where('type_id', $type->id)
                ->orderBy('id')->get();

            if ($mode === 'append' || $existing->isEmpty()) {
                return ['action' => 'added', 'line' => $this->addLine($draft, $typeKey, $attributes)];
            }

            if ($mode === 'fill') {
                return ['action' => 'skipped', 'line' => $existing->first()];
            }

            if ($mode !== 'overwrite') {
                throw new AssessmentException('Unknown write mode.', 'mode_not_supported');
            }

            $existing->slice(1)->each->delete();

            return ['action' => 'updated', 'line' => $this->updateLine($existing->first(), $attributes)];
        });
    }

    // ----------------------------------------------------------------- finalise

    /**
     * Freeze a draft as the lead's current assessment.
     *
     * Rates for every currency used are fetched first (outside the transaction,
     * so no row is locked during network calls) and frozen into `totals`. A
     * currency with no rate blocks finalising unless a manual rate is given.
     * The previous current final becomes superseded, and the summary row is
     * projected, in the same transaction.
     *
     * @param  array{manual_rates?: array<string, float|int|string>, available_now_override?: float|int|string|null, override_reason?: string|null}  $options
     *
     * @throws MissingRatesException
     * @throws AssessmentException
     */
    public function finalise(FinancialAssessment $assessment, ?int $userId = null, array $options = []): FinancialAssessment
    {
        $override = $options['available_now_override'] ?? null;
        $override = ($override === null || $override === '') ? null : $this->requireAmount($override);
        $reason = trim((string) ($options['override_reason'] ?? ''));

        if ($override !== null && $reason === '') {
            throw AssessmentException::overrideNeedsReason();
        }

        $draft = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->findOrFail($assessment->id);
        if (! $draft->isDraft()) {
            throw AssessmentException::notADraft();
        }

        $currencies = $this->loadLines($draft)->pluck('currency')->all();
        if ($currencies === []) {
            throw AssessmentException::emptyAssessment();
        }

        $resolved = $this->rates->resolve((int) $draft->company_id, $currencies, $draft->currency, $options['manual_rates'] ?? []);
        if ($resolved['missing'] !== []) {
            throw new MissingRatesException($resolved['missing']);
        }

        $refreshDays = $this->refreshAfterDays((int) $draft->company_id);

        [$final, $superseded] = DB::transaction(function () use ($draft, $userId, $override, $reason, $resolved, $refreshDays) {
            $locked = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->lockForUpdate()->findOrFail($draft->id);
            if (! $locked->isDraft()) {
                throw AssessmentException::notADraft();
            }

            $lines = $this->loadLines($locked);
            if ($lines->isEmpty()) {
                throw AssessmentException::emptyAssessment();
            }

            // A line may have changed currency since the rates were fetched.
            $unrated = array_values(array_diff($lines->pluck('currency')->map('strtoupper')->unique()->all(), array_keys($resolved['rates'])));
            if ($unrated !== []) {
                throw new MissingRatesException($unrated);
            }

            $rateValues = array_map(fn ($quote) => $quote->rate, $resolved['rates']);
            $totals = $this->calculator->calculate(
                $this->toInputs($lines),
                $rateValues,
                $locked->currency,
                $locked->as_of_date,
                $override,
            );
            $totals['rates'] = array_map(fn ($quote) => $quote->toArray(), $resolved['rates']);
            $totals['rates_as_of'] = now()->toIso8601String();
            $totals['line_count'] = $lines->count();

            $previous = FinancialAssessment::withoutGlobalScope(CompanyScope::class)
                ->where('lead_id', $locked->lead_id)
                ->where('status', FinancialAssessmentStatus::Final->value)
                ->lockForUpdate()
                ->first();

            // Release the "one current final" slot before taking it.
            $previous?->forceFill([
                'status' => FinancialAssessmentStatus::Superseded,
                'current_lead_id' => null,
            ])->save();

            $locked->forceFill([
                'status' => FinancialAssessmentStatus::Final,
                'draft_lead_id' => null,
                'current_lead_id' => $locked->lead_id,
                'finalised_at' => now(),
                'prepared_by_user_id' => $locked->prepared_by_user_id ?? $userId,
                'available_now_override' => $override,
                'override_reason' => $override !== null ? $reason : null,
                'supersedes_assessment_id' => $previous?->id ?? $locked->supersedes_assessment_id,
                'totals' => $totals,
            ])->save();

            $this->projector->project($locked, $refreshDays);

            return [$locked, $previous];
        });

        FinancialAssessmentFinalised::dispatch($final, $superseded);

        return $final;
    }

    /**
     * The line each lead currently has for a type, read-only: the open draft's line if there is a
     * draft, else the current final assessment's. Used to predict (dry run) and decide what a bulk
     * write would change.
     *
     * @param  list<int>  $leadIds
     * @return array<int, array{amount: float, currency: string, frequency: string, certainty: string}> keyed by lead id
     */
    public function existingLines(array $leadIds, string $typeKey, int $companyId): array
    {
        if ($leadIds === []) {
            return [];
        }

        $assessments = FinancialAssessment::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->whereIn('lead_id', $leadIds)
            ->whereIn('status', [FinancialAssessmentStatus::Draft->value, FinancialAssessmentStatus::Final->value])
            ->get(['id', 'lead_id', 'status']);

        // A lead with a draft is judged by the draft (it already holds the final's lines); else by its final.
        $chosen = [];
        foreach ($assessments as $assessment) {
            $current = $chosen[$assessment->lead_id] ?? null;
            if ($current === null || $assessment->status === FinancialAssessmentStatus::Draft) {
                $chosen[$assessment->lead_id] = $assessment;
            }
        }

        if ($chosen === []) {
            return [];
        }

        $typeId = FinancialAssessmentLineType::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)->where('key', $typeKey)->value('id');
        if (! $typeId) {
            return [];
        }

        $byAssessment = collect($chosen)->mapWithKeys(fn ($a) => [$a->id => $a->lead_id]);
        $result = [];

        foreach (FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)
            ->whereIn('assessment_id', $byAssessment->keys())->where('type_id', $typeId)->orderBy('id')->get() as $line) {
            $leadId = $byAssessment[$line->assessment_id];
            $result[$leadId] ??= [
                'amount' => (float) $line->amount,
                'currency' => strtoupper($line->currency),
                'frequency' => $line->frequency->value,
                'certainty' => $line->certainty->value,
            ];
        }

        return $result;
    }

    /**
     * Indicative totals for an assessment as it stands, with live rates and nothing frozen or
     * saved. Used while a draft is being edited. When a rate is unavailable `totals` is null and
     * the currencies without a rate are listed, so the caller can say so instead of guessing.
     *
     * @return array{totals: array<string, mixed>|null, rates: array<string, array{rate: float, source: string, fetched_at: string|null}>, missing: list<string>}
     */
    public function preview(FinancialAssessment $assessment): array
    {
        $lines = $this->loadLines($assessment);

        if ($lines->isEmpty()) {
            return ['totals' => null, 'rates' => [], 'missing' => []];
        }

        $resolved = $this->rates->resolve((int) $assessment->company_id, $lines->pluck('currency')->all(), $assessment->currency);
        $rates = array_map(fn ($quote) => $quote->toArray(), $resolved['rates']);

        if ($resolved['missing'] !== []) {
            return ['totals' => null, 'rates' => $rates, 'missing' => $resolved['missing']];
        }

        $totals = $this->calculator->calculate(
            $this->toInputs($lines),
            array_map(fn ($quote) => $quote->rate, $resolved['rates']),
            $assessment->currency,
            $assessment->as_of_date,
        );

        return ['totals' => $totals, 'rates' => $rates, 'missing' => []];
    }

    /** Record that the current final assessment was verified. Verifying twice keeps the first record. */
    public function verify(FinancialAssessment $assessment, int $userId, ?CarbonInterface $at = null): FinancialAssessment
    {
        $verified = DB::transaction(function () use ($assessment, $userId, $at) {
            $locked = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->lockForUpdate()->findOrFail($assessment->id);

            if (! $locked->isFinal() || $locked->current_lead_id === null) {
                throw AssessmentException::notFinal();
            }

            if ($locked->verified_at !== null) {
                return null;
            }

            $locked->forceFill([
                'verified_by_user_id' => $userId,
                'verified_at' => $at ?? now(),
            ])->save();

            $this->projector->project($locked, $this->refreshAfterDays((int) $locked->company_id));

            return $locked;
        });

        if ($verified === null) {
            return FinancialAssessment::withoutGlobalScope(CompanyScope::class)->findOrFail($assessment->id);
        }

        FinancialAssessmentVerified::dispatch($verified);

        return $verified;
    }

    /** True when the lead has a current assessment that is past its refresh date. */
    public function isRefreshDue(Lead $lead, ?CarbonInterface $today = null): bool
    {
        $due = $lead->financialSummary()->withoutGlobalScopes()->value('refresh_due_on');

        return $due !== null && Carbon::parse($due)->startOfDay()->lt(($today ?? now())->copy()->startOfDay());
    }

    // ----------------------------------------------------------------- internals

    private function lockedDraft(FinancialAssessment $assessment): FinancialAssessment
    {
        $draft = FinancialAssessment::withoutGlobalScope(CompanyScope::class)->lockForUpdate()->findOrFail($assessment->id);

        if (! $draft->isDraft()) {
            throw AssessmentException::notADraft();
        }

        return $draft;
    }

    private function activeType(int $companyId, string $key): FinancialAssessmentLineType
    {
        $type = FinancialAssessmentLineType::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('key', $key)
            ->where('is_active', true)
            ->first();

        return $type ?? throw AssessmentException::unknownType($key);
    }

    /** @return Collection<int, FinancialAssessmentLine> */
    private function loadLines(FinancialAssessment $assessment)
    {
        return FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)
            ->where('assessment_id', $assessment->id)
            ->with([
                'type' => fn ($query) => $query->withoutGlobalScopes(),
                'type.kind' => fn ($query) => $query->withoutGlobalScopes(),
            ])
            ->orderBy('sort_order')->orderBy('id')
            ->get();
    }

    /** @return list<AssessmentLineInput> */
    private function toInputs($lines): array
    {
        return $lines->map(fn (FinancialAssessmentLine $line) => new AssessmentLineInput(
            $line->type->key,
            $line->type->kind->key,
            $line->type->kind->role,
            (float) $line->amount,
            strtoupper($line->currency),
            $line->frequency,
            $line->certainty,
            $line->available_from,
        ))->values()->all();
    }

    private function copyLines(FinancialAssessment $from, FinancialAssessment $to): void
    {
        foreach (FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $from->id)->orderBy('sort_order')->orderBy('id')->get() as $line) {
            FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->create([
                'company_id' => $to->company_id,
                'assessment_id' => $to->id,
                'type_id' => $line->type_id,
                'amount' => $line->amount,
                'currency' => $line->currency,
                'frequency' => $line->frequency,
                'available_from' => $line->available_from,
                'certainty' => $line->certainty,
                'contributor_label' => $line->contributor_label,
                'contributor_lead_id' => $line->contributor_lead_id,
                'proof_file_id' => $line->proof_file_id,
                'note' => $line->note,
                'previous_line_id' => $line->id,
                'sort_order' => $line->sort_order,
            ]);
        }
    }

    private function nextSortOrder(FinancialAssessment $draft): int
    {
        return ((int) FinancialAssessmentLine::withoutGlobalScope(CompanyScope::class)->where('assessment_id', $draft->id)->max('sort_order')) + 10;
    }

    /**
     * Validate and normalise the writable attributes of a line. Only keys that
     * are present are returned (an update never blanks what it was not given);
     * for a new line the type's defaults fill the gaps.
     *
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function lineValues(FinancialAssessment $draft, FinancialAssessmentLineType $type, array $attributes, ?FinancialAssessmentLine $existing): array
    {
        $values = [];

        if (array_key_exists('amount', $attributes) || $existing === null) {
            $values['amount'] = $this->requireAmount($attributes['amount'] ?? null);
        }

        if (array_key_exists('currency', $attributes) || $existing === null) {
            $currency = strtoupper(trim((string) ($attributes['currency'] ?? $draft->currency)));
            if (! $this->isKnownCurrency((int) $draft->company_id, $currency)) {
                throw AssessmentException::invalidCurrency($currency);
            }
            $values['currency'] = $currency;
        }

        if (array_key_exists('frequency', $attributes) || $existing === null) {
            $values['frequency'] = $this->enumValue(
                FinancialLineFrequency::class,
                $attributes['frequency'] ?? $type->default_frequency ?? FinancialLineFrequency::Once,
                'frequency',
            );
        }

        if (array_key_exists('certainty', $attributes) || $existing === null) {
            $values['certainty'] = $this->enumValue(
                FinancialLineCertainty::class,
                $attributes['certainty'] ?? $type->default_certainty ?? FinancialLineCertainty::Likely,
                'certainty',
            );
        }

        if (array_key_exists('available_from', $attributes)) {
            $values['available_from'] = $this->parseDate($attributes['available_from']);
        }

        if (array_key_exists('contributor_label', $attributes)) {
            $label = trim((string) $attributes['contributor_label']);
            $values['contributor_label'] = $label === '' ? null : mb_substr($label, 0, 120);
        }

        if (array_key_exists('contributor_lead_id', $attributes)) {
            $id = $attributes['contributor_lead_id'];
            if ($id !== null && $id !== '' && ! Lead::withoutGlobalScope(CompanyScope::class)->where('company_id', $draft->company_id)->whereKey((int) $id)->exists()) {
                throw new AssessmentException('The contributor is not a lead of this company.', 'invalid_value');
            }
            $values['contributor_lead_id'] = ($id === null || $id === '') ? null : (int) $id;
        }

        if (array_key_exists('proof_file_id', $attributes)) {
            $id = $attributes['proof_file_id'];
            if ($id !== null && $id !== '' && ! DB::table('lead_contact_files')->where('id', (int) $id)->where('lead_id', $draft->lead_id)->exists()) {
                throw new AssessmentException('The proof document does not belong to this lead.', 'invalid_value');
            }
            $values['proof_file_id'] = ($id === null || $id === '') ? null : (int) $id;
        }

        if (array_key_exists('note', $attributes)) {
            $values['note'] = filled($attributes['note']) ? (string) $attributes['note'] : null;
        }

        return $values;
    }

    private function requireAmount(mixed $amount): string
    {
        if (! is_numeric($amount) || (float) $amount < 0) {
            throw AssessmentException::invalidAmount();
        }

        // Plain decimal text (never scientific notation) for the decimal column.
        return rtrim(rtrim(number_format((float) $amount, 8, '.', ''), '0'), '.') ?: '0';
    }

    /**
     * @template T of \BackedEnum
     *
     * @param  class-string<T>  $enum
     * @return T
     */
    private function enumValue(string $enum, mixed $value, string $field): \BackedEnum
    {
        if ($value instanceof $enum) {
            return $value;
        }

        return $enum::tryFrom((string) $value)
            ?? throw new AssessmentException("Unknown {$field}.", 'invalid_value');
    }

    private function parseDate(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->startOfDay();
        } catch (Throwable) {
            throw new AssessmentException('That is not a valid date.', 'invalid_value');
        }
    }

    private function isKnownCurrency(int $companyId, string $currency): bool
    {
        if (preg_match('/^[A-Z]{3}$/', $currency) === 1) {
            return true;
        }

        return in_array($currency, $this->crypto->activeTickers($companyId), true);
    }
}
