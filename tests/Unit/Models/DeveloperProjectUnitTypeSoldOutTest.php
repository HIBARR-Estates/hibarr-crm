<?php

namespace Tests\Unit\Models;

use App\Models\DeveloperProjectUnitType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeveloperProjectUnitTypeSoldOutTest extends TestCase
{
    use RefreshDatabase;

    public function test_is_sold_out_defaults_to_false(): void
    {
        // Persist an empty record using the factory or direct creation
        $unitType = DeveloperProjectUnitType::factory()->create();

        // Refresh from the database to verify the actual schema default value
        $unitType->refresh();

        $this->assertFalse($unitType->is_sold_out);
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