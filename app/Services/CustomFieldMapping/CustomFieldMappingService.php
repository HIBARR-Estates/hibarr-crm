<?php

namespace App\Services\CustomFieldMapping;

use App\Models\CustomField;
use App\Models\Deal;
use App\Enums\FinancialAssessmentSource;
use App\Enums\FinancialLineCertainty;
use App\Enums\FinancialLineFrequency;
use App\Models\Lead;
use App\Scopes\CompanyScope;
use App\Services\FinancialAssessment\AssessmentException;
use App\Services\FinancialAssessment\AssessmentFieldRegistry;
use App\Services\FinancialAssessment\AssessmentService;
use App\Services\FinancialAssessment\Rates\CryptoRateService;
use Illuminate\Support\Facades\DB;

/**
 * Maps, migrates and (optionally) removes custom fields at runtime — the
 * admin-driven replacement for one-off data migrations.
 *
 * A source custom field's values can be copied into
 *   - another custom field, or
 *   - a defined lead / deal field (see {@see DefinedFieldRegistry}),
 * within one module (Lead -> Lead) or across Lead <-> Deal. Afterwards the
 * source values and/or the source field itself can be deleted.
 *
 * Cross-module semantics:
 *   Lead -> Deal  every deal of the lead receives the lead's value.
 *   Deal -> Lead  the lead takes the value of its most recent deal (highest
 *                 id) that has one; older deals are reported as superseded.
 *
 * Everything runs through one entry point, {@see self::run()}; a dry run
 * performs the exact same resolution and conversion and only skips the
 * writes, so what the preview reports is what apply does.
 *
 * Writes go straight to the tables (no Eloquent events), so a bulk
 * migration does not fire per-record observers, automations or history
 * entries. Custom-field files are only ever re-pointed, never deleted.
 */
class CustomFieldMappingService
{
    private const CHUNK = 500;
    private const SAMPLE_LIMIT = 10;

    public function __construct(private readonly CustomFieldValueConverter $converter)
    {
    }

    /**
     * @param  array{
     *     source_id: int,
     *     target_type: 'custom'|'defined',
     *     target_id?: int|null,
     *     target_key?: string|null,
     *     conflict?: 'skip'|'overwrite',
     *     add_missing_options?: bool,
     *     delete_source_values?: bool,
     *     delete_source_field?: bool,
     *     allow_loss?: bool,
     * }  $request
     * @return array<string, mixed> the report
     *
     * @throws InvalidMappingException
     */
    public function run(array $request, bool $dryRun): array
    {
        $source = CustomField::with('fieldGroup')->find($request['source_id'])
            ?? throw new InvalidMappingException('The source field no longer exists.');

        $conflict = ($request['conflict'] ?? 'skip') === 'overwrite' ? 'overwrite' : 'skip';
        $addMissing = (bool) ($request['add_missing_options'] ?? false);
        $deleteValues = (bool) ($request['delete_source_values'] ?? false);
        $deleteField = (bool) ($request['delete_source_field'] ?? false);
        $allowLoss = (bool) ($request['allow_loss'] ?? false);

        $target = $this->resolveTarget($source, $request);

        if ($deleteField) {
            $this->assertFieldDeletable($source);
        }

        $report = $this->newReport($dryRun);

        $apply = function () use ($source, $target, $conflict, $addMissing, $dryRun, &$report) {
            $this->copyValues($source, $target, $conflict, $addMissing, $dryRun, $report);
        };

        if ($dryRun) {
            $apply();
        } else {
            // Copy, then delete in the same transaction: either the whole
            // migration lands or none of it does.
            DB::transaction(function () use ($apply, $source, $deleteValues, $deleteField, $allowLoss, &$report) {
                $apply();

                if (($deleteValues || $deleteField) && ! $allowLoss && $this->hasUnmigratedValues($report)) {
                    throw new InvalidMappingException(
                        'Some values could not be migrated. Review them, or confirm that they may be lost, before deleting the source.',
                        $report,
                    );
                }

                if ($deleteField) {
                    // Delete the values explicitly rather than lean on the FK cascade,
                    // so the count reported is what was actually removed.
                    $report['deleted_values'] = DB::table('custom_fields_data')
                        ->where('custom_field_id', $source->id)
                        ->delete();
                    $source->delete();
                    $report['deleted_field'] = true;
                } elseif ($deleteValues) {
                    $report['deleted_values'] = DB::table('custom_fields_data')
                        ->where('custom_field_id', $source->id)
                        ->delete();
                }
            });
        }

        $report['will_delete_values'] = $deleteValues || $deleteField;
        $report['will_delete_field'] = $deleteField;
        $report['blocked_delete'] = ($deleteValues || $deleteField) && ! $allowLoss && $this->hasUnmigratedValues($report);

        return $report;
    }

