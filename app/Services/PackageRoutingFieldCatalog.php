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
    /** @var array<int|string, array<int, string>> */
    private array $enabledFieldKeysCache = [];

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
     * Scopeable deal/lead fields grouped for admin UI (aligned with pipeline field linking).
     *
     * @return array<string, array<int, array{value: string, label: string}>>
     */
    public function groupedFieldItems(?int $companyId = null): array
    {
        $companyId = $companyId ?? company()?->id;
        $allowed = array_flip($this->allFieldOptions($companyId));

        $catalog = app(PipelineScopeResolverService::class)->getScopeableFieldsCatalog();
        $groups = [];

        foreach ($catalog as $model => $fields) {
            $groupLabel = class_basename($model);
            $items = [];

            foreach ($fields as $fieldKey => $fieldLabel) {
                $routingKey = $this->scopeKeyToRoutingKey($fieldKey);
                if (!isset($allowed[$routingKey])) {
                    continue;
                }

                $items[] = [
                    'value' => $routingKey,
                    'label' => $fieldLabel,
                ];
            }

            if ($items !== []) {
                $groups[$groupLabel] = $items;
            }
        }

        foreach ($this->nativeFieldOptions() as $key => $label) {
            if (!isset($allowed[$key])) {
                continue;
            }

            $alreadyListed = false;
            foreach ($groups as $items) {
                foreach ($items as $item) {
                    if ($item['value'] === $key) {
                        $alreadyListed = true;
                        break 2;
                    }
                }
            }

            if (!$alreadyListed) {
                $groups['Deal'] = array_merge(
                    [['value' => $key, 'label' => $label]],
                    $groups['Deal'] ?? [],
                );
            }
        }

        if ($groups === [] && $allowed !== []) {
            $groups['Deal'] = collect($this->allFieldOptions($companyId))
                ->map(fn (string $label, string $value) => [
                    'value' => $value,
                    'label' => $label,
                ])
                ->values()
                ->all();
        }

        return $groups;
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public function flatFieldItems(?int $companyId = null): array
    {
        $flat = [];
        foreach ($this->groupedFieldItems($companyId) as $items) {
            foreach ($items as $item) {
                $flat[] = $item;
            }
        }

        return $flat;
    }

    protected function scopeKeyToRoutingKey(string $scopeKey): string
    {
        if (str_starts_with($scopeKey, 'custom_field_')) {
            return 'field_' . substr($scopeKey, strlen('custom_field_'));
        }

        return $scopeKey;
    }

    /**
     * @return array<int, string>
     */
    public function enabledFieldKeys(?int $companyId = null): array
    {
        $cacheKey = $companyId ?? 'current';

        if (array_key_exists($cacheKey, $this->enabledFieldKeysCache)) {
            return $this->enabledFieldKeysCache[$cacheKey];
        }

        $company = $companyId ? \App\Models\Company::find($companyId) : company();
        $configured = $company?->package_pipeline_routing_trigger_fields;

        if (is_string($configured)) {
            $configured = json_decode($configured, true);
        }

        $keys = is_array($configured)
            ? array_values($configured)
            : array_keys($this->allFieldOptions($companyId));

        return $this->enabledFieldKeysCache[$cacheKey] = $keys;
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

            // package_routing_triggers has a unique(package_id, field_key) constraint,
            // so only one row per field can survive; later rows win.
            $normalized[$fieldKey] = [
                'field_key' => $fieldKey,
                'match_mode' => $matchMode,
                'match_value' => $matchMode === self::MATCH_MODE_PRESENT ? null : $matchValue,
            ];
        }

        return array_values($normalized);
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
