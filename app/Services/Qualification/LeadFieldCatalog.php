<?php

namespace App\Services\Qualification;

use App\Enums\AgeRange;
use App\Enums\Gender;
use App\Enums\LeadTemperature;
use App\Enums\Salutation;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Lead;
use App\Models\LeadCategory;

/**
 * The lead fields a qualification answer may be written into, and (where the
 * field is a fixed set) the values an answer option can map onto.
 *
 * Shared by the mapping settings page (to build the dropdowns) and by
 * QualificationLeadFieldWriter (to validate + write).
 */
class LeadFieldCatalog
{
    /** Core lead columns that accept a plain string. */
    private const TEXT_FIELDS = [
        'client_name' => 'Name',
        'client_email' => 'Email',
        'mobile' => 'Mobile',
        'cell' => 'Cell',
        'office' => 'Office phone',
        'client_whatsapp' => 'WhatsApp',
        'client_telegram' => 'Telegram',
        'company_name' => 'Company name',
        'website' => 'Website',
        'address' => 'Address',
        'city' => 'City',
        'state' => 'State',
        'country' => 'Country',
        'postal_code' => 'Postal code',
        'nationality' => 'Nationality',
        'occupation' => 'Occupation',
        'note' => 'Note',
    ];

    /** Core lead columns backed by an enum — options can map onto these values. */
    private const ENUM_FIELDS = [
        'salutation' => ['label' => 'Salutation', 'enum' => Salutation::class],
        'gender' => ['label' => 'Gender', 'enum' => Gender::class],
        'temperature' => ['label' => 'Temperature', 'enum' => LeadTemperature::class],
        'age_range' => ['label' => 'Age range', 'enum' => AgeRange::class],
    ];

    /** Custom field types whose stored value is one of a fixed option list. */
    private const CHOICE_CUSTOM_FIELD_TYPES = ['select', 'radio', 'multiselect', 'checkbox'];

    /**
     * @return list<array{value: string, label: string, group: string, values: list<array{value: string, label: string}>}>
     */
    public function fields(int $companyId): array
    {
        $fields = [];

        foreach (self::TEXT_FIELDS as $name => $label) {
            $fields[] = [
                'value' => $name,
                'label' => $label,
                'group' => 'Lead details',
                'values' => [],
            ];
        }

        foreach (self::ENUM_FIELDS as $name => $meta) {
            $fields[] = [
                'value' => $name,
                'label' => $meta['label'],
                'group' => 'Lead details',
                'values' => array_map(
                    fn ($case) => [
                        'value' => (string) $case->value,
                        'label' => method_exists($case, 'label') ? $case->label() : (string) $case->value,
                    ],
                    $meta['enum']::cases()
                ),
            ];
        }

        $fields[] = [
            'value' => 'category',
            'label' => 'Category',
            'group' => 'Lead details',
            'values' => $this->categoryValues($companyId),
        ];

        foreach ($this->customFields($companyId) as $customField) {
            $fields[] = [
                'value' => 'custom_field_'.$customField->id,
                'label' => $customField->label,
                'group' => 'Custom fields',
                'values' => $this->customFieldValues($customField),
            ];
        }

        return $fields;
    }

    /** @return array<string, array{value: string, label: string, group: string, values: list<array{value: string, label: string}>}> */
    public function fieldsByKey(int $companyId): array
    {
        return collect($this->fields($companyId))->keyBy('value')->all();
    }

    public static function isCustomField(string $field): bool
    {
        return str_starts_with($field, 'custom_field_');
    }

    public static function isCategoryField(string $field): bool
    {
        return $field === 'category';
    }

    /** @return list<array{value: string, label: string}> */
    private function categoryValues(int $companyId): array
    {
        return LeadCategory::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->orderBy('category_name')
            ->get(['id', 'category_name'])
            ->map(fn (LeadCategory $category) => [
                'value' => (string) $category->id,
                'label' => $category->category_name,
            ])
            ->values()
            ->all();
    }

    /** @return \Illuminate\Support\Collection<int, CustomField> */
    private function customFields(int $companyId)
    {
        $group = CustomFieldGroup::where('model', Lead::CUSTOM_FIELD_MODEL)->first();

        if (! $group) {
            return collect();
        }

        return CustomField::where('custom_field_group_id', $group->id)
            ->where('company_id', $companyId)
            ->orderBy('label')
            ->get();
    }

    /** @return list<array{value: string, label: string}> */
    private function customFieldValues(CustomField $customField): array
    {
        if (! in_array($customField->type, self::CHOICE_CUSTOM_FIELD_TYPES, true)) {
            return [];
        }

        $raw = $customField->values;

        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = json_last_error() === JSON_ERROR_NONE ? $decoded : explode(',', $raw);
        }

        if (! is_array($raw)) {
            return [];
        }

        return collect($raw)
            ->map(fn ($value) => is_array($value) ? ($value['value'] ?? $value['label'] ?? null) : $value)
            ->filter(fn ($value) => is_scalar($value) && trim((string) $value) !== '')
            ->map(fn ($value) => ['value' => trim((string) $value), 'label' => trim((string) $value)])
            ->values()
            ->all();
    }
}