    /**
     * Source values that did not reach the target (and would be lost by a delete).
     */
    private function hasUnmigratedValues(array $report): bool
    {
        return $report['skipped_incompatible'] > 0
            || $report['skipped_locked'] > 0
            || $report['skipped_conflict'] > 0
            || $report['no_target_record'] > 0
            || $report['superseded'] > 0;
    }

    /**
     * @return array<string, mixed>
     */
    private function newReport(bool $dryRun): array
    {
        return [
            'dry_run' => $dryRun,
            'source_total' => 0,
            'mapped' => 0,
            'unchanged' => 0,
            'skipped_conflict' => 0,
            'skipped_incompatible' => 0,
            'skipped_locked' => 0,
            'no_target_record' => 0,
            'superseded' => 0,
            'added_options' => [],
            'incompatible_samples' => [],
            'deleted_values' => 0,
            'deleted_field' => false,
        ];
    }

    // ---------------------------------------------------------------- target

    /**
     * @return array{type: string, field?: CustomField, defined?: array, model: string, options?: array<string, string>}
     */
    private function resolveTarget(CustomField $source, array $request): array
    {
        $sourceModel = $source->fieldGroup?->model;

        if (! in_array($sourceModel, [Lead::CUSTOM_FIELD_MODEL, Deal::CUSTOM_FIELD_MODEL], true)) {
            throw new InvalidMappingException('Only lead and deal custom fields can be mapped.');
        }

        if (in_array($source->type, CustomFieldValueConverter::UNSUPPORTED_TYPES, true)) {
            throw new InvalidMappingException("Fields of type \"{$source->type}\" can't be mapped.");
        }

        if (($request['target_type'] ?? null) === 'defined' && str_starts_with((string) ($request['target_key'] ?? ''), AssessmentFieldRegistry::PREFIX)) {
            return $this->resolveAssessmentTarget($source, $request);
        }

        if (($request['target_type'] ?? null) === 'defined') {
            $defined = DefinedFieldRegistry::find((string) ($request['target_key'] ?? ''))
                ?? throw new InvalidMappingException('That built-in field is not available as a mapping target.');

            // Structured types (file, currency, range, ...) only convert to their own type.
            if (! $this->converter->typesCompatible($source->type, 'text')) {
                throw new InvalidMappingException("\"{$source->type}\" values can't be mapped to a built-in field.");
            }

            return ['type' => 'defined', 'defined' => $defined, 'model' => $defined['model']];
        }

        $target = CustomField::with('fieldGroup')->find($request['target_id'] ?? 0)
            ?? throw new InvalidMappingException('Choose the field to map into.');

        if ($target->id === $source->id) {
            throw new InvalidMappingException('The source and target field must be different.');
        }

        $targetModel = $target->fieldGroup?->model;

        if (! in_array($targetModel, [Lead::CUSTOM_FIELD_MODEL, Deal::CUSTOM_FIELD_MODEL], true)) {
            throw new InvalidMappingException('Only lead and deal custom fields can be mapped.');
        }

        if (! $this->converter->typesCompatible($source->type, $target->type)) {
            throw new InvalidMappingException(
                "A \"{$source->type}\" field can't be mapped into a \"{$target->type}\" field.",
            );
        }

        $options = [];
        foreach ($this->converter->optionList($target) as $label) {
            $options[mb_strtolower(trim($label))] = $label;
        }

        return ['type' => 'custom', 'field' => $target, 'model' => $targetModel, 'options' => $options];
    }

