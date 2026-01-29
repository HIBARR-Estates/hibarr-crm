<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Casts price from DB: accepts numeric or JSON like {"amount": 50000, ...}.
 * Always returns a string suitable for decimal display (2 decimal places).
 */
class PriceCast implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_string($value) && str_starts_with(trim($value), '{')) {
            $decoded = json_decode($value, true);
            if (is_array($decoded) && array_key_exists('amount', $decoded)) {
                $amount = $decoded['amount'];
                return is_numeric($amount) ? number_format((float) $amount, 2, '.', '') : '0.00';
            }
        }

        return is_numeric($value) ? number_format((float) $value, 2, '.', '') : '0.00';
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_array($value) && array_key_exists('amount', $value)) {
            return is_numeric($value['amount']) ? (float) $value['amount'] : null;
        }
        return is_numeric($value) ? (float) $value : null;
    }
}
