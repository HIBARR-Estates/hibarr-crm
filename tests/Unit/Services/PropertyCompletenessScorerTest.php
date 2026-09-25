<?php

namespace Tests\Unit\Services;

use App\Models\DeveloperProjectUnitType;
use App\Models\Property;
use App\Services\PropertyCompletenessScorer;
use Tests\TestCase;

class PropertyCompletenessScorerTest extends TestCase
{
    private PropertyCompletenessScorer $scorer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scorer = new PropertyCompletenessScorer();
    }

    public function test_fully_filled_residential_for_sale_scores_near_100_percent(): void
    {
        $property = $this->makeResidentialProperty([
            'sale_type' => Property::SALE_TYPE_FOR_SALE,
        ]);
        $this->fillResidentialListingFields($property);

        $score = $this->scorer->scoreProperty($property);

        $this->assertSame($score['total'], $score['filled']);
        $this->assertSame(100, $score['percent']);
        $this->assertGreaterThan(0, $score['total']);
        $this->assertNotContains('minimal_rental_period', $this->scorer->expectedPropertyKeys(
            Property::PRIMARY_CATEGORY_RESIDENTIAL,
            Property::SALE_TYPE_FOR_SALE
        ));
    }

    public function test_mostly_empty_property_scores_low(): void
    {
        $property = $this->makeResidentialProperty([
            'property_type' => null,
            'status' => null,
            'sale_type' => Property::SALE_TYPE_FOR_SALE,
            'price' => null,
            'city' => null,
            'area' => null,
            'address' => null,
            'description' => null,
        ]);
        $property->setRelation('assets', collect());

        $score = $this->scorer->scoreProperty($property);

        $this->assertGreaterThan(0, $score['total']);
        $this->assertLessThan(30, $score['percent']);
        $this->assertSame(1, $score['filled']); // sale_type only
    }

    public function test_bedrooms_counted_for_residential_but_not_land(): void
    {
        $residentialKeys = $this->scorer->expectedPropertyKeys(
            Property::PRIMARY_CATEGORY_RESIDENTIAL,
            Property::SALE_TYPE_FOR_SALE
        );
        $landKeys = $this->scorer->expectedPropertyKeys(
            Property::PRIMARY_CATEGORY_LAND,
            Property::SALE_TYPE_FOR_SALE
        );

        $this->assertContains('bedrooms', $residentialKeys);
        $this->assertNotContains('bedrooms', $landKeys);
        $this->assertContains('land_size', $landKeys);
        $this->assertNotContains('land_size', $residentialKeys);
        $this->assertNotContains('interior_features', $landKeys);
        $this->assertNotContains('construction_status', $landKeys);
    }

    public function test_rental_sale_type_includes_rental_fields(): void
    {
        $saleKeys = $this->scorer->expectedPropertyKeys(
            Property::PRIMARY_CATEGORY_RESIDENTIAL,
            Property::SALE_TYPE_FOR_SALE
        );
        $rentKeys = $this->scorer->expectedPropertyKeys(
            Property::PRIMARY_CATEGORY_RESIDENTIAL,
            Property::SALE_TYPE_FOR_RENT
        );

        $this->assertNotContains('minimal_rental_period', $saleKeys);
        $this->assertNotContains('rent_payment_interval', $saleKeys);
        $this->assertContains('minimal_rental_period', $rentKeys);
        $this->assertContains('rent_payment_interval', $rentKeys);
        $this->assertSame(count($saleKeys) + 2, count($rentKeys));
    }

    public function test_construction_project_and_unknown_category_return_empty_score(): void
    {
        $construction = $this->makeResidentialProperty([
            'primary_category' => 'construction_project',
        ]);
        $unknown = $this->makeResidentialProperty([
            'primary_category' => 'not-a-real-category',
        ]);

        $this->assertSame(
            ['filled' => 0, 'total' => 0, 'percent' => 0],
            $this->scorer->scoreProperty($construction)
        );
        $this->assertSame(
            ['filled' => 0, 'total' => 0, 'percent' => 0],
            $this->scorer->scoreProperty($unknown)
        );
    }

    public function test_clearing_a_filled_field_lowers_score(): void
    {
        $property = $this->makeResidentialProperty([
            'sale_type' => Property::SALE_TYPE_FOR_SALE,
        ]);
        $this->fillResidentialListingFields($property);

        $before = $this->scorer->scoreProperty($property);
        $property->description = null;
        $after = $this->scorer->scoreProperty($property);

        $this->assertSame($before['total'], $after['total']);
        $this->assertSame($before['filled'] - 1, $after['filled']);
        $this->assertLessThan($before['percent'], $after['percent']);
    }

    public function test_photos_count_via_assets_or_photos_array(): void
    {
        $property = $this->makeResidentialProperty([
            'sale_type' => Property::SALE_TYPE_FOR_SALE,
            'photos' => null,
        ]);
        $property->setRelation('assets', collect());

        $empty = $this->scorer->scoreProperty($property);

        $property->setRelation('assets', collect([(object) ['id' => 1]]));
        $withAssets = $this->scorer->scoreProperty($property);

        $property->setRelation('assets', collect());
        $property->photos = ['https://example.com/a.jpg'];
        $withPhotos = $this->scorer->scoreProperty($property);

        $this->assertSame($empty['filled'] + 1, $withAssets['filled']);
        $this->assertSame($empty['filled'] + 1, $withPhotos['filled']);
    }

    public function test_studio_bedrooms_zero_counts_as_filled(): void
    {
        $this->assertTrue($this->scorer->isFilled(0));
        $this->assertFalse($this->scorer->isFilled(null));
        $this->assertFalse($this->scorer->isFilled(''));
        $this->assertFalse($this->scorer->isFilled([]));
    }

    public function test_unit_type_residential_includes_bedrooms_and_unit_style(): void
    {
        $residential = $this->scorer->expectedUnitTypeKeys(
            DeveloperProjectUnitType::CATEGORY_RESIDENTIAL
        );
        $commercial = $this->scorer->expectedUnitTypeKeys(
            DeveloperProjectUnitType::CATEGORY_COMMERCIAL
        );

        $this->assertContains('bedrooms', $residential);
        $this->assertContains('unit_style', $residential);
        $this->assertNotContains('bedrooms', $commercial);
        $this->assertNotContains('unit_style', $commercial);
        $this->assertNotContains('quantity', $residential);
        $this->assertNotContains('total_sold', $residential);
    }

    public function test_unit_type_score_increases_when_fields_filled(): void
    {
        $unitType = new DeveloperProjectUnitType([
            'primary_category' => DeveloperProjectUnitType::CATEGORY_RESIDENTIAL,
            'property_type' => null,
            'starting_price' => null,
            'currency' => null,
            'description' => null,
        ]);
        $unitType->setRelation('assets', collect());

        $empty = $this->scorer->scoreUnitType($unitType);

        $unitType->property_type = 'apartment';
        $unitType->primary_category = DeveloperProjectUnitType::CATEGORY_RESIDENTIAL;
        $unitType->starting_price = 250000;
        $unitType->currency = 'GBP';
        $unitType->description = 'Nice unit';
        $unitType->bedrooms = 0;
        $unitType->unit_style = ['studio'];
        $unitType->setRelation('assets', collect([(object) ['id' => 1]]));

        $filled = $this->scorer->scoreUnitType($unitType);

        $this->assertGreaterThan($empty['filled'], $filled['filled']);
        $this->assertSame($empty['total'], $filled['total']);
        $this->assertGreaterThan($empty['percent'], $filled['percent']);
    }

    public function test_price_object_with_amount_counts_as_filled(): void
    {
        $property = $this->makeResidentialProperty([
            'sale_type' => Property::SALE_TYPE_FOR_SALE,
            'price' => null,
        ]);
        $property->setRelation('assets', collect());

        $without = $this->scorer->scoreProperty($property);
        $property->price = (object) ['amount' => 100000, 'currency' => 'GBP'];
        $with = $this->scorer->scoreProperty($property);

        $this->assertSame($without['filled'] + 1, $with['filled']);
    }

    private function makeResidentialProperty(array $overrides = []): Property
    {
        $property = new Property(array_merge([
            'primary_category' => Property::PRIMARY_CATEGORY_RESIDENTIAL,
            'property_type' => 'apartment',
            'status' => Property::STATUS_AVAILABLE,
            'sale_type' => Property::SALE_TYPE_FOR_SALE,
        ], $overrides));

        $property->setRelation('assets', collect());

        return $property;
    }

    private function fillResidentialListingFields(Property $property): void
    {
        $property->property_type = 'apartment';
        $property->status = Property::STATUS_AVAILABLE;
        $property->sale_type = $property->sale_type ?: Property::SALE_TYPE_FOR_SALE;
        $property->unit_style = ['penthouse'];
        $property->price = (object) ['amount' => 250000, 'currency' => 'GBP'];
        $property->city = 'Kyrenia';
        $property->area = 'Alsancak';
        $property->address = '1 Main St';
        $property->map = 'https://maps.example.com';
        $property->title_deed_type = 'Freehold';
        $property->title_deed_stage = 'Ready';
        $property->description = 'A lovely home';
        $property->video_url = 'https://video.example.com';
        $property->tour_360_url = 'https://tour.example.com';
        $property->bedrooms = 2;
        $property->bathrooms = 1;
        $property->living_room = 1;
        $property->floor_number = 3;
        $property->floors_in_building = 5;
        $property->building_age = 2;
        $property->gross_sqm = 120;
        $property->living_area_sqm = 100;
        $property->balcony_net_sqm = 10;
        $property->furniture_status = 'Furnished';
        $property->heating_type = 'Central';
        $property->construction_status = 'Resale';
        $property->completion_date = '2024-01-01';
        $property->view_types = ['sea_view'];
        $property->current_occupancy = 'Vacant';
        $property->interior_features = ['Fireplace'];
        $property->exterior_features = ['Garden'];
        $property->location_features = ['Near Beach'];
        $property->add_ons = ['Furniture Package'];
        $property->setRelation('assets', collect([(object) ['id' => 1]]));

        if ($property->sale_type === Property::SALE_TYPE_FOR_RENT
            || $property->sale_type === Property::SALE_TYPE_DAILY_RENTAL) {
            $property->minimal_rental_period = 12;
            $property->rent_payment_interval = Property::RENT_PAYMENT_MONTHLY;
        }
    }
}
