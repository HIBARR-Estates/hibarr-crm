<?php

namespace Tests\Unit\Models;

use App\Models\DeveloperProjectUnitType;
use Tests\TestCase;

class DeveloperProjectUnitTypeSoldOutTest extends TestCase
{
    public function test_is_sold_out_defaults_to_false(): void
    {
        $unitType = new DeveloperProjectUnitType();

        $this->assertFalse((bool) $unitType->is_sold_out);
    }

    public function test_is_sold_out_is_cast_to_boolean(): void
    {
        $unitType = new DeveloperProjectUnitType([
            'is_sold_out' => 1,
        ]);

        $this->assertTrue($unitType->is_sold_out);
        $this->assertIsBool($unitType->is_sold_out);
    }

    public function test_is_sold_out_is_fillable(): void
    {
        $unitType = new DeveloperProjectUnitType([
            'is_sold_out' => true,
        ]);

        $this->assertTrue($unitType->is_sold_out);
    }
}
