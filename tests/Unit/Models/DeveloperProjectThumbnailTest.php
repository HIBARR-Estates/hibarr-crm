<?php

namespace Tests\Unit\Models;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectAsset;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeveloperProjectThumbnailTest extends TestCase
{
    private const COMPANY_ID = 1;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ensureSchema();
    }

    public function test_thumbnail_prefers_cover_over_lower_order_assets(): void
    {
        $project = $this->createProject();

        $this->createAsset($project, [
            'name' => 'first-by-order.jpg',
            'external_url' => 'https://example.test/first.jpg',
            'order' => 1,
            'tags' => ['gallery'],
        ]);

        $cover = $this->createAsset($project, [
            'name' => 'cover.jpg',
            'external_url' => 'https://example.test/cover.jpg',
            'order' => 5,
            'tags' => ['cover'],
        ]);

        $project->load('thumbnail');

        $this->assertNotNull($project->thumbnail);
        $this->assertSame($cover->id, $project->thumbnail->id);
    }

    public function test_thumbnail_prefers_hero_when_no_cover(): void
    {
        $project = $this->createProject();

        $this->createAsset($project, [
            'name' => 'gallery.jpg',
            'external_url' => 'https://example.test/gallery.jpg',
            'order' => 1,
            'tags' => ['gallery'],
        ]);

        $hero = $this->createAsset($project, [
            'name' => 'hero.jpg',
            'external_url' => 'https://example.test/hero.jpg',
            'order' => 3,
            'tags' => ['hero'],
        ]);

        $project->load('thumbnail');

        $this->assertNotNull($project->thumbnail);
        $this->assertSame($hero->id, $project->thumbnail->id);
    }

    public function test_thumbnail_falls_back_to_lowest_order_image(): void
    {
        $project = $this->createProject();

        $first = $this->createAsset($project, [
            'name' => 'a.jpg',
            'external_url' => 'https://example.test/a.jpg',
            'order' => 1,
            'tags' => ['gallery'],
        ]);

        $this->createAsset($project, [
            'name' => 'b.jpg',
            'external_url' => 'https://example.test/b.jpg',
            'order' => 2,
            'tags' => ['gallery'],
        ]);

        $project->load('thumbnail');

        $this->assertNotNull($project->thumbnail);
        $this->assertSame($first->id, $project->thumbnail->id);
    }

    public function test_thumbnail_ignores_non_image_assets(): void
    {
        $project = $this->createProject();

        $this->createAsset($project, [
            'name' => 'clip.mp4',
            'external_url' => 'https://example.test/clip.mp4',
            'asset_type' => DeveloperProjectAsset::TYPE_VIDEO,
            'order' => 1,
            'tags' => ['cover'],
        ]);

        $image = $this->createAsset($project, [
            'name' => 'photo.jpg',
            'external_url' => 'https://example.test/photo.jpg',
            'order' => 2,
            'tags' => ['gallery'],
        ]);

        $project->load('thumbnail');

        $this->assertNotNull($project->thumbnail);
        $this->assertSame($image->id, $project->thumbnail->id);
    }

    private function createProject(): DeveloperProject
    {
        return DeveloperProject::query()->create([
            'company_id' => self::COMPANY_ID,
            'name' => 'Thumbnail Test Project',
            'slug' => 'thumbnail-test-project-' . uniqid(),
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
        if (!Schema::hasTable('developer_projects')) {
            Schema::create('developer_projects', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedBigInteger('developer_id')->nullable();
                $table->string('name');
                $table->string('slug', 255)->nullable();
                $table->string('reference_code', 50)->nullable();
                $table->text('description')->nullable();
                $table->unsignedBigInteger('project_location_id')->nullable();
                $table->boolean('is_hidden')->default(false);
                $table->boolean('rental_guarantee')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        } else {
            DB::table('developer_projects')->delete();
        }

        if (!Schema::hasTable('developer_project_assets')) {
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
        } else {
            DB::table('developer_project_assets')->delete();
        }
    }
}
