<?php

namespace App\Services;

use App\Models\CustomField;
use App\Models\Lead;

/**
 * Shared write rules for external writes (contact/deal API, gRPC) to an
 * existing lead: fill what is empty, never overwrite, and let multi-value
 * data only grow.
 */
class LeadApiFieldMerger
{
    private const MULTI_VALUE_TYPES = ['checkbox', 'multiselect', 'multiSelectCountry'];

    /**
     * Keep only the custom field values that fill an empty field. Multi-value
     * fields (checkbox, multiselect, countries) are additive: incoming options
     * are added to the stored ones. Any other stored value is left untouched.
     *
     * @param  array<string|int, mixed>  $customFieldsData  keyed field_{id} (or the bare id)
     * @return array<string|int, mixed>
     */
    public function customFieldValues(Lead $lead, array $customFieldsData): array
    {
        if ($customFieldsData === []) {
            return [];
        }

        $stored = $lead->getCustomFieldsData()->toArray();
        $types = CustomField::whereIn('id', array_filter(array_map(fn ($key) => $this->fieldId($key), array_keys($customFieldsData))))
            ->pluck('type', 'id');

        $result = [];
        foreach ($customFieldsData as $key => $value) {
            $id = $this->fieldId($key);
            $current = $id !== null ? ($stored['field_'.$id] ?? null) : null;
            if (blank($current)) {
                $result[$key] = $value;

                continue;
            }

            if (! in_array($types->get($id), self::MULTI_VALUE_TYPES, true)) {
                continue;
            }

            $currentList = $this->valueList($current);
            $merged = array_values(array_unique(array_merge($currentList, $this->valueList($value))));
            if ($merged !== $currentList) {
                $result[$key] = $merged;
            }
        }

        return $result;
    }

    private function fieldId(string|int $key): ?int
    {
        return preg_match('/(\d+)$/', (string) $key, $m) ? (int) $m[1] : null;
    }

    /**
     * A stored or incoming multi-value custom field as a list of strings —
     * JSON array, legacy comma-joined string, or a plain array.
     *
     * @return list<string>
     */
    private function valueList(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : explode(',', $value);
        }

        return array_values(array_filter(
            array_map(fn ($item) => trim((string) $item), (array) $value),
            fn ($item) => $item !== ''
        ));
    }
}
