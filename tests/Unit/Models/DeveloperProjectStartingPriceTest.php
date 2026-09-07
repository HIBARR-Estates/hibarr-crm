<?php

namespace Tests\Unit\Models;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use Tests\TestCase;

class DeveloperProjectStartingPriceTest extends TestCase
{
    public function test_formatted_starting_price_uses_pound_symbol(): void
    {
        $project = new DeveloperProject;
        $project->starting_price = '185000.00';

        $this->assertSame('£185,000', $project->formatted_starting_price);
    }

    public function test_formatted_starting_price_is_null_when_unset(): void
    {
        $project = new DeveloperProject;

        $this->assertNull($project->formatted_starting_price);
    }

    public function test_resolved_starting_price_uses_project_column(): void
    {
        $project = new DeveloperProject;
        $project->starting_price = '250000.00';

        $unitType = new DeveloperProjectUnitType;
        $unitType->starting_price = '99000.00';
        $project->setRelation('unitTypes', collect([$unitType]));

        $this->assertSame(250000.0, $project->resolvedStartingPrice());
    }

    public function test_resolved_starting_price_falls_back_to_cheapest_unit_type(): void
    {
        $project = new DeveloperProject;
        $project->starting_price = null;

        $expensive = new DeveloperProjectUnitType;
        $expensive->starting_price = '180000.00';
        $cheap = new DeveloperProjectUnitType;
        $cheap->starting_price = '99000.00';
        $project->setRelation('unitTypes', collect([$expensive, $cheap]));

        $this->assertSame(99000.0, $project->resolvedStartingPrice());
    }

    public function test_resolved_starting_price_is_null_when_nothing_is_set(): void
    {
        $project = new DeveloperProject;
        $project->setRelation('unitTypes', collect());

        $this->assertNull($project->resolvedStartingPrice());
    }
}
