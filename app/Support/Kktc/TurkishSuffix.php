<?php

namespace App\Support\Kktc;

/**
 * Turkish case suffixes for a name printed into a sentence, such as the
 * receipt's "Sayın Markus Weber'den ... tahsil edilmiştir".
 */
class TurkishSuffix
{
    private const BACK_VOWELS = ['a', 'ı', 'o', 'u'];

    private const VOWELS = ['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü'];

    /** Voiceless consonants that turn the suffix's "d" into "t". */
    private const HARD = ['f', 's', 't', 'k', 'ç', 'ş', 'h', 'p'];

    /** The ablative ("from"): 'den, 'dan, 'ten or 'tan. */
    public static function ablative(string $name): string
    {
        $name = trim($name);
        if ($name === '') {
            return '';
        }

        $lower = self::lower($name);
        $chars = mb_str_split($lower);

        $lastVowel = null;
        for ($i = count($chars) - 1; $i >= 0; $i--) {
            if (in_array($chars[$i], self::VOWELS, true)) {
                $lastVowel = $chars[$i];
                break;
            }
        }

        $lastChar = end($chars);
        $consonant = in_array($lastChar, self::HARD, true) ? 't' : 'd';
        $vowel = in_array($lastVowel, self::BACK_VOWELS, true) ? 'a' : 'e';

        return $name."'".$consonant.$vowel.'n';
    }

    private static function lower(string $value): string
    {
        return mb_strtolower(strtr($value, ['I' => 'ı', 'İ' => 'i']));
    }
}
