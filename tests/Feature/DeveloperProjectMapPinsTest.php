<?php

namespace Tests\Feature;

use App\Models\DeveloperProject;
use App\Models\ProjectLocation;
use App\Models\Property;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeveloperProjectMapPinsTest extends TestCase
{
    private const COMPANY_ID = 1;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ensureSchema();
    }

    public function test_two_projects_same_area_keep_independent_map_pins(): void
    {
        $location = $this->createLocation([
            'map_url' => 'https://maps.example/shared-default',
            'address' => ['street' => 'Shared Default'],
        ]);

        $projectA = $this->createProject([
            'name' => 'Lune',
            'project_location_id' => $location->id,
            'map_url' => 'https://maps.example/lune',
            'address' => ['street' => 'Lune Street'],
        ]);

        $projectB = $this->createProject([
            'name' => 'Maldives Homes',
            'project_location_id' => $location->id,
            'map_url' => 'https://maps.example/maldives',
            'address' => ['street' => 'Maldives Street'],
        ]);

        $this->assertSame($location->id, $projectA->project_location_id);
        $this->assertSame($location->id, $projectB->project_location_id);
        $this->assertSame('https://maps.example/lune', $projectA->locationForApi()['map_url']);
        $this->assertSame('https://maps.example/maldives', $projectB->locationForApi()['map_url']);

        $projectA->update(['map_url' => 'https://maps.example/lune-fixed']);

        $this->assertSame('https://maps.example/maldives', $projectB->fresh()->map_url);
        $this->assertSame('https://maps.example/shared-default', $location->fresh()->map_url);
        $this->assertSame('https://maps.example/lune-fixed', $projectA->fresh()->locationForApi()['map_url']);
    }

    public function test_location_for_api_falls_back_to_shared_defaults(): void
    {
        $location = $this->createLocation([
            'map_url' => 'https://maps.example/area-default',
            'latitude' => 35.5,
            'longitude' => 33.5,
            'address' => ['street' => 'Default Street', 'country' => 'Cyprus'],
        ]);

        $project = $this->createProject([
            'name' => 'No Pin Yet',
            'project_location_id' => $location->id,
            'map_url' => null,
            'latitude' => null,
            'longitude' => null,
            'address' => null,
        ]);

        $overlay = $project->locationForApi();

        $this->assertSame('https://maps.example/area-default', $overlay['map_url']);
        $this->assertSame('Default Street', $overlay['address']['street']);
        $this->assertSame('Default Street, Cyprus', $overlay['full_address']);
        $this->assertSame('https://maps.example/area-default', $project->effectiveMapUrl());
    }

    public function test_deduplicate_relinks_without_changing_project_pins(): void
    {
        $canonical = $this->createLocation([
            'city' => 'Kyrenia',
            'area' => 'Esentepe',
            'name' => 'Esentepe, Kyrenia',
            'map_url' => 'https://maps.example/canonical-default',
            'attractions' => [],
        ]);

        $duplicate = $this->createLocation([
            'city' => 'Kyrenia',
            'area' => 'Esentepe',
            'name' => 'Esentepe / Kyrenia',
            'map_url' => 'https://maps.example/duplicate-default',
            'attractions' => [
                ['name' => 'Beach', 'content' => ['Nice beach'], 'images' => ['primary' => null, 'secondary' => null]],
            ],
            'image_url' => 'https://cdn.example/area-map.png',
        ]);

        $projectOnDuplicate = $this->createProject([
            'name' => 'Tecoma Gold',
            'project_location_id' => $duplicate->id,
            'map_url' => 'https://maps.example/tecoma-own-pin',
        ]);

        $projectOnCanonical = $this->createProject([
            'name' => 'The Nest',
            'project_location_id' => $canonical->id,
            'map_url' => 'https://maps.example/nest-own-pin',
        ]);

        $exit = Artisan::call('project-locations:deduplicate', [
            '--company' => self::COMPANY_ID,
            '--apply' => true,
        ]);

        $this->assertSame(0, $exit);

        $projectOnDuplicate->refresh();
        $projectOnCanonical->refresh();
        $canonical->refresh();
        $duplicate->refresh();

        $this->assertSame($canonical->id, $projectOnDuplicate->project_location_id);
        $this->assertSame($canonical->id, $projectOnCanonical->project_location_id);
        $this->assertSame('https://maps.example/tecoma-own-pin', $projectOnDuplicate->map_url);
        $this->assertSame('https://maps.example/nest-own-pin', $projectOnCanonical->map_url);
        $this->assertNotNull($duplicate->deleted_at);
        $this->assertNotEmpty($canonical->attractions);
        $this->assertSame('https://cdn.example/area-map.png', $canonical->image_url);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createLocation(array $overrides = []): ProjectLocation
    {
        return ProjectLocation::create(array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Test Area, Test City',
            'city' => 'Test City',
            'area' => 'Test Area',
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createProject(array $overrides = []): DeveloperProject
    {
        return DeveloperProject::create(array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Test Project ' . uniqid('', true),
            'description' => null,
            'project_location_id' => null,
            'facilities' => null,
            'distances' => null,
            'payment_plan' => null,
            'is_hidden' => false,
            'rental_guarantee' => false,
        ], $overrides));
    }

    private function ensureSchema(): void
    {
        if (!Schema::hasTable('project_locations')) {
            Schema::create('project_locations', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name')->nullable();
                $table->string('city')->nullable();
                $table->string('area')->nullable();
                $table->text('description')->nullable();
                $table->json('address')->nullable();
                $table->string('map_url', 500)->nullable();
                $table->string('image_url', 500)->nullable();
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();
                $table->json('attractions')->nullable();
                $table->json('infrastructure')->nullable();
                $table->json('airports')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            foreach (['image_url', 'attractions', 'infrastructure', 'airports', 'description'] as $column) {
                if (!Schema::hasColumn('project_locations', $column)) {
                    Schema::table('project_locations', function (Blueprint $table) use ($column) {
                        if (in_array($column, ['attractions', 'infrastructure', 'airports'], true)) {
                            $table->json($column)->nullable();
                        } elseif ($column === 'description') {
                            $table->text($column)->nullable();
                        } else {
                            $table->string($column, 500)->nullable();
                        }
                    });
                }
            }
            DB::table('project_locations')->delete();
        }

        if (!Schema::hasTable('developer_projects')) {
            Schema::create('developer_projects', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedBigInteger('developer_id')->nullable();
                $table->string('name');
                $table->string('slug', 255)->nullable();
                $table->text('description')->nullable();
                $table->unsignedBigInteger('project_location_id')->nullable();
                $table->string('map_url', 2048)->nullable();
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();
                $table->json('address')->nullable();
                $table->json('facilities')->nullable();
                $table->json('distances')->nullable();
                $table->json('payment_plan')->nullable();
                $table->boolean('is_hidden')->default(false);
                $table->boolean('rental_guarantee')->default(false);
                $table->timestamps();
                $table->softDeletes();
                $table->unique(['company_id', 'slug'], 'dp_map_pins_company_slug_unique');
            });
        } else {
            if (!Schema::hasColumn('developer_projects', 'map_url')) {
                Schema::table('developer_projects', function (Blueprint $table) {
                    $table->string('map_url', 2048)->nullable();
                    $table->decimal('latitude', 10, 7)->nullable();
                    $table->decimal('longitude', 10, 7)->nullable();
                    $table->json('address')->nullable();
                });
            }
            DB::table('developer_projects')->delete();
        }

        if (!Schema::hasTable('properties')) {
            Schema::create('properties', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedBigInteger('developer_project_id')->nullable();
                $table->unsignedBigInteger('project_location_id')->nullable();
                $table->string('status')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            if (!Schema::hasColumn('properties', 'project_location_id')) {
                Schema::table('properties', function (Blueprint $table) {
                    $table->unsignedBigInteger('project_location_id')->nullable();
                });
            }
            // Avoid wiping unrelated property data when table already exists from other tests
            if (Schema::hasColumn('properties', 'project_location_id')) {
                Property::query()->whereNotNull('project_location_id')->update(['project_location_id' => null]);
            }
        }
    }
}
