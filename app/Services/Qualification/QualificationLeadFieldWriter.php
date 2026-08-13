<?php

namespace App\Services\Qualification;

use App\Models\Lead;
use App\Models\LeadCategory;
use App\Models\LeadQualification;
use App\Models\LeadQualificationAnswer;
use App\Models\QualificationFieldMapping;
use App\Models\QualificationScriptSetting;
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

        if ($coreUpdates === [] && $customUpdates === [] && $categoryIds === null) {
            return [];
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

            return [];
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
