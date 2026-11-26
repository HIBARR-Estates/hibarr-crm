<?php

namespace App\Services;

use App\Enums\FinancialAssessmentSource;
use App\Models\Lead;
use App\Services\FinancialAssessment\AssessmentException;
use App\Services\FinancialAssessment\AssessmentFieldRegistry;
use App\Services\FinancialAssessment\AssessmentService;
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
 *
 * Financial assessment fields (`assessment.{type}`, see {@see AssessmentFieldRegistry}) are not columns.
 * `apply()` validates them and hands them back as `assessment` writes; {@see applyAssessment()} stores
 * them in the lead's open draft once the lead has been saved (a new contact has no id before that).
 * The value is an amount, plain or `{value, mode, currency?, frequency?, certainty?, available_from?, note?}`;
 * modes are fill (only if the draft has no line of that type), overwrite, append (add another line).
 * They never finalise anything.
 */
class LeadFieldWriter
{
    private readonly AssessmentFieldRegistry $assessmentFields;

    public function __construct(private readonly LeadFieldCatalog $catalog, ?AssessmentFieldRegistry $assessmentFields = null)
    {
        $this->assessmentFields = $assessmentFields ?? app(AssessmentFieldRegistry::class);
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{changed: bool, skipped: array<string, string>, assessment: array<string, array{type_key: string, value: float, mode: string, companions: array<string, mixed>}>} skipped: field key => reason
     */
    public function apply(Lead $lead, array $input): array
    {
        $changed = false;
        $skipped = [];
        $assessment = [];

        foreach ($input as $key => $spec) {
            $key = (string) $key;

            if (str_starts_with($key, AssessmentFieldRegistry::PREFIX)) {
                $this->collectAssessmentField($lead, $key, $spec, $skipped, $assessment);

                continue;
            }

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

        return ['changed' => $changed, 'skipped' => $skipped, 'assessment' => $assessment];
    }

    /**
     * Store the assessment writes that {@see apply()} collected, in the lead's open draft (started
     * on the first write, source "api"). The lead must already be saved. Returns the fields that
     * could not be written, key => reason; one bad field never blocks the others.
     *
     * @param  array<string, array{type_key: string, value: float, mode: string, companions: array<string, mixed>}>  $writes
     * @return array<string, string>
     */
    public function applyAssessment(Lead $lead, array $writes): array
    {
        if ($writes === []) {
            return [];
        }

        $skipped = [];
        $service = app(AssessmentService::class);

        try {
            $draft = $service->startDraft($lead, null, FinancialAssessmentSource::Api);
        } catch (\Throwable $e) {
            report($e);

            return array_fill_keys(array_keys($writes), 'unavailable');
        }

        foreach ($writes as $key => $write) {
            try {
                $service->applyValue($draft, $write['type_key'], $write['value'], $write['mode'], $write['companions']);
            } catch (AssessmentException $e) {
                $skipped[$key] = $e->reason;
            }
        }

        return $skipped;
    }

    /**
     * Validate one `assessment.*` field and queue it for {@see applyAssessment()}.
     *
     * @param  array<string, string>  $skipped
     * @param  array<string, array{type_key: string, value: float, mode: string, companions: array<string, mixed>}>  $assessment
     */
    private function collectAssessmentField(Lead $lead, string $key, mixed $spec, array &$skipped, array &$assessment): void
    {
        $field = $this->assessmentFields->find((int) $lead->company_id, $key);
        if ($field === null) {
            $skipped[$key] = 'not_available';

            return;
        }

        $isStructured = is_array($spec) && array_key_exists('value', $spec);
        $value = $isStructured ? $spec['value'] : $spec;
        $mode = $isStructured ? (string) ($spec['mode'] ?? LeadFieldCatalog::MODE_FILL) : LeadFieldCatalog::MODE_FILL;

        if ($value === null || (is_string($value) && trim($value) === '')) {
            return;
        }
        if (! $field['writable'] || ! in_array($mode, $field['write_modes'], true)) {
            $skipped[$key] = 'mode_not_supported';

            return;
        }
        if (is_array($value) || ! is_numeric($value) || (float) $value < 0) {
            $skipped[$key] = 'invalid_value';

            return;
        }

        $companions = [];
        if ($isStructured) {
            foreach (AssessmentFieldRegistry::ACCEPTS as $name) {
                if (array_key_exists($name, $spec) && $spec[$name] !== null && $spec[$name] !== '') {
                    $companions[$name] = $spec[$name];
                }
            }
        }

        $assessment[$key] = [
            'type_key' => (string) AssessmentFieldRegistry::typeKeyOf($key),
            'value' => (float) $value,
            'mode' => $mode,
            'companions' => $companions,
        ];
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
