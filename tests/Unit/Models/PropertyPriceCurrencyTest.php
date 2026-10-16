<?php

namespace Tests\Unit\Models;

use App\Models\Property;
use Tests\TestCase;

class PropertyPriceCurrencyTest extends TestCase
{
    public function test_price_currency_reads_the_currency_stored_with_the_amount(): void
    {
        $property = new Property;
        $property->setRawAttributes([
            'price' => json_encode(['amount' => 100000, 'currency' => 'usd']),
        ]);

        $this->assertSame(100000.0, $property->price);
        $this->assertSame('USD', $property->price_currency);
    }

    public function test_numeric_price_has_no_stored_currency(): void
    {
        $property = new Property;
        $property->setRawAttributes([
            'price' => '250000',
        ]);

        $this->assertSame(250000.0, $property->price);
        $this->assertNull($property->price_currency);
    }

    public function test_missing_price_has_no_currency(): void
    {
        $property = new Property;
        $property->setRawAttributes([
            'price' => null,
        ]);

        $this->assertNull($property->price);
        $this->assertNull($property->price_currency);
    }
}
