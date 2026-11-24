<?php

namespace App\Services\CustomFieldMapping;

use App\Models\CustomField;
use App\Services\LeadCoreFieldsService;
use Carbon\Carbon;
use Throwable;

/**
 * Converts one stored value between field shapes.
 *
 * Every value is first lifted into a small neutral form
 * (see {@see self::read()}) and then rendered for the target
 * (see {@see self::toCustomField()} / {@see self::toDefinedField()}). Going
 * through one neutral form keeps the compatibility rules in a single place
 * instead of an N x N matrix of type pairs.
 *
 * A conversion never guesses: if the value can't be represented in the
 * target without losing meaning, it returns null plus a reason and the
 * caller leaves the record untouched.
 */
class CustomFieldValueConverter
{
    public const NEUTRAL_TEXT = 'text';
    public const NEUTRAL_NUMBER = 'number';
    public const NEUTRAL_DATE = 'date';
    public const NEUTRAL_LIST = 'list';
    /** Files and structured types (currency, range, ...): only copyable to the same type. */
    public const NEUTRAL_OPAQUE = 'opaque';

    // 'country' is deliberately absent: its stored format isn't free text, so it only maps to another country field.
    private const TEXT_TYPES = ['text', 'textarea', 'email', 'url', 'phone', 'mobile'];
    private const OPTION_TYPES = ['select', 'radio'];
    private const MULTI_TYPES = ['multiselect', 'checkbox'];

    /** Types that can't be a mapping source or target at all. */
    public const UNSUPPORTED_TYPES = ['password', 'repeatable'];

    public function __construct(private readonly LeadCoreFieldsService $leadCore)
    {
    }

    /**
     * Lifts a raw custom_fields_data value into the neutral form, or null when empty.
     *
     * @return array{kind: string, value: mixed, type: string}|null
     */
    public function read(CustomField $field, ?string $raw): ?array
    {
        if ($raw === null || trim($raw) === '' || trim($raw) === '[]') {
            return null;
        }

        $type = $field->type;

        if (in_array($type, self::TEXT_TYPES, true)) {
            return ['kind' => self::NEUTRAL_TEXT, 'value' => trim($raw), 'type' => $type];
        }

        if ($type === 'number') {
            return ['kind' => self::NEUTRAL_NUMBER, 'value' => trim($raw), 'type' => $type];
        }

        if (in_array($type, ['date', 'datetime'], true)) {
            try {
                return ['kind' => self::NEUTRAL_DATE, 'value' => Carbon::parse($raw), 'type' => $type];
            } catch (Throwable) {
                return ['kind' => self::NEUTRAL_OPAQUE, 'value' => $raw, 'type' => $type];
            }
        }

        if (in_array($type, self::OPTION_TYPES, true)) {
            return ['kind' => self::NEUTRAL_TEXT, 'value' => $this->resolveOptionLabel($field, trim($raw)), 'type' => $type];
        }

        if (in_array($type, self::MULTI_TYPES, true)) {
            $labels = array_map(fn ($v) => $this->resolveOptionLabel($field, $v), $this->decodeList($raw));

            return $labels === [] ? null : ['kind' => self::NEUTRAL_LIST, 'value' => $labels, 'type' => $type];
        }

        return ['kind' => self::NEUTRAL_OPAQUE, 'value' => $raw, 'type' => $type];
    }

