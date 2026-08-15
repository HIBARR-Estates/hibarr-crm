<?php

namespace Tests\Feature;

use App\Models\PackagePipeline;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Deals in a pipeline that has a package linked to it hide properties,
 * recommendations and offers. DealController@show ships the decision as the
 * `pipelineHasPackages` prop; this covers the lookup behind it.
 */
class PipelineHasPackagesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();

        Schema::create('package_pipeline', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('package_id');
            $table->unsignedInteger('pipeline_id');
            $table->unsignedInteger('default_stage_id')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_pipeline_with_a_linked_package_reports_true(): void
    {
        $this->link(packageId: 5, pipelineId: 1);

        $this->assertTrue($this->hasPackages(1));
    }

    public function test_pipeline_without_a_linked_package_reports_false(): void
    {
        $this->link(packageId: 5, pipelineId: 1);

        $this->assertFalse($this->hasPackages(2));
    }

    private function hasPackages(int $pipelineId): bool
    {
        return PackagePipeline::where('pipeline_id', $pipelineId)->exists();
    }

    private function link(int $packageId, int $pipelineId): void
    {
        DB::table('package_pipeline')->insert([
            'company_id' => 1,
            'package_id' => $packageId,
            'pipeline_id' => $pipelineId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('package_pipeline');
    }
}
