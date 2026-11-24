<?php

namespace Tests\Feature;

use App\Models\LeadPipeline;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * DealController@show ships `pipelineHasPackages` / `pipelineOfferingType` from
 * `lead_pipelines.offering_type` so the deal UI can show only the package or
 * property selector.
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

        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('offering_type', 20)->default('property');
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_package_offering_pipeline_reports_true(): void
    {
        $id = $this->insertPipeline(LeadPipeline::OFFERING_PACKAGE);

        $pipeline = LeadPipeline::findOrFail($id);

        $this->assertTrue($pipeline->isPackageOffering());
        $this->assertFalse($pipeline->isPropertyOffering());
    }

    public function test_property_offering_pipeline_reports_false(): void
    {
        $id = $this->insertPipeline(LeadPipeline::OFFERING_PROPERTY);

        $pipeline = LeadPipeline::findOrFail($id);

        $this->assertFalse($pipeline->isPackageOffering());
        $this->assertTrue($pipeline->isPropertyOffering());
    }

    public function test_both_offering_allows_packages_and_properties(): void
    {
        $id = $this->insertPipeline(LeadPipeline::OFFERING_BOTH);
        $pipeline = LeadPipeline::findOrFail($id);

        $this->assertSame(LeadPipeline::OFFERING_BOTH, $pipeline->offeringType());
        $this->assertFalse($pipeline->isPackageOffering());
        $this->assertFalse($pipeline->isPropertyOffering());
        $this->assertTrue($pipeline->allowsPackages());
        $this->assertTrue($pipeline->allowsProperties());
    }

    public function test_missing_offering_type_defaults_to_property(): void
    {
        $id = $this->insertPipeline(LeadPipeline::OFFERING_PROPERTY);
        $pipeline = LeadPipeline::findOrFail($id);
        // Empty/legacy values fail closed to property (show properties only).
        $pipeline->offering_type = null;

        $this->assertSame(LeadPipeline::OFFERING_PROPERTY, $pipeline->offeringType());
        $this->assertFalse($pipeline->isPackageOffering());
        $this->assertTrue($pipeline->isPropertyOffering());
    }

    private function insertPipeline(string $offeringType): int
    {
        return (int) DB::table('lead_pipelines')->insertGetId([
            'company_id' => 1,
            'name' => 'Pipeline '.$offeringType,
            'offering_type' => $offeringType,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_pipelines');
    }
}