    /**
     * Renders a neutral value for a custom field target.
     *
     * @param  array{kind: string, value: mixed, type: string}  $neutral
     * @param  array<string, string>  $targetOptions  lowercased label => canonical label (select/radio/multi targets)
     * @param  list<string>  $missingOptions  filled with labels not in $targetOptions (only when $addMissingOptions)
     * @return array{value: ?string, reason: ?string}
     */
    public function toCustomField(
        array $neutral,
        CustomField $target,
        array &$targetOptions,
        bool $addMissingOptions,
        array &$missingOptions,
    ): array {
        $type = $target->type;

        if ($neutral['kind'] === self::NEUTRAL_OPAQUE || in_array($type, ['file', 'currency', 'range', 'currency_range', 'country', 'multiSelectCountry'], true)) {
            return $neutral['type'] === $type
                ? ['value' => (string) $this->stringify($neutral), 'reason' => null]
                : $this->fail("{$neutral['type']} can only be copied to another {$neutral['type']} field");
        }

        if (in_array($type, self::TEXT_TYPES, true)) {
            $text = $this->stringify($neutral);

            return match (true) {
                $type === 'email' && ! filter_var($text, FILTER_VALIDATE_EMAIL) => $this->fail('not a valid email address'),
                $type === 'url' && ! filter_var($text, FILTER_VALIDATE_URL) => $this->fail('not a valid URL'),
                default => ['value' => $text, 'reason' => null],
            };
        }

        if ($type === 'number') {
            $text = $this->normalizeNumber($this->stringify($neutral));

            return $text !== null
                ? ['value' => $text, 'reason' => null]
                : $this->fail('not a number');
        }

        if (in_array($type, ['date', 'datetime'], true)) {
            $date = $this->asDate($neutral);

            return $date
                ? ['value' => $date->format($type === 'date' ? 'Y-m-d' : 'Y-m-d H:i:s'), 'reason' => null]
                : $this->fail('not a date');
        }

        if (in_array($type, self::OPTION_TYPES, true)) {
            $labels = $this->asLabels($neutral);

            if (count($labels) !== 1) {
                return $this->fail('several values cannot go into a single-choice field');
            }

            $label = $this->matchOption($labels[0], $targetOptions, $addMissingOptions, $missingOptions);

            return $label !== null
                ? ['value' => $label, 'reason' => null]
                : $this->fail("\"{$labels[0]}\" is not an option of the target field");
        }

        if (in_array($type, self::MULTI_TYPES, true)) {
            $matched = [];
            foreach ($this->asLabels($neutral) as $label) {
                $canonical = $this->matchOption($label, $targetOptions, $addMissingOptions, $missingOptions);

                if ($canonical === null) {
                    return $this->fail("\"{$label}\" is not an option of the target field");
                }

                $matched[] = $canonical;
            }

            return ['value' => json_encode(array_values(array_unique($matched))), 'reason' => null];
        }

        return $this->fail("target type {$type} is not supported");
    }

    /**
     * Renders a neutral value for a defined (built-in) field target.
     *
     * @param  array{kind: string, value: mixed, type: string}  $neutral
     * @param  array{kind: string, max: ?int, range?: ?array{0: int, 1: int}}  $target
     * @return array{value: mixed, reason: ?string}
     */
    public function toDefinedField(array $neutral, array $target): array
    {
        if ($neutral['kind'] === self::NEUTRAL_OPAQUE) {
            return $this->fail("{$neutral['type']} values can't be mapped to a built-in field");
        }

        switch ($target['kind']) {
            case DefinedFieldRegistry::KIND_STRING:
                $text = $this->stringify($neutral);

                return ($target['max'] ?? null) !== null && mb_strlen($text) > $target['max']
                    ? $this->fail("longer than {$target['max']} characters")
                    : ['value' => $text, 'reason' => null];

            case DefinedFieldRegistry::KIND_DATE:
                $date = $this->asDate($neutral);

                return $date ? ['value' => $date->format('Y-m-d'), 'reason' => null] : $this->fail('not a date');

            case DefinedFieldRegistry::KIND_INT:
                $text = trim($this->stringify($neutral));

                if (! preg_match('/^-?\d+(\.0+)?$/', $text)) {
                    return $this->fail('not a whole number');
                }

                [$min, $max] = $target['range'] ?? [null, null];

                return ($min !== null && (int) $text < $min) || ($max !== null && (int) $text > $max)
                    ? $this->fail("outside the allowed range {$min}–{$max}")
                    : ['value' => (int) $text, 'reason' => null];

            case DefinedFieldRegistry::KIND_BOOL:
                $text = mb_strtolower(trim($this->stringify($neutral)));

                return match (true) {
                    in_array($text, ['1', 'true', 'yes', 'y', 'ja', 'evet', 'да'], true) => ['value' => true, 'reason' => null],
                    in_array($text, ['0', 'false', 'no', 'n', 'nein', 'hayır', 'hayir', 'нет'], true) => ['value' => false, 'reason' => null],
                    default => $this->fail('not a yes/no value'),
                };

            case DefinedFieldRegistry::KIND_LANGUAGES:
                $codes = [];
                foreach ($this->asLabels($neutral) as $label) {
                    $code = $this->leadCore->supportedLanguageCode($label);

                    if ($code === null) {
                        return $this->fail("\"{$label}\" is not a configured language");
                    }

                    $codes[] = $code;
                }

                return $codes === []
                    ? $this->fail('no language found')
                    : ['value' => array_values(array_unique($codes)), 'reason' => null];
        }

        return $this->fail('unsupported target');
    }

