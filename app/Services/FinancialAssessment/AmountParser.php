<?php

namespace App\Services\FinancialAssessment;

/**
 * Reads an amount out of free text such as a script answer: "6,500", "6.500,50",
 * "€ 5 000", "about 12000 EUR". Returns null when no sensible number is in there.
 *
 * With both separators present the last one is the decimal mark. A lone
 * separator is a decimal mark only when one or two digits follow it
 * ("1,5" / "1.50" are decimals, "1,500" / "1.500" are thousands).
 */
final class AmountParser
{
    public static function parse(string $text): ?float
    {
        if (! preg_match('/\d[\d\s.,\x{00A0}\x{202F}\']*/u', $text, $match)) {
            return null;
        }

        $number = preg_replace('/[\s\x{00A0}\x{202F}\']/u', '', $match[0]) ?? '';
        $number = rtrim($number, '.,');
        if ($number === '') {
            return null;
        }

        $lastDot = strrpos($number, '.');
        $lastComma = strrpos($number, ',');

        if ($lastDot !== false && $lastComma !== false) {
            $decimal = $lastDot > $lastComma ? '.' : ',';
        } elseif ($lastDot !== false || $lastComma !== false) {
            $mark = $lastDot !== false ? '.' : ',';
            $position = $lastDot !== false ? $lastDot : $lastComma;
            $isDecimal = substr_count($number, $mark) === 1 && strlen($number) - $position - 1 <= 2;
            $decimal = $isDecimal ? $mark : null;
        } else {
            $decimal = null;
        }

        if ($decimal === null) {
            $normalised = str_replace(['.', ','], '', $number);
        } else {
            $thousands = $decimal === '.' ? ',' : '.';
            $normalised = str_replace($decimal, '.', str_replace($thousands, '', $number));
        }

        return is_numeric($normalised) && (float) $normalised >= 0 ? (float) $normalised : null;
    }
}
