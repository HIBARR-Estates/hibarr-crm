<?php

namespace Tests\Unit\Support;

use App\Models\DeveloperProject;
use App\Models\ProjectLocation;
use App\Support\DeveloperProjectListingQuery;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DeveloperProjectListingQueryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('developer_projects');
        Schema::dropIfExists('project_locations');

        Schema::create('project_locations', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('city')->nullable();
            $table->string('area')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('developer_projects', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('developer_id')->nullable();
            $table->unsignedBigInteger('project_location_id')->nullable();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('developer_projects');
        Schema::dropIfExists('project_locations');

        parent::tearDown();
    }

    public function test_area_filter_applies_without_city(): void
    {
        $this->seedProject('Iskele Project', 'Famagusta', 'Iskele');
        $this->seedProject('Lapta Project', 'Kyrenia', 'Lapta');

        $names = $this->filteredNames(['area' => ['Iskele']]);

        $this->assertSame(['Iskele Project'], $names);
    }

    public function test_area_filter_is_case_insensitive_and_trimmed(): void
    {
        $this->seedProject('Iskele Project', 'Famagusta', ' Iskele ');
        $this->seedProject('Lapta Project', 'Kyrenia', 'Lapta');

        $names = $this->filteredNames(['area' => ['iskele']]);

        $this->assertSame(['Iskele Project'], $names);
    }

    public function test_comma_joined_area_string_filters_without_city(): void
    {
        $this->seedProject('Iskele Project', 'Famagusta', 'Iskele');
        $this->seedProject('Lapta Project', 'Kyrenia', 'Lapta');
        $this->seedProject('Bahceli Project', 'Famagusta', 'Bahceli');

        $names = $this->filteredNames(['area' => 'Iskele,Bahceli']);

        $this->assertSame(['Bahceli Project', 'Iskele Project'], $names);
    }

    public function test_city_and_area_combine_with_and_semantics(): void
    {
        $this->seedProject('Iskele Project', 'Famagusta', 'Iskele');
        $this->seedProject('Lapta Project', 'Kyrenia', 'Lapta');

        $matched = $this->filteredNames(['city' => ['famagusta'], 'area' => ['Iskele']]);
        $mismatched = $this->filteredNames(['city' => ['Famagusta'], 'area' => ['Lapta']]);
        $cityOnly = $this->filteredNames(['city' => ['KYRENIA']]);

        $this->assertSame(['Iskele Project'], $matched);
        $this->assertSame([], $mismatched);
        $this->assertSame(['Lapta Project'], $cityOnly);
    }

    public function test_no_location_filters_returns_everything(): void
    {
        $this->seedProject('Iskele Project', 'Famagusta', 'Iskele');
        $this->seedProject('Lapta Project', 'Kyrenia', 'Lapta');

        $names = $this->filteredNames([]);

        $this->assertCount(2, $names);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return list<string>
     */
    private function filteredNames(array $filters): array
    {
        $query = DeveloperProject::query();

        DeveloperProjectListingQuery::apply($query, $filters, true);

        return $query->orderBy('name')->pluck('name')->all();
    }

    private function seedProject(string $name, string $city, string $area): DeveloperProject
    {
        $location = ProjectLocation::create([
            'company_id' => 1,
            'name' => $name.' Location',
            'city' => $city,
            'area' => $area,
        ]);

        return DeveloperProject::create([
            'company_id' => 1,
            'name' => $name,
            'project_location_id' => $location->id,
        ]);
    }
}
