<?php

namespace App\Services;

use App\Models\Lead;
use Carbon\Carbon;

/**
 * Writes `lead_fields` from the contact API onto a lead, validated against the live
 * {@see LeadFieldCatalog}: a key the catalog does not offer (unknown, blocked, or a column that has
 * since been dropped) and a value of the wrong type are skipped and reported, never an error, so a
 * mapping that has gone stale in the backoffice cannot fail contact creation.
 *
 * Each field is `key => value` (default mode: fill) or `key => ['value' => ..., 'mode' => ...]`:
 *  - fill:      write only when the lead has no value yet (the contact API's convention);
 *  - overwrite: write when the value differs;
 *  - append:    long-text columns only; add the value on a new line unless it is already in there.
 */
class LeadFieldWriter
{
    public function __construct(private readonly LeadFieldCatalog $catalog) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{changed: bool, skipped: array<string, string>} skipped: field key => reason
     */
    public function apply(Lead $lead, array $input): array
    {
        $changed = false;
        $skipped = [];

        foreach ($input as $key => $spec) {
            $key = (string) $key;
            $field = $this->catalog->find($key);
            if ($field === null) {
                $skipped[$key] = 'not_available';

                continue;
            }

            $isStructured = is_array($spec) && array_key_exists('value', $spec);
            $value = $isStructured ? $spec['value'] : $spec;
            $mode = $isStructured ? (string) ($spec['mode'] ?? LeadFieldCatalog::MODE_FILL) : LeadFieldCatalog::MODE_FILL;

            if ($value === null || (is_string($value) && trim($value) === '')) {
                continue;
            }
            if (! in_array($mode, $field['write_modes'], true)) {
                $skipped[$key] = 'mode_not_supported';

                continue;
            }

            $coerced = $this->coerce($value, $field);
            if ($coerced === null) {
                $skipped[$key] = 'invalid_value';

                continue;
            }

            $current = $this->currentValue($lead, $key);
            $next = $this->resolveNext($mode, $current, $coerced);
            if ($next === null) {
                continue;
            }
            if ($field['type'] === 'string' && $field['max_length'] !== null && mb_strlen((string) $next) > $field['max_length']) {
                $skipped[$key] = 'too_long';

                continue;
            }

            $lead->setAttribute($key, $next);
            $changed = true;
        }

        return ['changed' => $changed, 'skipped' => $skipped];
    }

    /**
     * The value to store, or null when nothing should change.
     */
    private function resolveNext(string $mode, mixed $current, mixed $value): mixed
    {
        $blank = $current === null || $current === '';

        return match ($mode) {
            LeadFieldCatalog::MODE_OVERWRITE => $current === $value ? null : $value,
            LeadFieldCatalog::MODE_APPEND => $blank
                ? $value
                : (str_contains((string) $current, (string) $value) ? null : $current."\n".$value),
            default => $blank ? $value : null,
        };
    }

    private function currentValue(Lead $lead, string $key): mixed
    {
        $current = $lead->getAttribute($key);
        if ($current instanceof \BackedEnum) {
            return (string) $current->value;
        }
        if ($current instanceof \DateTimeInterface) {
            return $current->format('Y-m-d');
        }

        return $current;
    }

    /**
     * @param  array{type: string, max_length: int|null, options: list<string>|null}  $field
     */
    private function coerce(mixed $value, array $field): mixed
    {
        if (is_array($value) || is_object($value)) {
            return null;
        }

        switch ($field['type']) {
            case 'string':
            case 'text':
                return trim((string) $value);
            case 'integer':
                return preg_match('/^-?\d+$/', trim((string) $value)) === 1 ? (int) $value : null;
            case 'number':
                return is_numeric($value) ? (float) $value : null;
            case 'boolean':
                $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

                return $parsed;
            case 'date':
                try {
                    return Carbon::parse((string) $value)->format('Y-m-d');
                } catch (\Throwable) {
                    return null;
                }
            case 'enum':
                $candidate = trim((string) $value);

                return in_array($candidate, $field['options'] ?? [], true) ? $candidate : null;
            default:
                return null;
        }
    }
}
