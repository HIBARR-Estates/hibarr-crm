<?php

namespace App\Services;

use App\Enums\LeadContactMethodType;
use App\Models\Lead;
use App\Models\LeadContactMethod;
use Illuminate\Support\Facades\Schema;

class LeadContactMethodService
{
    public const INVALIDATED_PREFIX = 'invalid_lead_';

    /** @var list<string> */
    public const ABSORB_FIELDS = ['client_email', 'mobile', 'cell', 'office'];

    /** @var array<string, int> */
    private const PHONE_SOURCE_PRIORITY = [
        'mobile' => 3,
        'cell' => 2,
        'office' => 1,
    ];

    public function syncFromLeadColumns(Lead $lead): void
    {
        if (! $this->tableReady()) {
            return;
        }

        $this->syncEmail($lead);
        $this->syncPhones($lead);
    }

    public function addAlternate(
        Lead $lead,
        LeadContactMethodType $type,
        mixed $raw,
        ?string $sourceField = null,
    ): void {
        if (! $this->tableReady()) {
            return;
        }

        $parsed = $type === LeadContactMethodType::Email
            ? $this->parseEmail($raw)
            : $this->parsePhone($raw);

        if ($parsed === null) {
            return;
        }

        $this->upsertMethod(
            $lead,
            $type,
            $parsed['identifier'],
            $parsed['normalized'],
            false,
            $sourceField,
        );
    }

    /**
     * Seed A's mains, copy B's conflicting email/phone as non-main, move B's rows.
     * Uses original conflict values — do not call after unique-field invalidation.
     *
     * @param  array<string, array{primary: mixed, duplicate: mixed}>  $contactConflicts
     */
    public function absorbFromLead(Lead $primary, Lead $duplicate, array $contactConflicts): void
    {
        if (! $this->tableReady()) {
            return;
        }

        $this->syncFromLeadColumns($primary);

        foreach (self::ABSORB_FIELDS as $field) {
            if (! isset($contactConflicts[$field])) {
                continue;
            }

            $type = $field === 'client_email'
                ? LeadContactMethodType::Email
                : LeadContactMethodType::Phone;

            $this->addAlternate(
                $primary,
                $type,
                $contactConflicts[$field]['duplicate'],
                $field,
            );
        }

        $this->moveDuplicateRows($primary, $duplicate);
    }

    private function syncEmail(Lead $lead): void
    {
        $parsed = $this->parseEmail($lead->client_email);

        if ($parsed === null) {
            $this->demoteMains($lead, LeadContactMethodType::Email, null);

            return;
        }

        $this->demoteMains($lead, LeadContactMethodType::Email, $parsed['normalized']);
        $this->upsertMethod(
            $lead,
            LeadContactMethodType::Email,
            $parsed['identifier'],
            $parsed['normalized'],
            true,
            'client_email',
        );
    }

    private function syncPhones(Lead $lead): void
    {
        $parsedByField = [
            'mobile' => $this->parsePhone($lead->mobile),
            'cell' => $this->parsePhone($lead->cell),
            'office' => $this->parsePhone($lead->office),
        ];

        $mainField = $parsedByField['mobile'] !== null
            ? 'mobile'
            : ($parsedByField['cell'] !== null ? 'cell' : null);

        $mainNormalized = $mainField !== null
            ? $parsedByField[$mainField]['normalized']
            : null;

        $this->demoteMains($lead, LeadContactMethodType::Phone, $mainNormalized);

        $byNormalized = [];
        foreach (['mobile', 'cell', 'office'] as $field) {
            $parsed = $parsedByField[$field];
            if ($parsed === null) {
                continue;
            }

            $normalized = $parsed['normalized'];
            $existingPriority = self::PHONE_SOURCE_PRIORITY[$byNormalized[$normalized]['source_field'] ?? ''] ?? 0;
            $newPriority = self::PHONE_SOURCE_PRIORITY[$field] ?? 0;

            if (! isset($byNormalized[$normalized]) || $newPriority > $existingPriority) {
                $byNormalized[$normalized] = [
                    'identifier' => $parsed['identifier'],
                    'normalized' => $normalized,
                    'source_field' => $field,
                ];
            }
        }

        foreach ($byNormalized as $row) {
            $this->upsertMethod(
                $lead,
                LeadContactMethodType::Phone,
                $row['identifier'],
                $row['normalized'],
                $row['normalized'] === $mainNormalized,
                $row['source_field'],
            );
        }
    }

    private function demoteMains(Lead $lead, LeadContactMethodType $type, ?string $keepNormalized): void
    {
        $query = LeadContactMethod::query()
            ->where('lead_id', $lead->id)
            ->where('type', $type->value)
            ->where('is_main', true);

        if ($keepNormalized !== null) {
            $query->where('normalized', '!=', $keepNormalized);
        }

        $query->update(['is_main' => false]);
    }

