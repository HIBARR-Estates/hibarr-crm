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

    /** @var array<int, string> Native fields resolved from deal relations rather than columns. */
    public const RELATION_BACKED_FIELDS = [
        'product_id',
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

    public function enabledFlatFieldItems(?int $companyId = null): array
    {
        $enabled = array_flip($this->enabledFieldKeys($companyId));

        return collect($this->flatFieldItems($companyId))
            ->filter(fn (array $item) => isset($enabled[$item['value']]))
            ->values()
            ->all();
    }

    public function isFieldEnabled(string $fieldKey, ?int $companyId = null): bool
    {
        return in_array($fieldKey, $this->enabledFieldKeys($companyId), true);
    }

    /**
     * @return array<int, string>
     */
    public function enabledRelationBackedFieldKeys(?int $companyId = null): array
    {
        $enabled = array_flip($this->enabledFieldKeys($companyId));

        return array_values(array_filter(
            self::RELATION_BACKED_FIELDS,
            fn (string $fieldKey) => isset($enabled[$fieldKey]),
        ));
    }

    public function normalizePayloadFieldKey(string $key): string
    {
        if (str_starts_with($key, 'field_')) {
            return $key;
        }

        if (ctype_digit($key)) {
            return 'field_' . $key;
        }

        return $this->scopeKeyToRoutingKey($key);
    }

    /**
     * Enabled trigger field items, plus persisted triggers whose field_key is no longer enabled.
     *
     * @param array<int, array{field_key?: string}> $persistedTriggers
     * @return array<int, array{value: string, label: string, stale?: bool}>
     */
    public function flatFieldItemsForPackageForm(?int $companyId = null, array $persistedTriggers = []): array
    {
        $items = $this->enabledFlatFieldItems($companyId);
        $known = array_flip(array_column($items, 'value'));
        $allOptions = $this->allFieldOptions($companyId);

        foreach ($persistedTriggers as $trigger) {
            $key = trim((string) ($trigger['field_key'] ?? ''));

            if ($key === '' || isset($known[$key])) {
                continue;
            }

            $items[] = [
                'value' => $key,
                'label' => ($allOptions[$key] ?? $key) . ' (' . __('modules.deal.routingTriggerFieldDisabled') . ')',
                'stale' => true,
            ];
            $known[$key] = true;
        }

        return $items;
    }

    /**
     * Returns enabled routing field keys present in the payload (not value-change detection).
     *
     * @return array<int, string>
     */
    public function routingFieldKeysFromPayload(array $payload, ?int $companyId = null): array
    {
        $enabled = array_flip($this->enabledFieldKeys($companyId));
        $keys = [];

        foreach (array_keys($payload) as $key) {
            if (in_array($key, ['package_id', 'deal_watcher', 'deal_participant'], true)) {
                continue;
            }

            $routingKey = $this->normalizePayloadFieldKey((string) $key);

            if (isset($enabled[$routingKey])) {
                $keys[] = $routingKey;
            }
        }

        return array_values(array_unique($keys));
    }

    /** @deprecated Use routingFieldKeysFromPayload() */
    public function changedRoutingFieldKeysFromPayload(array $payload, ?int $companyId = null): array
    {
        return $this->routingFieldKeysFromPayload($payload, $companyId);
    }

    public function resolveFieldValueFromDeal(Deal $deal, string $fieldKey): mixed
    {
        if (in_array($fieldKey, self::RELATION_BACKED_FIELDS, true)) {
            return $this->resolveRelationBackedFieldValue($deal, $fieldKey);
        }

        if (str_starts_with($fieldKey, 'field_')) {
            return $deal->getCustomFieldsData()[$fieldKey] ?? null;
        }

        return $deal->{$fieldKey} ?? null;
    }

    protected function resolveRelationBackedFieldValue(Deal $deal, string $fieldKey): mixed
    {
        if ($fieldKey === 'product_id') {
            $deal->loadMissing('products');

            return $deal->products->pluck('id')->all();
        }

        return null;
    }

    /**
     * @param array<int, string>|null $fieldKeys
     * @return array<string, mixed>
     */
    public function buildTriggerFieldsFromDeal(Deal $deal, ?array $fieldKeys = null): array
    {
        $companyId = $deal->company_id;
        $keys = $fieldKeys ?? $this->enabledFieldKeys($companyId);
        $keys = array_values(array_filter(
            $keys,
            fn (string $key) => $this->isFieldEnabled($key, $companyId),
        ));

        $fields = [];
        $customFieldData = null;

        foreach ($keys as $fieldKey) {
            if (str_starts_with($fieldKey, 'field_')) {
                $customFieldData ??= $deal->getCustomFieldsData()->toArray();
                $value = $customFieldData[$fieldKey] ?? null;
            } else {
                $value = $this->resolveFieldValueFromDeal($deal, $fieldKey);
            }

            if ($value === null || $value === '' || $value === []) {
                continue;
            }

            $fields[$fieldKey] = $value;
        }

        return $fields;
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

    /**
     * Semantic validation for a set of trigger rows (field enabled, match value
     * present where the mode requires one) — the checks a plain `rules()` array
     * can't express because they depend on other rows in the same field.
     *
     * Shared by StorePackageRequest (Blade package form) and
     * PackageSettingsController (React packages settings page) so the two
     * cannot drift.
     *
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, array<int, string>> messages keyed by
     *         "routing_triggers.{index}.{field}", ready for
     *         ValidationException::withMessages() or $validator->errors()->add().
     */
    public function validateTriggerRows(array $rows, ?int $companyId = null): array
    {
        $companyId = $companyId ?? company()?->id;
        $enabledKeys = array_flip($this->enabledFieldKeys($companyId));
        $errors = [];

        foreach ($rows as $index => $row) {
            if (!is_array($row) || $this->isEmptyTriggerRow($row)) {
                continue;
            }

            $fieldKey = trim((string) ($row['field_key'] ?? ''));

            if ($fieldKey === '') {
                $errors["routing_triggers.{$index}.field_key"] = [
                    __('validation.required', ['attribute' => 'deal field']),
                ];

                // No field key means nothing downstream can be validated either.
                continue;
            }

            if (!isset($enabledKeys[$fieldKey])) {
                $errors["routing_triggers.{$index}.field_key"] = [
                    __('modules.deal.routingTriggerFieldDisabled'),
                ];
            }

            if (empty($row['match_mode'])) {
                $errors["routing_triggers.{$index}.match_mode"] = [
                    __('validation.required', ['attribute' => 'match mode']),
                ];
            }

            if (
                ($row['match_mode'] ?? null) === self::MATCH_MODE_EXACT
                && !filled($row['match_value'] ?? null)
            ) {
                $errors["routing_triggers.{$index}.match_value"] = [
                    __('validation.required', ['attribute' => 'match value']),
                ];
            }
        }

        return $errors;
    }

    /**
     * @param array<string, mixed> $row
     */
    public function isEmptyTriggerRow(array $row): bool
    {
        return trim((string) ($row['field_key'] ?? '')) === ''
            && trim((string) ($row['match_mode'] ?? '')) === ''
            && trim((string) ($row['match_value'] ?? '')) === '';
    }
}
