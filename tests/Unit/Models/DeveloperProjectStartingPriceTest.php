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
        $this->assertSame('GBP', $project->currencyCode());
    }

    public function test_formatted_starting_price_uses_saved_currency_without_changing_the_amount(): void
    {
        $project = new DeveloperProject;
        $project->starting_price = '100000.00';
        $project->currency = 'EUR';

        $this->assertSame('€100,000', $project->formatted_starting_price);
        $this->assertSame(100000.0, $project->resolvedStartingPrice());
    }

    public function test_project_price_currency_ignores_unit_type_currency(): void
    {
        $project = new DeveloperProject;
        $project->starting_price = '100000.00';
        $project->currency = 'GBP';

        $unitType = new DeveloperProjectUnitType;
        $unitType->starting_price = '90000.00';
        $unitType->currency = 'EUR';
        $project->setRelation('unitTypes', collect([$unitType]));

        $this->assertSame('GBP', $project->resolvedStartingPriceCurrency());
        $this->assertSame(100000.0, $project->resolvedStartingPrice());
    }

    public function test_fallback_price_uses_the_source_unit_type_currency(): void
    {
        $project = new DeveloperProject;
        $project->starting_price = null;
        $project->currency = 'GBP';

        $expensive = new DeveloperProjectUnitType;
        $expensive->starting_price = '180000.00';
        $expensive->currency = 'GBP';
        $cheap = new DeveloperProjectUnitType;
        $cheap->starting_price = '99000.00';
        $cheap->currency = 'EUR';
        $project->setRelation('unitTypes', collect([$expensive, $cheap]));

        $this->assertSame(99000.0, $project->resolvedStartingPrice());
        $this->assertSame('EUR', $project->resolvedStartingPriceCurrency());
    }

    public function test_missing_price_does_not_invent_a_formatted_amount(): void
    {
        $project = new DeveloperProject;
        $project->setRelation('unitTypes', collect());

        $this->assertNull($project->formatted_starting_price);
        $this->assertNull($project->resolvedStartingPrice());
        $this->assertSame('GBP', $project->resolvedStartingPriceCurrency());
    }

    public function test_invalid_currency_code_is_rejected_by_the_pricing_rule(): void
    {
        $validator = validator([
            'currency' => 'XYZ',
            'starting_price' => 100000,
        ], [
            'currency' => DeveloperProject::pricingCurrencyRule(),
            'starting_price' => 'nullable|numeric|min:0',
        ]);

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('currency', $validator->errors()->toArray());
        $this->assertArrayNotHasKey('starting_price', $validator->errors()->toArray());
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
