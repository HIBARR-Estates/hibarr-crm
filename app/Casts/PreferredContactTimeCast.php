<?php

namespace App\Casts;

use App\Enums\PreferredContactTime;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Legacy scalar preferred_contact_time plus JSON-array rows written by OL.
 * Never throws on read — invalid/legacy values become null.
 */
class PreferredContactTimeCast implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?PreferredContactTime
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof PreferredContactTime) {
            return $value;
        }

        if (is_array($value)) {
            $first = PreferredContactTime::normalizeList($value)[0] ?? null;

            return $first !== null ? PreferredContactTime::tryFrom($first) : null;
        }

        if (is_string($value) && str_starts_with(trim($value), '[')) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $normalized = PreferredContactTime::normalizeList($decoded);
                if ($normalized !== [] && ! $model->isDirty('preferred_contact_times')) {
                    $model->setAttribute('preferred_contact_times', $normalized);
                }

                $first = $normalized[0] ?? null;

                return $first !== null ? PreferredContactTime::tryFrom($first) : null;
            }
        }

        return PreferredContactTime::tryFrom((string) $value);
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof PreferredContactTime) {
            return $value->value;
        }

        if (is_array($value)) {
            $normalized = PreferredContactTime::normalizeList($value);
            $model->setAttribute('preferred_contact_times', $normalized);

            return $normalized[0] ?? null;
        }

        $enum = PreferredContactTime::tryFrom((string) $value);

        if ($enum !== null) {
            $model->setAttribute('preferred_contact_times', [$enum->value]);
        }

        return $enum?->value;
    }
}