    /**
     * A financial assessment line as the target: Lead -> Lead and Deal -> Lead only (assessments belong to
     * the lead). The currency, frequency and certainty the amounts are stored with must be chosen: the
     * values carry only a number, and a guessed currency would silently corrupt totals.
     *
     * @return array{type: string, assessment: array{type_key: string, company_id: int, options: array{currency: string, frequency: string, certainty: string}}, model: string}
     */
    private function resolveAssessmentTarget(CustomField $source, array $request): array
    {
        if (! $this->converter->typesCompatible($source->type, 'text')) {
            throw new InvalidMappingException("\"{$source->type}\" values can't be mapped to a financial assessment amount.");
        }

        $companyId = (int) $source->company_id;
        $key = (string) ($request['target_key'] ?? '');
        $field = app(AssessmentFieldRegistry::class)->find($companyId, $key);

        if ($field === null || ! $field['writable']) {
            throw new InvalidMappingException('That financial assessment field is not available as a mapping target.');
        }

        $given = (array) ($request['assessment'] ?? []);
        $currency = strtoupper(trim((string) ($given['currency'] ?? '')));
        $frequency = (string) ($given['frequency'] ?? '');
        $certainty = (string) ($given['certainty'] ?? '');

        $knownCurrency = preg_match('/^[A-Z]{3}$/', $currency) === 1
            || in_array($currency, app(CryptoRateService::class)->activeTickers($companyId), true);

        if (! $knownCurrency || FinancialLineFrequency::tryFrom($frequency) === null || FinancialLineCertainty::tryFrom($certainty) === null) {
            throw new InvalidMappingException('Choose the currency, frequency and certainty these amounts are stored with.');
        }

        return [
            'type' => 'assessment',
            'assessment' => [
                'type_key' => (string) AssessmentFieldRegistry::typeKeyOf($key),
                'company_id' => $companyId,
                'options' => ['currency' => $currency, 'frequency' => $frequency, 'certainty' => $certainty],
            ],
            'model' => Lead::CUSTOM_FIELD_MODEL,
        ];
    }

    private function assertFieldDeletable(CustomField $source): void
    {
        $linkedRepeatables = CustomField::where('linked_field_id', $source->id)->pluck('label');

        if ($linkedRepeatables->isNotEmpty()) {
            throw new InvalidMappingException(
                'This field drives the repeatable field(s) '.$linkedRepeatables->implode(', ').'. Re-link them before deleting it.',
            );
        }
    }

    // ------------------------------------------------------------------ copy