    /**
     * @return array{identifier: string, normalized: string}|null
     */
    public function parseEmail(mixed $value): ?array
    {
        if ($this->isEmptyOrInvalidated($value)) {
            return null;
        }

        $string = trim((string) $value);
        if ($string === '' || str_starts_with($string, self::INVALIDATED_PREFIX)) {
            return null;
        }

        $normalized = strtolower($string);

        return [
            'identifier' => $normalized,
            'normalized' => $normalized,
        ];
    }

    /**
     * Canonical phone: identifier is +digits; normalized is digits only.
     * Accepts antd JSON, legacy JSON, or a plain string (mirrors Lead::getMobileWithPhoneCodeAttribute).
     *
     * @return array{identifier: string, normalized: string}|null
     */
    public function parsePhone(mixed $value): ?array
    {
        if ($this->isEmptyOrInvalidated($value)) {
            return null;
        }

        if (is_array($value)) {
            return $this->digitsFromPhoneArray($value);
        }

        $string = trim((string) $value);
        if ($string === '' || str_starts_with($string, self::INVALIDATED_PREFIX)) {
            return null;
        }

        $decoded = json_decode($string, true);
        if (is_array($decoded)) {
            return $this->digitsFromPhoneArray($decoded);
        }

        $digits = preg_replace('/\D+/', '', $string) ?? '';
        if ($digits === '') {
            return null;
        }

        return [
            'identifier' => '+'.$digits,
            'normalized' => $digits,
        ];
    }

    /**
     * @param  array<string, mixed>  $decoded
     * @return array{identifier: string, normalized: string}|null
     */
    private function digitsFromPhoneArray(array $decoded): ?array
    {
        if (isset($decoded['countryCode'], $decoded['phoneNumber'])) {
            $digits = implode('', array_filter([
                preg_replace('/\D+/', '', (string) $decoded['countryCode']) ?: null,
                preg_replace('/\D+/', '', (string) ($decoded['areaCode'] ?? '')) ?: null,
                preg_replace('/\D+/', '', (string) $decoded['phoneNumber']) ?: null,
            ]));

            if ($digits === '') {
                return null;
            }

            return [
                'identifier' => '+'.$digits,
                'normalized' => $digits,
            ];
        }

        if (isset($decoded['phone'])) {
            $digits = preg_replace('/\D+/', '', (string) $decoded['phone']) ?? '';
            if ($digits === '') {
                return null;
            }

            return [
                'identifier' => '+'.$digits,
                'normalized' => $digits,
            ];
        }

        return null;
    }

    private function upsertMethod(
        Lead $lead,
        LeadContactMethodType $type,
        string $identifier,
        string $normalized,
        bool $isMain,
        ?string $sourceField,
    ): void {
        $existing = LeadContactMethod::query()
            ->where('lead_id', $lead->id)
            ->where('type', $type->value)
            ->where('normalized', $normalized)
            ->first();

        if ($existing === null) {
            LeadContactMethod::query()->create([
                'lead_id' => $lead->id,
                'company_id' => $lead->company_id,
                'type' => $type,
                'identifier' => $identifier,
                'normalized' => $normalized,
                'is_main' => $isMain,
                'source_field' => $sourceField,
            ]);

            return;
        }

        $updates = [];

        if ($isMain && ! $existing->is_main) {
            $updates['is_main'] = true;
        }

        if ($existing->identifier !== $identifier) {
            $updates['identifier'] = $identifier;
        }

        $newPriority = self::PHONE_SOURCE_PRIORITY[$sourceField ?? ''] ?? 0;
        $oldPriority = self::PHONE_SOURCE_PRIORITY[$existing->source_field ?? ''] ?? 0;
        if ($sourceField !== null && ($existing->source_field === null || $newPriority > $oldPriority || ($type === LeadContactMethodType::Email && $existing->source_field !== $sourceField))) {
            $updates['source_field'] = $sourceField;
        }

        if ($updates === []) {
            return;
        }

        $existing->fill($updates);
        $existing->save();
    }

    private function moveDuplicateRows(Lead $primary, Lead $duplicate): void
    {
        $duplicateRows = LeadContactMethod::query()
            ->where('lead_id', $duplicate->id)
            ->get();

        foreach ($duplicateRows as $row) {
            $clash = LeadContactMethod::query()
                ->where('lead_id', $primary->id)
                ->where('type', $row->type)
                ->where('normalized', $row->normalized)
                ->exists();

            if ($clash) {
                $row->delete();

                continue;
            }

            $row->lead_id = $primary->id;
            $row->company_id = $primary->company_id ?? $row->company_id;
            $row->is_main = false;
            $row->save();
        }
    }

    private function isEmptyOrInvalidated(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }

        if (! is_string($value) && ! is_array($value)) {
            $value = (string) $value;
        }

        if (is_string($value)) {
            $trimmed = trim($value);

            return $trimmed === '' || str_starts_with($trimmed, self::INVALIDATED_PREFIX);
        }

        return $value === [];
    }

    private function tableReady(): bool
    {
        return Schema::hasTable('lead_contact_methods');
    }
}