    /**
     * Whether a source/target pair can ever convert, judged on types alone —
     * lets the UI grey out hopeless targets before any data is read.
     */
    public function typesCompatible(string $sourceType, string $targetType): bool
    {
        if (in_array($sourceType, self::UNSUPPORTED_TYPES, true) || in_array($targetType, self::UNSUPPORTED_TYPES, true)) {
            return false;
        }

        $opaque = fn (string $t) => ! in_array($t, [...self::TEXT_TYPES, ...self::OPTION_TYPES, ...self::MULTI_TYPES, 'number', 'date', 'datetime'], true);

        if ($opaque($sourceType) || $opaque($targetType)) {
            return $sourceType === $targetType;
        }

        return true;
    }

    /** @return array{value: null, reason: string} */
    private function fail(string $reason): array
    {
        return ['value' => null, 'reason' => $reason];
    }

    private function stringify(array $neutral): string
    {
        return match ($neutral['kind']) {
            self::NEUTRAL_DATE => $neutral['value']->format($neutral['type'] === 'datetime' ? 'Y-m-d H:i:s' : 'Y-m-d'),
            self::NEUTRAL_LIST => implode(', ', $neutral['value']),
            default => (string) $neutral['value'],
        };
    }

    private function asDate(array $neutral): ?Carbon
    {
        if ($neutral['kind'] === self::NEUTRAL_DATE) {
            return $neutral['value'];
        }

        if ($neutral['kind'] !== self::NEUTRAL_TEXT) {
            return null;
        }

        // Carbon::parse() accepts free text such as "next friday" or "5", which
        // would silently turn prose into a date. Only accept explicit numeric dates.
        if (! preg_match('/^\d{4}-\d{1,2}-\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?$|^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}$/', $neutral['value'])) {
            return null;
        }

        try {
            return Carbon::parse(str_replace('/', '-', $neutral['value']));
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * "1 234.5", "1234,5" and "1,234.50" are numbers; "1,234" is ambiguous
     * (thousands vs. decimal) and is read as thousands, which is what an
     * integer-looking value almost always means. Returns null when unsure.
     */
    private function normalizeNumber(string $text): ?string
    {
        $text = str_replace([' ', "\u{00A0}"], '', trim($text));

        if (preg_match('/^-?\d{1,3}(,\d{3})+(\.\d+)?$/', $text)) {
            $text = str_replace(',', '', $text);
        } elseif (preg_match('/^-?\d+,\d{1,2}$/', $text)) {
            $text = str_replace(',', '.', $text);
        }

        return is_numeric($text) ? $text : null;
    }

    /** @return list<string> */
    private function asLabels(array $neutral): array
    {
        if ($neutral['kind'] === self::NEUTRAL_LIST) {
            return $neutral['value'];
        }

        $text = $this->stringify($neutral);

        // A free-text source may carry several values ("de, en"); an option
        // source never contains commas in a single label by construction
        // here, so splitting is only applied to text sources.
        $parts = $neutral['kind'] === self::NEUTRAL_TEXT && in_array($neutral['type'], self::TEXT_TYPES, true)
            ? preg_split('/\s*[,;]\s*/', $text)
            : [$text];

        return array_values(array_filter(array_map('trim', $parts), fn ($p) => $p !== ''));
    }

    /**
     * @param  array<string, string>  $options  lowercased label => canonical label
     * @param  list<string>  $missing
     */
    private function matchOption(string $label, array &$options, bool $addMissing, array &$missing): ?string
    {
        $key = mb_strtolower(trim($label));

        if (isset($options[$key])) {
            return $options[$key];
        }

        if (! $addMissing) {
            return null;
        }

        $options[$key] = trim($label);
        $missing[] = trim($label);

        return trim($label);
    }

    /** Select/radio rows hold the option label today, but legacy rows hold the option's index. */
    private function resolveOptionLabel(CustomField $field, string $raw): string
    {
        $options = $this->optionList($field);

        if ($raw !== '' && ctype_digit($raw) && ! in_array($raw, $options, true) && isset($options[(int) $raw])) {
            return $options[(int) $raw];
        }

        return $raw;
    }

    /** @return list<string> */
    public function optionList(CustomField $field): array
    {
        $values = $field->values;
        $decoded = is_string($values) ? json_decode($values, true) : $values;

        return is_array($decoded) ? array_values(array_map('strval', $decoded)) : [];
    }

    /** @return list<string> */
    private function decodeList(string $raw): array
    {
        $decoded = json_decode($raw, true);
        $items = is_array($decoded) ? $decoded : explode(',', $raw);

        return array_values(array_filter(
            array_map(fn ($v) => trim((string) $v), $items),
            fn ($v) => $v !== '',
        ));
    }
}
