<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Services\DealFilters;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * DealFilters is shared by the deals table, the kanban column counts and the
 * column totals, so these cover the query semantics for all three.
 */
class DealFilterMultiValueTest extends TestCase
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
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_category_filter_matches_any_of_the_comma_joined_ids(): void
    {
        $a = $this->insertDeal(['name' => 'A', 'category_id' => 1]);
        $b = $this->insertDeal(['name' => 'B', 'category_id' => 2]);
        $this->insertDeal(['name' => 'C', 'category_id' => 3]);

        $this->assertSame([$a, $b], $this->filteredDealIds(['category_id' => '1,2']));
    }

    public function test_all_is_treated_as_no_filter(): void
    {
        $a = $this->insertDeal(['name' => 'A', 'category_id' => 1]);
        $b = $this->insertDeal(['name' => 'B', 'category_id' => 2]);

        $this->assertSame([$a, $b], $this->filteredDealIds(['category_id' => 'all']));
    }

    public function test_outcome_filter_treats_open_as_no_outcome_recorded(): void
    {
        $open = $this->insertDeal(['name' => 'Open']);
        $won = $this->insertDeal(['name' => 'Won', 'outcome_status' => 'won']);
        $this->insertDeal(['name' => 'Lost', 'outcome_status' => 'lost']);

        $this->assertSame([$open], $this->filteredDealIds(['outcome_status' => 'open']));
        $this->assertSame([$open, $won], $this->filteredDealIds(['outcome_status' => 'open,won']));
    }

    public function test_locked_filter_selects_each_state(): void
    {
        $locked = $this->insertDeal(['name' => 'Locked', 'is_locked' => 1]);
        $unlocked = $this->insertDeal(['name' => 'Unlocked', 'is_locked' => 0]);

        $this->assertSame([$locked], $this->filteredDealIds(['is_locked' => '1']));
        $this->assertSame([$unlocked], $this->filteredDealIds(['is_locked' => '0']));
    }

    public function test_created_and_closed_ranges_filter_independently_and_allow_one_open_end(): void
    {
        $early = $this->insertDeal([
            'name' => 'Early',
            'created_at' => '2026-01-10 09:00:00',
            'close_date' => '2026-02-01 00:00:00',
        ]);
        $late = $this->insertDeal([
            'name' => 'Late',
            'created_at' => '2026-03-10 09:00:00',
            'close_date' => '2026-04-01 00:00:00',
        ]);

        $this->assertSame([$early], $this->filteredDealIds([
            'start_date' => '2026-01-01',
            'end_date' => '2026-01-31',
        ]));

        // Open-ended: only the lower bound given.
        $this->assertSame([$late], $this->filteredDealIds(['start_date' => '2026-02-01']));

        $this->assertSame([$late], $this->filteredDealIds([
            'close_start' => '2026-03-01',
            'close_end' => '2026-04-30',
        ]));
    }

    public function test_value_range_bounds_are_inclusive(): void
    {
        $this->insertDeal(['name' => 'Cheap', 'value' => 100]);
        $mid = $this->insertDeal(['name' => 'Mid', 'value' => 500]);
        $this->insertDeal(['name' => 'Rich', 'value' => 5000]);

        $this->assertSame([$mid], $this->filteredDealIds([
            'min_value_range' => '500',
            'max_value_range' => '500',
        ]));
    }

    /**
     * @param  array<string, string>  $params
     * @return array<int, int>
     */
    private function filteredDealIds(array $params): array
    {
        $query = Deal::query();
        (new DealFilters)->apply($query, Request::create('/deals', 'GET', $params));

        return $query->orderBy('deals.id')->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('deals');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->unsignedInteger('category_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->string('outcome_status')->nullable();
            $table->boolean('is_locked')->default(false);
            $table->dateTime('close_date')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertDeal(array $attributes): int
    {
        return (int) DB::table('deals')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'name' => 'Test Deal',
            'category_id' => null,
            'agent_id' => null,
            'value' => null,
            'outcome_status' => null,
            'is_locked' => false,
            'close_date' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
