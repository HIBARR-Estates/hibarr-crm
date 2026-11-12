<?php

namespace Tests\Unit\Support;

use App\Support\Kktc\TurkishAmountInWords;
use App\Support\Kktc\TurkishSuffix;
use PHPUnit\Framework\TestCase;

class KktcTurkishTextTest extends TestCase
{
    public function test_amounts_are_written_in_turkish_words(): void
    {
        $this->assertSame('sıfır', TurkishAmountInWords::words(0));
        $this->assertSame('yüz', TurkishAmountInWords::words(100));
        $this->assertSame('bin', TurkishAmountInWords::words(1000));
        $this->assertSame('dörtbinüçyüzelli', TurkishAmountInWords::words(4350));
        $this->assertSame('ikiyüzkırkdörtbindörtyüzyetmiş', TurkishAmountInWords::words(244470));
        $this->assertSame('birmilyonbinbir', TurkishAmountInWords::words(1001001));
    }

    public function test_format_names_the_currency_and_its_hundredths(): void
    {
        $this->assertSame('Yalnız: Dörtbinüçyüzelli İngiliz Sterlini', TurkishAmountInWords::format(4350, 'GBP'));
        $this->assertSame('Yalnız: Onikibin Türk Lirası Elli Kuruş', TurkishAmountInWords::format(12000.5, 'TRY'));
        $this->assertSame('Yalnız: İkiyüz Avro Bir Sent', TurkishAmountInWords::format(200.01, 'EUR'));
        // A currency without a known subunit keeps the fraction as hundredths.
        $this->assertSame('Yalnız: Oniki CAD 34/100', TurkishAmountInWords::format(12.34, 'CAD'));
    }

    public function test_ablative_suffix_follows_vowel_harmony(): void
    {
        $this->assertSame("Markus Weber'den", TurkishSuffix::ablative('Markus Weber'));
        $this->assertSame("Ahmet'ten", TurkishSuffix::ablative('Ahmet'));
        $this->assertSame("Ayşe'den", TurkishSuffix::ablative('Ayşe'));
        $this->assertSame("Jack'tan", TurkishSuffix::ablative('Jack'));
        $this->assertSame("Olga'dan", TurkishSuffix::ablative('Olga'));
    }
}
