<?php

namespace App\Services;

use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\Package;
use App\Models\PackageRoutingTrigger;
use Illuminate\Support\Collection;

class PackageRoutingFieldCatalog
{
    public const MATCH_MODE_EXACT = 'exact';
    public const MATCH_MODE_PRESENT = 'present';

    public const MATCH_MODES = [
        self::MATCH_MODE_EXACT => 'Match specific value',
        self::MATCH_MODE_PRESENT => 'Any non-empty value',
    ];

    public const NATIVE_FIELDS = [
        'category_id' => 'Deal category',
        'product_id' => 'Product',
    ];

    /**
     * @return array<string, string>
     */
    public function nativeFieldOptions(): array
    {
        return self::NATIVE_FIELDS;
    }

    /**
     * @return array<string, string>
     */
    public function matchModeOptions(): array
    {
        return self::MATCH_MODES;
    }

    /**
     * @return array<string, string>
     */
    public function customFieldOptions(?int $companyId = null): array
    {
        $resolvedCompanyId = $companyId ?? company()?->id;

        $groupQuery = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL);
        if ($resolvedCompanyId) {
            $groupQuery->where('company_id', $resolvedCompanyId);
        }
        $group = $groupQuery->first();

        if (!$group) {
            return [];
        }

        $fieldsQuery = CustomField::query()
            ->where('custom_field_group_id', $group->id);
        if ($resolvedCompanyId) {
            $fieldsQuery->where('company_id', $resolvedCompanyId);
        }

        return $fieldsQuery
            ->orderBy('label')
            ->get()
            ->mapWithKeys(fn (CustomField $field) => [
                'field_' . $field->id => $field->label,
            ])
            ->all();
    }

    /**
     * @return array<string, string>
     */
    public function allFieldOptions(?int $companyId = null): array
    {
        return array_merge(
            $this->nativeFieldOptions(),
            $this->customFieldOptions($companyId),
        );
    }

    /**
     * @return array<int, string>
     */
    public function enabledFieldKeys(?int $companyId = null): array
    {
        $company = $companyId ? \App\Models\Company::find($companyId) : company();
        $configured = $company?->package_pipeline_routing_trigger_fields;

        if (is_string($configured)) {
            $configured = json_decode($configured, true);
        }

        if (is_array($configured)) {
            return array_values($configured);
        }

        return array_keys($this->allFieldOptions($companyId));
    }

    public function isFieldEnabled(string $fieldKey, ?int $companyId = null): bool
    {
        return in_array($fieldKey, $this->enabledFieldKeys($companyId), true);
    }

    /**
     * @param array<int, array{field_key?: string, match_mode?: string|null, match_value?: string|null}> $rows
     */
    public function normalizeTriggerRows(array $rows, ?int $companyId = null): array
    {
        $enabled = $this->enabledFieldKeys($companyId);
        $normalized = [];

        foreach ($rows as $row) {
            $fieldKey = trim((string) ($row['field_key'] ?? ''));

            if ($fieldKey === '' || !in_array($fieldKey, $enabled, true)) {
                continue;
            }

            $matchMode = trim((string) ($row['match_mode'] ?? self::MATCH_MODE_EXACT));
            if (!array_key_exists($matchMode, self::MATCH_MODES)) {
                $matchMode = self::MATCH_MODE_EXACT;
            }

            $matchValue = $row['match_value'] ?? null;
            $matchValue = is_string($matchValue) ? trim($matchValue) : $matchValue;
            $matchValue = $matchValue === '' ? null : $matchValue;

            if ($matchMode === self::MATCH_MODE_EXACT && $matchValue === null) {
                continue;
            }

            $normalized[] = [
                'field_key' => $fieldKey,
                'match_mode' => $matchMode,
                'match_value' => $matchMode === self::MATCH_MODE_PRESENT ? null : $matchValue,
            ];
        }

        return $normalized;
    }

    /**
     * @return Collection<int, Package>
     */
    public function packagesMatchingFieldValue(
        int $companyId,
        string $fieldKey,
        mixed $fieldValue,
    ): Collection {
        if (!$this->isFieldEnabled($fieldKey, $companyId)) {
            return collect();
        }

        $triggers = PackageRoutingTrigger::query()
            ->where('company_id', $companyId)
            ->where('field_key', $fieldKey)
            ->with(['package.packagePipeline'])
            ->get();

        $values = $this->normalizeSubmittedValues($fieldValue);

        return $triggers
            ->filter(fn (PackageRoutingTrigger $trigger) => $this->triggerMatches(
                $trigger,
                $values,
            ))
            ->map(fn (PackageRoutingTrigger $trigger) => $trigger->package)
            ->filter()
            ->unique('id')
            ->values();
    }

    /**
     * @return array<int, string>
     */
    protected function normalizeSubmittedValues(mixed $fieldValue): array
    {
        if ($fieldValue === null || $fieldValue === '' || $fieldValue === []) {
            return [];
        }

        $values = is_array($fieldValue) ? $fieldValue : [$fieldValue];

        return array_values(array_filter(array_map(
            fn ($value) => trim((string) $value),
            $values,
        ), fn ($value) => $value !== ''));
    }

    /**
     * @param array<int, string> $submittedValues
     */
    protected function triggerMatches(PackageRoutingTrigger $trigger, array $submittedValues): bool
    {
        if (empty($submittedValues)) {
            return false;
        }

        if (!$trigger->package) {
            return false;
        }

        $matchMode = $trigger->match_mode ?: self::MATCH_MODE_EXACT;

        if ($matchMode === self::MATCH_MODE_PRESENT) {
            return true;
        }

        $expected = $trigger->match_value;

        if ($expected === null || $expected === '') {
            return false;
        }

        foreach ($submittedValues as $value) {
            if (strcasecmp($value, (string) $expected) === 0) {
                return true;
            }
        }

        return false;
    }
}
