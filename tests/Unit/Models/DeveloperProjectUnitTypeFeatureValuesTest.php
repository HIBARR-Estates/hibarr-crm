<?php

namespace Tests\Unit\Models;

use App\Models\DeveloperProjectUnitType;
use App\Models\PropertyExteriorFeature;
use App\Models\PropertyInteriorFeature;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Tests\TestCase;

class DeveloperProjectUnitTypeFeatureValuesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->ensureLookupSchema();
    }

    public function test_allowed_inside_features_include_static_keys_and_labels(): void
    {
        $allowed = DeveloperProjectUnitType::allowedInsideFeatureValues();

        $this->assertContains('air_condition', $allowed);
        $this->assertContains('Air Condition', $allowed);
        $this->assertContains('jacuzzi', DeveloperProjectUnitType::allowedOutsideFeatureValues());
    }

    public function test_allowed_features_include_config_only_name_and_label(): void
    {
        PropertyInteriorFeature::query()->create([
            'company_id' => 1,
            'name' => 'built_in_kitchen',
            'label' => 'Built-in Kitchen',
        ]);
        PropertyExteriorFeature::query()->create([
            'company_id' => 1,
            'name' => 'car_park_open',
            'label' => 'Open Car Park',
        ]);

        $inside = DeveloperProjectUnitType::allowedInsideFeatureValues();
        $outside = DeveloperProjectUnitType::allowedOutsideFeatureValues();

        $this->assertContains('built_in_kitchen', $inside);
        $this->assertContains('Built-in Kitchen', $inside);
        $this->assertContains('car_park_open', $outside);
        $this->assertContains('Open Car Park', $outside);

        $this->assertNotContains('built_in_kitchen', array_keys(DeveloperProjectUnitType::INSIDE_FEATURES));
        $this->assertNotContains('car_park_open', array_keys(DeveloperProjectUnitType::OUTSIDE_FEATURES));
    }

    public function test_validation_accepts_config_only_slug_that_static_in_list_rejects(): void
    {
        PropertyInteriorFeature::query()->create([
            'company_id' => 1,
            'name' => 'built_in_kitchen',
            'label' => 'Built-in Kitchen',
        ]);

        $oldValidator = Validator::make(
            ['inside_features' => ['built_in_kitchen']],
            ['inside_features.*' => 'string|in:'.implode(',', array_keys(DeveloperProjectUnitType::INSIDE_FEATURES))],
        );
        $this->assertTrue($oldValidator->fails());

        $newValidator = Validator::make(
            ['inside_features' => ['built_in_kitchen']],
            ['inside_features.*' => ['string', Rule::in(DeveloperProjectUnitType::allowedInsideFeatureValues())]],
        );
        $this->assertFalse($newValidator->fails());
    }

    private function ensureLookupSchema(): void
    {
        if (! Schema::hasTable('property_interior_features')) {
            Schema::create('property_interior_features', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('property_exterior_features')) {
            Schema::create('property_exterior_features', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }
    }
}