    private function copyValues(CustomField $source, array $target, string $conflict, bool $addMissing, bool $dryRun, array &$report): void
    {
        $sourceModel = $source->fieldGroup->model;
        $crossModel = $sourceModel !== $target['model'];

        // Deal -> Lead: only the newest deal per lead supplies the value.
        $winningDeals = ($crossModel && $sourceModel === Deal::CUSTOM_FIELD_MODEL)
            ? $this->winningDealsByLead($source)
            : null;

        $targetOptions = $target['options'] ?? [];
        $missingOptions = [];

        DB::table('custom_fields_data')
            ->where('custom_field_id', $source->id)
            ->where('model', $sourceModel)
            ->chunkById(self::CHUNK, function ($rows) use ($source, $target, $conflict, $addMissing, $dryRun, $crossModel, $winningDeals, &$targetOptions, &$missingOptions, &$report) {
                // targetRecordId => converted value, for this chunk
                $pending = [];
                $lookup = $crossModel ? $this->prefetchRelations($source, $rows) : [];

                foreach ($rows as $row) {
                    $neutral = $this->converter->read($source, $row->value);

                    if ($neutral === null) {
                        continue;
                    }

                    $report['source_total']++;

                    foreach ($this->targetRecordIds($source, (int) $row->model_id, $crossModel, $winningDeals, $lookup, $report) as $targetId) {
                        $converted = match ($target['type']) {
                            'custom' => $this->converter->toCustomField($neutral, $target['field'], $targetOptions, $addMissing, $missingOptions),
                            'assessment' => $this->converter->toAmount($neutral),
                            default => $this->converter->toDefinedField($neutral, $target['defined']),
                        };

                        if ($converted['value'] === null) {
                            $report['skipped_incompatible']++;
                            if (count($report['incompatible_samples']) < self::SAMPLE_LIMIT) {
                                $report['incompatible_samples'][] = [
                                    'record_id' => (int) $row->model_id,
                                    'value' => mb_substr((string) $row->value, 0, 120),
                                    'reason' => $converted['reason'],
                                ];
                            }

                            continue;
                        }

                        $pending[$targetId] = $converted['value'];
                    }
                }

                if ($pending !== []) {
                    $this->writeChunk($target, $pending, $conflict, $dryRun, $report);
                }
            });

        $report['added_options'] = array_values(array_unique($missingOptions));

        if (! $dryRun && $missingOptions !== [] && $target['type'] === 'custom') {
            $field = $target['field'];
            $field->values = json_encode(array_values(array_unique([
                ...$this->converter->optionList($field),
                ...$missingOptions,
            ])));
            $field->save();
        }
    }

    /**
     * One query per chunk instead of one per source row.
     *
     * Lead -> Deal: lead id => [deal ids]. Deal -> Lead: deal id => lead id.
     *
     * @return array<int, mixed>
     */
    private function prefetchRelations(CustomField $source, $rows): array
    {
        $ids = $rows->pluck('model_id')->map(fn ($id) => (int) $id)->all();

        if ($source->fieldGroup->model === Lead::CUSTOM_FIELD_MODEL) {
            return Deal::whereIn('lead_id', $ids)->get(['id', 'lead_id'])
                ->groupBy('lead_id')
                ->map(fn ($deals) => $deals->pluck('id')->map(fn ($id) => (int) $id)->all())
                ->all();
        }

        return Deal::whereIn('id', $ids)->pluck('lead_id', 'id')->all();
    }

    /**
     * Resolves which target record(s) one source record writes to.
     *
     * @param  array<int, int>|null  $winningDeals  deal id => lead id (Deal -> Lead only)
     * @param  array<int, mixed>  $lookup  see prefetchRelations()
     * @return list<int>
     */
    private function targetRecordIds(CustomField $source, int $sourceRecordId, bool $crossModel, ?array $winningDeals, array $lookup, array &$report): array
    {
        if (! $crossModel) {
            return [$sourceRecordId];
        }

        if ($source->fieldGroup->model === Lead::CUSTOM_FIELD_MODEL) {
            // Lead -> Deal
            $dealIds = $lookup[$sourceRecordId] ?? [];

            if ($dealIds === []) {
                $report['no_target_record']++;
            }

            return $dealIds;
        }

        // Deal -> Lead
        if (! isset($winningDeals[$sourceRecordId])) {
            // Either an older deal of a lead that has a newer value, or a deal with no lead.
            ($lookup[$sourceRecordId] ?? null) ? $report['superseded']++ : $report['no_target_record']++;

            return [];
        }

        return [$winningDeals[$sourceRecordId]];
    }

