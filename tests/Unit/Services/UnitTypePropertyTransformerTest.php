<?php

namespace Tests\Unit\Services;

use App\Models\DeveloperProjectUnitType;
use App\Services\UnitTypePropertyTransformer;
use Tests\TestCase;

class UnitTypePropertyTransformerTest extends TestCase
{
    public function test_transform_includes_is_sold_out_when_flagged(): void
    {
        $unitType = new DeveloperProjectUnitType([
            'id' => 42,
            'developer_project_id' => 7,
            'primary_category' => 'residential',
            'property_type' => 'apartment',
            'starting_price' => 250000,
            'currency' => 'GBP',
            'has_restrictions' => false,
            'is_sold_out' => true,
            'reference_code' => 'DEV-001-UT01',
        ]);
        $unitType->setRelation('project', null);

        $transformed = (new UnitTypePropertyTransformer())->transform($unitType);

        $this->assertSame('unit_type', $transformed['_source']);
        $this->assertTrue($transformed['is_sold_out']);
    }

    public function test_transform_omits_sold_out_indicator_when_not_flagged(): void
    {
        $unitType = new DeveloperProjectUnitType([
            'id' => 43,
            'developer_project_id' => 7,
            'primary_category' => 'residential',
            'property_type' => 'apartment',
            'starting_price' => 250000,
            'currency' => 'GBP',
            'has_restrictions' => false,
            'is_sold_out' => false,
            'reference_code' => 'DEV-001-UT02',
        ]);
        $unitType->setRelation('project', null);

        $transformed = (new UnitTypePropertyTransformer())->transform($unitType);

        $this->assertFalse($transformed['is_sold_out']);
    }
}
