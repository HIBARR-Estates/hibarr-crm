<?php

namespace App\Services\Qualification;

use App\Enums\FinancialAssessmentSource;
use App\Models\Lead;
use App\Models\LeadCategory;
use App\Models\LeadQualification;
use App\Models\LeadQualificationAnswer;
use App\Models\QualificationFieldMapping;
use App\Models\QualificationScriptSetting;
use App\Services\FinancialAssessment\AmountParser;
use App\Services\FinancialAssessment\AssessmentException;
use App\Services\FinancialAssessment\AssessmentFieldRegistry;
use App\Services\FinancialAssessment\AssessmentService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Applies a script's field mapping to the lead once a qualification call is
 * completed — this is what makes the tab's "Written to <field>" badge true.
 */
class QualificationLeadFieldWriter
{
    /** Custom field types that store a list rather than a scalar. */
    private const MULTI_VALUE_TYPES = ['multiselect', 'checkbox'];

    public function __construct(private LeadFieldCatalog $catalog) {}

    /**
     * @return list<string> lead fields actually written
     */
    public function apply(LeadQualification $qualification, ?Lead $lead): array
    {
        if (! $lead) {
            return [];
        }

        $setting = QualificationScriptSetting::withoutGlobalScopes()
            ->where('company_id', $qualification->company_id)
            ->where('template_id', $qualification->template_id)
            ->with('mappings')
            ->first();

        if (! $setting || ! $setting->auto_write) {
            return [];
        }

        $mappings = $setting->mappings->keyBy('segment_key');
        $catalog = $this->catalog->fieldsByKey((int) $qualification->company_id);

        $coreUpdates = [];
        $customUpdates = [];
        $categoryIds = null;
        $written = [];
        $assessmentWrites = [];

        foreach ($qualification->answers as $answer) {
            /** @var QualificationFieldMapping|null $mapping */
            $mapping = $mappings->get($answer->segment_key);

            if (! $mapping || ! $mapping->lead_field || ! isset($catalog[$mapping->lead_field])) {
                continue;
            }

            $values = $this->resolveValues($answer, $mapping);

            if ($values === []) {
                continue;
            }

            $field = $mapping->lead_field;

            // A financial assessment line: the answer is read as an amount and goes into the lead's
            // draft once the lead's own fields are done. Stored after success, so a refused write is
            // never reported as written.
            if (AssessmentFieldRegistry::typeKeyOf($field) !== null) {
                $write = $this->assessmentWrite($mapping, $field, $values);

                if ($write !== null) {
                    $assessmentWrites[$field] = $write;
                }

                continue;
            }

            if ($mapping->write_mode !== QualificationFieldMapping::MODE_OVERWRITE
                && ! $this->isEmptyOnLead($lead, $field)) {
                continue;
            }

            if (LeadFieldCatalog::isCategoryField($field)) {
                $resolved = $this->resolveCategoryIds($lead, $values);

                if ($resolved === []) {
                    continue;
                }

                $categoryIds = $resolved;
            } elseif (LeadFieldCatalog::isCustomField($field)) {
                $customUpdates[$field] = $this->isMultiValueCustomField($field)
                    ? $values
                    : implode(', ', $values);
            } else {
                $coreUpdates[$field] = implode(', ', $values);
            }

            $written[] = $field;
        }

        $assessmentWritten = $this->applyAssessmentWrites($qualification, $lead, $assessmentWrites);

        if ($coreUpdates === [] && $customUpdates === [] && $categoryIds === null) {
            return $assessmentWritten;
        }

        try {
            DB::transaction(function () use ($lead, $coreUpdates, $customUpdates, $categoryIds) {
                if ($coreUpdates !== []) {
                    $lead->forceFill($coreUpdates)->save();
                }

                if ($categoryIds !== null) {
                    $lead->syncCategories($categoryIds);
                }

                if ($customUpdates !== []) {
                    $lead->updateCustomFieldData($customUpdates, (int) $lead->company_id);
                }
            });
        } catch (\Throwable $e) {
            // A bad mapping must never fail the call itself — the answers are
            // already saved, and the tab keeps showing them either way.
            Log::warning('Qualification field write failed', [
                'qualification_id' => $qualification->id,
                'lead_id' => $lead->id,
                'error' => $e->getMessage(),
            ]);

            return $assessmentWritten;
        }

        return [...$written, ...$assessmentWritten];
    }

