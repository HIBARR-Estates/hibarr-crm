<?php

namespace Tests\Unit\Models;

use App\Models\DeveloperProject;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeveloperProjectSlugTest extends TestCase
{
    private const COMPANY_ID = 1;

    private const OTHER_COMPANY_ID = 2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ensureSchema();
    }

    public function test_create_uses_name_as_slug(): void
    {
        $project = $this->createProject(['name' => 'Sunset Villas']);

        $this->assertSame('sunset-villas', $project->slug);
    }

    public function test_can_recreate_project_with_same_name_as_soft_deleted(): void
    {
        $original = $this->createProject([
            'name' => 'Sunset Villas',
            'developer_id' => 10,
        ]);
        $this->assertSame('sunset-villas', $original->slug);

        $original->delete();
        $this->assertNotNull(DeveloperProject::withTrashed()->find($original->id));
        $this->assertNull(DeveloperProject::query()->where('name', 'Sunset Villas')->first());
        $this->assertSame(
            'sunset-villas',
            DeveloperProject::withTrashed()->find($original->id)?->slug
        );

        $recreated = $this->createProject([
            'name' => 'Sunset Villas',
            'developer_id' => 10,
        ]);

        $this->assertNotSame($original->id, $recreated->id);
        $this->assertSame('Sunset Villas', $recreated->name);
        $this->assertNotSame('sunset-villas', $recreated->slug);
        $this->assertStringStartsWith('sunset-villas-', $recreated->slug);
        $this->assertSame(
            'sunset-villas',
            DeveloperProject::withTrashed()->find($original->id)?->slug
        );
    }

    public function test_rename_to_trashed_project_name_gets_suffixed_slug(): void
    {
        $trashed = $this->createProject(['name' => 'Sunset Villas']);
        $trashed->delete();

        $live = $this->createProject(['name' => 'Other Residences']);
        $this->assertSame('other-residences', $live->slug);

        $live->update(['name' => 'Sunset Villas']);

        $this->assertSame('Sunset Villas', $live->fresh()->name);
        $this->assertNotSame('sunset-villas', $live->fresh()->slug);
        $this->assertStringStartsWith('sunset-villas-', $live->fresh()->slug);
    }

    public function test_live_slug_collision_still_suffixes(): void
    {
        $first = $this->createProject(['name' => 'Sunset Villas']);
        $second = $this->createProject(['name' => 'Sunset Villas']);

        $this->assertSame('sunset-villas', $first->slug);
        $this->assertNotSame('sunset-villas', $second->slug);
        $this->assertStringStartsWith('sunset-villas-', $second->slug);
    }

    public function test_trashed_slug_in_another_company_does_not_force_suffix(): void
    {
        $other = $this->createProject([
            'company_id' => self::OTHER_COMPANY_ID,
            'name' => 'Sunset Villas',
        ]);
        $other->delete();

        $project = $this->createProject([
            'company_id' => self::COMPANY_ID,
            'name' => 'Sunset Villas',
        ]);

        $this->assertSame('sunset-villas', $project->slug);
    }

    public function test_make_unique_slug_skips_trashed_base_slug(): void
    {
        $original = $this->createProject(['name' => 'Marina Residences']);
        $original->delete();

        $slug = DeveloperProject::makeUniqueSlug('Marina Residences', self::COMPANY_ID);

        $this->assertNotSame('marina-residences', $slug);
        $this->assertStringStartsWith('marina-residences-', $slug);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createProject(array $overrides = []): DeveloperProject
    {
        return DeveloperProject::query()->create(array_merge([
            'company_id' => self::COMPANY_ID,
            'name' => 'Test Project',
            'is_hidden' => false,
            'rental_guarantee' => false,
        ], $overrides));
    }

    private function ensureSchema(): void
    {
        if (! Schema::hasTable('developer_projects')) {
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
                $table->unique(['company_id', 'slug'], 'developer_projects_company_id_slug_unique');
            });

            return;
        }

        if (! Schema::hasColumn('developer_projects', 'slug')) {
            Schema::table('developer_projects', function (Blueprint $table) {
                $table->string('slug', 255)->nullable()->after('name');
            });
        }

        DB::table('developer_projects')->delete();
    }
}