    /**
     * deal id => lead id, for the newest deal of each lead that holds a
     * non-empty value in the source field.
     *
     * @return array<int, int>
     */
    private function winningDealsByLead(CustomField $source): array
    {
        $winners = DB::table('deals')
            ->join('custom_fields_data as cfd', function ($join) use ($source) {
                $join->on('cfd.model_id', '=', 'deals.id')
                    ->where('cfd.model', Deal::CUSTOM_FIELD_MODEL)
                    ->where('cfd.custom_field_id', $source->id);
            })
            // Same notion of "has a value" as CustomFieldValueConverter::read(): trimmed, non-empty.
            ->when($source->company_id, fn ($q, $companyId) => $q->where('deals.company_id', $companyId))
            ->whereNotNull('deals.lead_id')
            ->whereRaw("TRIM(cfd.value) <> ''")
            ->whereRaw("TRIM(cfd.value) <> '[]'")
            ->groupBy('deals.lead_id')
            ->selectRaw('deals.lead_id as lead_id, MAX(deals.id) as deal_id')
            ->get();

        return $winners->mapWithKeys(fn ($row) => [(int) $row->deal_id => (int) $row->lead_id])->all();
    }

    // ----------------------------------------------------------------- write

    /**
     * @param  array<int, mixed>  $pending  target record id => converted value
     */
    private function writeChunk(array $target, array $pending, string $conflict, bool $dryRun, array &$report): void
    {
        if ($target['type'] === 'assessment') {
            $this->writeAssessmentChunk($target['assessment'], $pending, $conflict, $dryRun, $report);

            return;
        }

        $existing = $target['type'] === 'custom'
            ? $this->existingCustomValues($target, array_keys($pending))
            : $this->existingDefinedValues($target['defined'], array_keys($pending));

        // Locked deals refuse custom-field edits everywhere else in the app
        // (see DealGatheringController::updateCustomFieldsBulk), so a bulk
        // migration must not be the one path that rewrites them.
        $locked = $target['model'] === Deal::CUSTOM_FIELD_MODEL
            ? Deal::whereIn('id', array_keys($pending))->where('is_locked', true)->pluck('id')->flip()->all()
            : [];

        foreach ($pending as $recordId => $value) {
            if (isset($locked[$recordId])) {
                $report['skipped_locked']++;

                continue;
            }

            $rowExists = array_key_exists($recordId, $existing);
            $current = $existing[$recordId] ?? null;
            $hasValue = $this->isFilled($current, $target);

            if ($hasValue && $this->sameValue($current, $value)) {
                $report['unchanged']++;

                continue;
            }

            if ($hasValue && $conflict === 'skip') {
                $report['skipped_conflict']++;

                continue;
            }

            if (! $dryRun) {
                $target['type'] === 'custom'
                    ? $this->writeCustomValue($target['field'], $target['model'], $recordId, $value, $rowExists)
                    : $this->writeDefinedValue($target['defined'], $recordId, $value);
            }

            $report['mapped']++;
        }
    }

    /**
     * Financial assessment amounts, lead by lead, into each lead's open draft (source "import"). A bulk
     * run never finalises: drafts count nowhere until someone finalises them, so even a wrong run
     * moves no filter, automation or API figure. Writes go through {@see AssessmentService}, so the
     * draft rules hold; the dry run reads the same existing lines and decides the same way.
     *
     * "Keep what is there" (skip) leaves a lead that already has a line of that type untouched;
     * "overwrite" replaces it. A lead whose line already holds exactly these values is "unchanged".
     *
     * @param  array{type_key: string, company_id: int, options: array{currency: string, frequency: string, certainty: string}}  $assessment
     * @param  array<int, float>  $pending  lead id => amount
     */
    private function writeAssessmentChunk(array $assessment, array $pending, string $conflict, bool $dryRun, array &$report): void
    {
        $service = app(AssessmentService::class);
        $options = $assessment['options'];

        $leads = Lead::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $assessment['company_id'])
            ->whereIn('id', array_keys($pending))
            ->get()->keyBy('id');
        $existing = $service->existingLines(array_keys($pending), $assessment['type_key'], $assessment['company_id']);