    /**
     * @param  list<string>  $values
     * @return array{type_key: string, amount: float, mode: string, companions: array<string, string>}|null
     */
    private function assessmentWrite(QualificationFieldMapping $mapping, string $field, array $values): ?array
    {
        $amount = null;
        foreach ($values as $value) {
            $amount = AmountParser::parse($value);
            if ($amount !== null) {
                break;
            }
        }

        if ($amount === null) {
            Log::info('Qualification answer is not an amount; assessment field skipped', ['field' => $field]);

            return null;
        }

        $companions = [];
        foreach (['currency', 'frequency', 'certainty'] as $name) {
            $option = $mapping->target_options[$name] ?? null;
            if (filled($option)) {
                $companions[$name] = (string) $option;
            }
        }

        return [
            'type_key' => (string) AssessmentFieldRegistry::typeKeyOf($field),
            'amount' => $amount,
            // "Only if empty" fills a type the lead has no line for yet; a new draft already holds the
            // current assessment's lines, so a type that is already known is left alone.
            'mode' => $mapping->write_mode === QualificationFieldMapping::MODE_OVERWRITE ? 'overwrite' : 'fill',
            'companions' => $companions,
        ];
    }

    /**
     * Store the collected assessment writes in the lead's open draft (source "call"; never finalises).
     * A refused line is skipped and logged: a bad mapping must never fail the call.
     *
     * @param  array<string, array{type_key: string, amount: float, mode: string, companions: array<string, string>}>  $writes
     * @return list<string> the lead fields actually written
     */
    private function applyAssessmentWrites(LeadQualification $qualification, Lead $lead, array $writes): array
    {
        if ($writes === []) {
            return [];
        }

        $service = app(AssessmentService::class);
        $written = [];

        try {
            $draft = $service->startDraft($lead, $qualification->agent_id ? (int) $qualification->agent_id : null, FinancialAssessmentSource::Call);
        } catch (\Throwable $e) {
            Log::warning('Qualification assessment draft could not be started', ['qualification_id' => $qualification->id, 'error' => $e->getMessage()]);

            return [];
        }

        foreach ($writes as $field => $write) {
            try {
                $result = $service->applyValue($draft, $write['type_key'], $write['amount'], $write['mode'], $write['companions']);

                if ($result['action'] !== 'skipped') {
                    $written[] = $field;
                }
            } catch (AssessmentException $e) {
                Log::warning('Qualification assessment field skipped', ['field' => $field, 'reason' => $e->reason, 'qualification_id' => $qualification->id]);
            }
        }

        return $written;
    }

    /** @return list<string> */
    private function resolveValues(LeadQualificationAnswer $answer, QualificationFieldMapping $mapping): array
    {
        $optionMap = $mapping->option_map ?? [];
        $answerValues = array_filter(
            array_map('strval', $answer->answer_values ?? []),
            fn (string $value) => $value !== ''
        );

        if ($optionMap !== [] && $answerValues !== []) {
            return array_values(array_filter(
                array_map(fn (string $key) => trim((string) ($optionMap[$key] ?? '')), $answerValues),
                fn (string $value) => $value !== ''
            ));
        }

        $text = trim((string) ($answer->answer_text ?? ''));

        if ($text !== '') {
            return [$text];
        }

        return array_values($answerValues);
    }

    /**
     * @param  list<string>  $values
     * @return list<int>
     */
    private function resolveCategoryIds(Lead $lead, array $values): array
    {
        $ids = [];

        foreach ($values as $value) {
            $id = $this->resolveCategoryId($lead, $value);

            if ($id !== null) {
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }

    private function resolveCategoryId(Lead $lead, string $value): ?int
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (ctype_digit($value)) {
            $id = (int) $value;
            $exists = LeadCategory::withoutGlobalScopes()
                ->where('company_id', $lead->company_id)
                ->where('id', $id)
                ->exists();

            return $exists ? $id : null;
        }

        return LeadCategory::resolveFromText((int) $lead->company_id, $value)?->id;
    }

    private function isEmptyOnLead(Lead $lead, string $field): bool
    {
        if (LeadFieldCatalog::isCategoryField($field)) {
            return blank($lead->category_id);
        }

        if (! LeadFieldCatalog::isCustomField($field)) {
            return blank($lead->getAttribute($field));
        }

        $value = DB::table('custom_fields_data')
            ->where('model', Lead::CUSTOM_FIELD_MODEL)
            ->where('model_id', $lead->id)
            ->where('custom_field_id', $this->customFieldId($field))
            ->value('value');

        return blank($value);
    }

    private function isMultiValueCustomField(string $field): bool
    {
        $type = DB::table('custom_fields')->where('id', $this->customFieldId($field))->value('type');

        return in_array((string) $type, self::MULTI_VALUE_TYPES, true);
    }

    private function customFieldId(string $field): int
    {
        return (int) str_replace('custom_field_', '', $field);
    }
}
