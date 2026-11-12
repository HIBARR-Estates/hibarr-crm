<?php

namespace App\Support\Kktc;

/**
 * Writes an amount in Turkish words for the "Yazı ile" line of a Fatura or
 * Tahsilat Makbuzu, the way it is written by hand: the words run together
 * ("dörtbinüçyüzelli") and start with "Yalnız".
 */
class TurkishAmountInWords
{
    private const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];

    private const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

    private const SCALES = ['', 'bin', 'milyon', 'milyar', 'trilyon'];

    /** Currency name and its hundredth, in Turkish. */
    private const CURRENCIES = [
        'TRY' => ['Türk Lirası', 'Kuruş'],
        'TL' => ['Türk Lirası', 'Kuruş'],
        'GBP' => ['İngiliz Sterlini', 'Peni'],
        'EUR' => ['Avro', 'Sent'],
        'USD' => ['Amerikan Doları', 'Sent'],
        'CHF' => ['İsviçre Frangı', 'Santim'],
        'RUB' => ['Rus Rublesi', 'Kopek'],
    ];

    public static function format(float $amount, ?string $currencyCode): string
    {
        $amount = round(abs($amount), 2);
        $whole = (int) floor($amount);
        $fraction = (int) round(($amount - $whole) * 100);
        if ($fraction === 100) {
            $whole++;
            $fraction = 0;
        }

        $code = strtoupper((string) $currencyCode);
        [$unit, $subunit] = self::CURRENCIES[$code] ?? [$code, ''];

        $text = self::capitalize(self::words($whole)).($unit !== '' ? ' '.$unit : '');
        if ($fraction > 0) {
            $text .= ' '.self::capitalize(self::words($fraction)).($subunit !== '' ? ' '.$subunit : '');
        }

        return 'Yalnız: '.$text;
    }

    public static function words(int $number): string
    {
        if ($number === 0) {
            return 'sıfır';
        }

        $groups = [];
        while ($number > 0) {
            $groups[] = $number % 1000;
            $number = intdiv($number, 1000);
        }

        $out = '';
        for ($i = count($groups) - 1; $i >= 0; $i--) {
            $group = $groups[$i];
            if ($group === 0) {
                continue;
            }
            // 1000 is "bin", never "birbin".
            $out .= ($i === 1 && $group === 1) ? '' : self::hundreds($group);
            $out .= self::SCALES[$i] ?? '';
        }

        return $out;
    }

    private static function hundreds(int $number): string
    {
        $h = intdiv($number, 100);
        $t = intdiv($number % 100, 10);
        $o = $number % 10;

        // 100 is "yüz", never "biryüz".
        $out = $h === 0 ? '' : ($h === 1 ? 'yüz' : self::ONES[$h].'yüz');

        return $out.self::TENS[$t].self::ONES[$o];
    }

    private static function capitalize(string $word): string
    {
        if ($word === '') {
            return '';
        }

        $first = mb_substr($word, 0, 1);
        $first = match ($first) {
            'i' => 'İ',
            'ı' => 'I',
            default => mb_strtoupper($first),
        };

        return $first.mb_substr($word, 1);
    }
}