        foreach ($pending as $leadId => $amount) {
            $lead = $leads[$leadId] ?? null;

            if ($lead === null) {
                $report['no_target_record']++;

                continue;
            }

            $current = $existing[$leadId] ?? null;

            if ($current !== null
                && abs($current['amount'] - $amount) < 0.000000005
                && $current['currency'] === $options['currency']
                && $current['frequency'] === $options['frequency']
                && $current['certainty'] === $options['certainty']) {
                $report['unchanged']++;

                continue;
            }

            if ($current !== null && $conflict === 'skip') {
                $report['skipped_conflict']++;

                continue;
            }

            if (! $dryRun) {
                try {
                    $draft = $service->startDraft($lead, null, FinancialAssessmentSource::Import);
                    $service->applyValue($draft, $assessment['type_key'], $amount, $current === null ? 'fill' : 'overwrite', $options);
                } catch (AssessmentException $e) {
                    $report['skipped_incompatible']++;
                    if (count($report['incompatible_samples']) < self::SAMPLE_LIMIT) {
                        $report['incompatible_samples'][] = ['record_id' => (int) $leadId, 'value' => (string) $amount, 'reason' => $e->getMessage()];
                    }

                    continue;
                }
            }

            $report['mapped']++;
        }
    }

    /**
     * @param  list<int>  $recordIds
     * @return array<int, string>
     */
    private function existingCustomValues(array $target, array $recordIds): array
    {
        return DB::table('custom_fields_data')
            ->where('custom_field_id', $target['field']->id)
            ->where('model', $target['model'])
            ->whereIn('model_id', $recordIds)
            ->pluck('value', 'model_id')
            ->all();
    }

    /**
     * @param  list<int>  $recordIds
     * @return array<int, mixed>
     */
    private function existingDefinedValues(array $defined, array $recordIds): array
    {
        if ($defined['store'] === DefinedFieldRegistry::STORE_LEAD) {
            return DB::table('leads')->whereIn('id', $recordIds)->pluck($defined['column'], 'id')->all();
        }

        return DB::table('hibarr_deal_custom_fields')->whereIn('deal_id', $recordIds)->pluck($defined['column'], 'deal_id')->all();
    }

    private function writeCustomValue(CustomField $field, string $model, int $recordId, string $value, bool $rowExists): void
    {
        $match = ['custom_field_id' => $field->id, 'model' => $model, 'model_id' => $recordId];

        $rowExists
            ? DB::table('custom_fields_data')->where($match)->update(['value' => $value])
            : DB::table('custom_fields_data')->insert($match + ['value' => $value]);
    }

    private function writeDefinedValue(array $defined, int $recordId, mixed $value): void
    {
        $stored = is_array($value) ? json_encode($value) : $value;

        if ($defined['store'] === DefinedFieldRegistry::STORE_LEAD) {
            DB::table('leads')->where('id', $recordId)->update([
                $defined['column'] => $stored,
                'updated_at' => now(),
            ]);

            return;
        }

        $updated = DB::table('hibarr_deal_custom_fields')->where('deal_id', $recordId)->update([
            $defined['column'] => $stored,
            'updated_at' => now(),
        ]);

        if ($updated === 0 && ! DB::table('hibarr_deal_custom_fields')->where('deal_id', $recordId)->exists()) {
            DB::table('hibarr_deal_custom_fields')->insert([
                'deal_id' => $recordId,
                $defined['column'] => $stored,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    // --------------------------------------------------------------- compare

    private function isFilled(mixed $current, array $target): bool
    {
        if ($current === null || $current === '' || $current === '[]') {
            return false;
        }

        // A yes/no column defaults to false, which is "never set" rather than an answer.
        if ($target['type'] === 'defined' && $target['defined']['kind'] === DefinedFieldRegistry::KIND_BOOL) {
            return (bool) $current;
        }

        return true;
    }

    private function sameValue(mixed $current, mixed $value): bool
    {
        if (is_array($value)) {
            $decoded = is_string($current) ? json_decode($current, true) : $current;

            return is_array($decoded) && $decoded == $value;
        }

        if (is_bool($value)) {
            return (bool) $current === $value;
        }

        return (string) $current === (string) $value;
    }
}
