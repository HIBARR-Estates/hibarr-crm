<?php

namespace Tests\Unit\Support;

use App\Models\Developer;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectAsset;
use App\Models\ProjectLocation;
use App\Support\DeveloperProjectListingPayload;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeveloperProjectListingPayloadTest extends TestCase
{
    private const COMPANY_ID = 1;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ensureSchema();
    }

    public function test_payload_contains_listing_fields_and_cover_thumbnail_url(): void
    {
        $location = $this->createLocation();
        $developer = $this->createDeveloper();
        $project = $this->createProject([
            'developer_id' => $developer->id,
            'project_location_id' => $location->id,
            'description' => 'A listing description',
            'starting_price' => '185000.00',
            'completion_date' => '2026-06-01',
            'total_units' => 40,
            'total_units_sold' => 12,
            'facilities' => ['pool', 'gym'],
        ]);

        $this->createAsset($project, [
            'name' => 'gallery.jpg',
            'external_url' => 'https://example.test/gallery.jpg',
            'order' => 1,
            'tags' => ['gallery'],
        ]);

        $cover = $this->createAsset($project, [
            'name' => 'cover.jpg',
            'external_url' => 'https://example.test/cover.jpg',
            'order' => 5,
            'tags' => ['cover'],
        ]);

        $project->load(DeveloperProjectListingPayload::RELATIONS);
        $project->setAttribute('properties_count', 8);
        $project->setAttribute('sold_properties_count', 3);

        $payload = DeveloperProjectListingPayload::from($project);

        $this->assertSame([
            'id',
            'name',
            'description',
            'project_location_id',
            'starting_price',
            'completion_date',
            'total_units',
            'total_units_sold',
            'properties_count',
            'sold_properties_count',
            'is_hidden',
            'location',
            'developer',
            'thumbnail',
        ], array_keys($payload));

        $this->assertSame($project->id, $payload['id']);
        $this->assertSame('Listing Payload Project', $payload['name']);
        $this->assertSame('A listing description', $payload['description']);
        $this->assertSame($location->id, $payload['project_location_id']);
        $this->assertSame('2026-06-01', $payload['completion_date']);
        $this->assertSame(40, $payload['total_units']);
        $this->assertSame(12, $payload['total_units_sold']);
        $this->assertSame(8, $payload['properties_count']);
        $this->assertSame(3, $payload['sold_properties_count']);
        $this->assertFalse($payload['is_hidden']);

        $this->assertSame(['id', 'name'], array_keys($payload['location']));
        $this->assertSame($location->id, $payload['location']['id']);
        $this->assertSame('Kyrenia', $payload['location']['name']);

        $this->assertSame(['id', 'name', 'logo_url', 'is_hidden'], array_keys($payload['developer']));
        $this->assertSame($developer->id, $payload['developer']['id']);
        $this->assertSame('Acme Dev', $payload['developer']['name']);
        $this->assertSame('https://example.test/logo.png', $payload['developer']['logo_url']);
        $this->assertFalse($payload['developer']['is_hidden']);

        $this->assertSame(['id', 'url'], array_keys($payload['thumbnail']));
        $this->assertSame($cover->id, $payload['thumbnail']['id']);
        $this->assertSame('https://example.test/cover.jpg', $payload['thumbnail']['url']);
    }

    public function test_payload_omits_gallery_expose_config_facilities_and_location_attractions(): void
    {
        $location = $this->createLocation([
            'attractions' => [
                [
                    'name' => 'Beach',
                    'content' => ['Nice sand'],
                    'images' => [
                        'primary' => 'https://example.test/beach-primary.jpg',
                        'secondary' => 'https://example.test/beach-secondary.jpg',
                    ],
                ],
            ],
        ]);
        $project = $this->createProject([
            'project_location_id' => $location->id,
            'facilities' => ['pool'],
        ]);

        $this->createAsset($project, [
            'name' => 'gallery.jpg',
            'external_url' => 'https://example.test/gallery.jpg',
            'order' => 1,
            'tags' => ['gallery'],
        ]);

        $project->load(['location', 'developer', 'thumbnail', 'assets']);

        $payload = DeveloperProjectListingPayload::from($project);

        $this->assertArrayNotHasKey('assets', $payload);
        $this->assertArrayNotHasKey('expose_config', $payload);
        $this->assertArrayNotHasKey('facilities', $payload);
        $this->assertArrayNotHasKey('attractions', $payload);
        $this->assertArrayNotHasKey('attractions', $payload['location'] ?? []);
        $this->assertSame(['id', 'name'], array_keys($payload['location']));
    }

    public function test_payload_has_null_thumbnail_when_project_has_no_images(): void
    {
        $project = $this->createProject();
        $project->load(DeveloperProjectListingPayload::RELATIONS);

        $payload = DeveloperProjectListingPayload::from($project);

        $this->assertNull($payload['thumbnail']);
        $this->assertNull($payload['location']);
        $this->assertNull($payload['developer']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createProject(array $overrides = []): DeveloperProject
    {
        return DeveloperProject::query()->create(array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Listing Payload Project',
            'slug' => 'listing-payload-project-'.uniqid(),
            'is_hidden' => false,
            'rental_guarantee' => false,
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createLocation(array $overrides = []): ProjectLocation
    {
        return ProjectLocation::query()->create(array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Kyrenia',
            'city' => 'Kyrenia',
            'area' => 'Center',
        ], $overrides));
    }

    private function createDeveloper(): Developer
    {
        return Developer::query()->create([
            'company_id' => self::COMPANY_ID,
            'name' => 'Acme Dev',
            'logo_url' => 'https://example.test/logo.png',
            'is_hidden' => false,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createAsset(DeveloperProject $project, array $overrides): DeveloperProjectAsset
    {
        return DeveloperProjectAsset::query()->create(array_merge([
            'developer_project_id' => $project->id,
            'company_id' => self::COMPANY_ID,
            'asset_type' => DeveloperProjectAsset::TYPE_IMAGE,
            'name' => 'asset.jpg',
            'external_url' => 'https://example.test/asset.jpg',
            'order' => 0,
            'tags' => [],
        ], $overrides));
    }

    private function ensureSchema(): void
    {
        Schema::dropIfExists('developer_project_assets');
        Schema::dropIfExists('developer_projects');
        Schema::dropIfExists('project_locations');
        Schema::dropIfExists('developers');

        Schema::create('developers', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('name');
            $table->string('logo_url')->nullable();
            $table->boolean('is_hidden')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('project_locations', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('city')->nullable();
            $table->string('area')->nullable();
            $table->json('attractions')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('developer_projects', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('developer_id')->nullable();
            $table->unsignedBigInteger('project_location_id')->nullable();
            $table->string('name');
            $table->string('slug', 255)->nullable();
            $table->text('description')->nullable();
            $table->decimal('starting_price', 15, 2)->nullable();
            $table->date('completion_date')->nullable();
            $table->unsignedInteger('total_units')->nullable();
            $table->unsignedInteger('total_units_sold')->nullable();
            $table->boolean('is_hidden')->default(false);
            $table->boolean('rental_guarantee')->default(false);
            $table->json('facilities')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('developer_project_assets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('developer_project_id');
            $table->unsignedInteger('company_id');
            $table->string('name')->nullable();
            $table->string('asset_type')->nullable();
            $table->string('file_path')->nullable();
            $table->string('external_url')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->json('tags')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });
    }
}
