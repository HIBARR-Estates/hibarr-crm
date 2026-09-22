<?php

namespace Tests\Feature\Leads;

use App\Models\Lead;
use App\Services\LeadService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Date-only start/end on the leads list is a closed calendar day, so a lead
 * created this afternoon is not dropped by an end_date of today.
 */
class LeadDateFilterTest extends TestCase
{
    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_a_date_only_end_date_includes_the_whole_day(): void
    {
        $in = $this->lead(['created_at' => '2026-09-22 18:00:00']);
        $this->lead(['created_at' => '2026-09-23 00:00:01']);

        $request = Request::create('/lead-contact', 'GET', [
            'start_date' => '2026-09-22',
            'end_date' => '2026-09-22',
        ]);
        $apply = new ReflectionMethod(LeadService::class, 'applyFilters');
        $apply->setAccessible(true);

        $query = Lead::query();
        $apply->invoke(app(LeadService::class), $query, $request);

        $this->assertSame([$in], $query->pluck('id')->map(fn ($id) => (int) $id)->all());
    }

    /** @param  array<string, mixed>  $attributes */
    private function lead(array $attributes = []): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Lead',
            'deleted_at' => null,
            'created_at' => now()->subDays(3),
            'updated_at' => now(),
        ], $attributes));
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('leads');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->softDeletes();
            $table->timestamps();
        });
    }
}
