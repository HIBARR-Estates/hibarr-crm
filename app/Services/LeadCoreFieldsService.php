<?php

namespace App\Services;

use App\Models\CustomField;
use App\Models\LanguageSetting;
use App\Models\Lead;
use App\Enums\AgeRange;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class LeadCoreFieldsService
{
    public const PROMOTED_FIELD_SLUGS = [
        'language',
        'nationality',
        'occupation',
        'date-of-birth',
        'age',
    ];

    /** @var array<int, array<string, int>> */
    private array $slugToIdCache = [];

    public function read(Lead $lead): array
    {
        return [
            'languages' => $lead->languages ?? [],
            'date_of_birth' => $lead->date_of_birth?->format('Y-m-d'),
            'age' => $lead->age,
            'age_range' => $lead->age_range instanceof AgeRange
                ? $lead->age_range->value
                : $lead->age_range,
            'nationality' => $lead->nationality,
            'occupation' => $lead->occupation,
        ];
    }

    public function write(Lead $lead, array $data): void
    {
        if (array_key_exists('languages', $data)) {
            $lead->languages = $this->normalizeLanguages($data['languages']);
        }

        if (array_key_exists('date_of_birth', $data)) {
            $value = $data['date_of_birth'];
            $lead->date_of_birth = $value
                ? Carbon::parse($value)->startOfDay()
                : null;
        }

        if (array_key_exists('age', $data)) {
            $value = $data['age'];
            $lead->age = ($value !== null && $value !== '')
                ? (int) $value
                : null;
        }

        if (array_key_exists('age_range', $data)) {
            $value = $data['age_range'];
            if ($value === null || $value === '') {
                $lead->age_range = null;
            } else {
                $lead->age_range = AgeRange::tryFrom((string) $value);
            }
        }

        if (array_key_exists('nationality', $data)) {
            $lead->nationality = $data['nationality'] ?: null;
        }

        if (array_key_exists('occupation', $data)) {
            $lead->occupation = $data['occupation'] ?: null;
        }
    }

    public function resolveLanguagesForRouting(Lead $lead): array
    {
        $languages = $this->read($lead)['languages'] ?? [];

        return is_array($languages) ? array_values(array_filter($languages)) : [];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function filterCustomFieldsFromPayload(array $payload, int $companyId): array
    {
        $promotedIds = array_values($this->slugToIdMap($companyId));

        foreach (['custom_fields_data', 'custom_fields'] as $key) {
            if (!isset($payload[$key]) || !is_array($payload[$key])) {
                continue;
            }

            $payload[$key] = collect($payload[$key])
                ->reject(function ($value, $fieldKey) use ($promotedIds) {
                    $fieldId = $this->extractFieldId((string) $fieldKey);

                    return $fieldId !== null && in_array($fieldId, $promotedIds, true);
                })
                ->all();
        }

        return $payload;
    }

    /**
     * @param  iterable<mixed>  $fields
     */
    public function filterPromotedFieldDefinitions(iterable $fields): Collection
    {
        return collect($fields)
            ->filter(function ($field) {
                $name = is_array($field) ? ($field['name'] ?? null) : ($field->name ?? null);

                return !in_array($name, self::PROMOTED_FIELD_SLUGS, true);
            })
            ->values();
    }

    public function mergeOntoLead(Lead $lead): Lead
    {
        foreach ($this->read($lead) as $key => $value) {
            $lead->setAttribute($key, $value);
        }

        return $lead;
    }

    public function validationRules(bool $sometimes = false): array
    {
        $languageCodes = LanguageSetting::pluck('language_code')->filter()->implode(',');
        $sometimesRules = $sometimes ? ['sometimes'] : [];
        $languageItemRule = $languageCodes !== ''
            ? 'string|in:' . $languageCodes
            : 'string|max:10';

        return [
            'languages' => [...$sometimesRules, 'nullable', 'array'],
            'languages.*' => $languageItemRule,
            'date_of_birth' => [...$sometimesRules, 'nullable', 'date'],
            'age' => [...$sometimesRules, 'nullable', 'integer', 'min:0', 'max:150'],
            'age_range' => [...$sometimesRules, 'nullable', Rule::enum(AgeRange::class)],
            'nationality' => [...$sometimesRules, 'nullable', 'string', 'max:255'],
            'occupation' => [...$sometimesRules, 'nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, int>
     */
    private function slugToIdMap(int $companyId): array
    {
        if (isset($this->slugToIdCache[$companyId])) {
            return $this->slugToIdCache[$companyId];
        }

        $map = CustomField::query()
            ->where('company_id', $companyId)
            ->whereIn('name', self::PROMOTED_FIELD_SLUGS)
            ->pluck('id', 'name')
            ->map(fn ($id) => (int) $id)
            ->all();

        return $this->slugToIdCache[$companyId] = $map;
    }

    private function extractFieldId(string $fieldKey): ?int
    {
        if (!str_contains($fieldKey, '_')) {
            return is_numeric($fieldKey) ? (int) $fieldKey : null;
        }

        $id = (int) last(explode('_', $fieldKey));

        return $id > 0 ? $id : null;
    }

    private function normalizeLanguages(mixed $value): array
    {
        if ($value === null || $value === '' || $value === []) {
            return [];
        }

        $candidates = is_array($value)
            ? $value
            : preg_split('/\s*,\s*/', (string) $value);

        $lookup = [];
        foreach (LanguageSetting::select('language_code', 'language_name')->get() as $language) {
            $canonicalCode = trim($language->language_code);
            $code = strtolower($canonicalCode);
            $lookup[$code] = $canonicalCode;
            $lookup[strtolower(trim($language->language_name))] = $canonicalCode;
        }

        $codes = [];
        foreach ($candidates as $candidate) {
            if (!is_string($candidate) && !is_numeric($candidate)) {
                continue;
            }

            $token = strtolower(trim((string) $candidate));
            if ($token === '') {
                continue;
            }

            if (isset($lookup[$token])) {
                $codes[] = $lookup[$token];
                continue;
            }

            if (preg_match('/^[a-z]{2}(-[a-z]{2})?$/i', $token)) {
                $codes[] = $lookup[$token] ?? $token;
            }
        }

        return array_values(array_unique(array_filter($codes)));
    }
}
