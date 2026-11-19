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
 * "Is not", "Is empty" and "Has any" on the Deals filters (`<key>_mode`).
 * DealFilters is shared by the table, the kanban column counts and the column
 * totals, so these cover the query semantics for all three.
 */
class DealFilterExclusionTest extends TestCase
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

    // ── scalar columns ───────────────────────────────────────────────────

    public function test_category_not_in_keeps_deals_with_no_category(): void
    {
        $a = $this->insertDeal(['category_id' => 1]);
        $b = $this->insertDeal(['category_id' => 2]);
        $none = $this->insertDeal(['category_id' => null]);

        $this->assertSame([$b, $none], $this->ids(['category_id' => '1', 'category_id_mode' => 'not_in']));
        $this->assertSame([$none], $this->ids(['category_id_mode' => 'empty']));
    }

    public function test_stage_and_pipeline_not_in_use_the_same_null_safe_column_filter(): void
    {
        $early = $this->insertDeal(['pipeline_stage_id' => 1, 'lead_pipeline_id' => 1]);
        $late = $this->insertDeal(['pipeline_stage_id' => 4, 'lead_pipeline_id' => 2]);

        $filters = new DealFilters;

        $stage = Deal::query();
        $filters->applyColumn($stage, Request::create('/', 'GET', ['pipeline_stage_id' => '1', 'pipeline_stage_id_mode' => 'not_in']), 'pipeline_stage_id', 'deals.pipeline_stage_id');
        $this->assertSame([$late], $stage->pluck('id')->map(fn ($id) => (int) $id)->all());

        $pipeline = Deal::query();
        $filters->applyColumn($pipeline, Request::create('/', 'GET', ['lead_pipeline_id' => '2', 'lead_pipeline_id_mode' => 'not_in']), 'lead_pipeline_id', 'deals.lead_pipeline_id');
        $this->assertSame([$early], $pipeline->pluck('id')->map(fn ($id) => (int) $id)->all());
    }

    public function test_a_board_is_never_opened_on_a_pipeline_that_was_excluded(): void
    {
        $filters = new DealFilters;

        $this->assertSame(['2'], $filters->includedValues(Request::create('/', 'GET', ['lead_pipeline_id' => '2']), 'lead_pipeline_id'));
        $this->assertSame([], $filters->includedValues(Request::create('/', 'GET', ['lead_pipeline_id' => '2', 'lead_pipeline_id_mode' => 'not_in']), 'lead_pipeline_id'));
    }

    public function test_a_mode_a_filter_does_not_offer_is_ignored(): void
    {
        $a = $this->insertDeal(['category_id' => 1, 'lead_pipeline_id' => 1, 'pipeline_stage_id' => 1, 'lead_id' => $this->insertContact(1)]);
        $b = $this->insertDeal(['category_id' => null, 'lead_pipeline_id' => null, 'pipeline_stage_id' => null, 'lead_id' => null]);

        // The modal offers category and source "is not" / "is empty", never "has any".
        $this->assertSame([$a, $b], $this->ids(['category_id_mode' => 'any']));
        $this->assertSame([$a, $b], $this->ids(['source_id_mode' => 'any']));

        // Pipeline and stage take "is not" only: "is empty" / "has any" change nothing,
        // so the value reads as "is one of", exactly as without the mode, in the table
        // and in the choice of the board's pipeline.
        $filters = new DealFilters;
        foreach (['empty', 'any'] as $mode) {
            foreach (['lead_pipeline_id' => 'deals.lead_pipeline_id', 'pipeline_stage_id' => 'deals.pipeline_stage_id'] as $key => $column) {
                $withMode = Deal::query();
                $filters->applyColumn($withMode, Request::create('/', 'GET', [$key => '1', "{$key}_mode" => $mode]), $key, $column);
                $without = Deal::query();
                $filters->applyColumn($without, Request::create('/', 'GET', [$key => '1']), $key, $column);

                $ids = fn ($q) => $q->orderBy('deals.id')->pluck('id')->map(fn ($id) => (int) $id)->all();
                $this->assertSame($ids($without), $ids($withMode), "{$key} takes no '{$mode}'");
            }

            $request = Request::create('/', 'GET', ['lead_pipeline_id' => '2', 'lead_pipeline_id_mode' => $mode]);
            $this->assertSame(['2'], $filters->includedValues($request, 'lead_pipeline_id'));
            $this->assertFalse($filters->pipelineExcluded($request, 2));
        }
    }

    public function test_a_pipeline_that_is_excluded_is_reported_as_such(): void
    {
        $filters = new DealFilters;
        $request = Request::create('/', 'GET', ['lead_pipeline_id' => '1,3', 'lead_pipeline_id_mode' => 'not_in']);

        $this->assertTrue($filters->pipelineExcluded($request, 1));
        $this->assertTrue($filters->pipelineExcluded($request, '3'));
        $this->assertFalse($filters->pipelineExcluded($request, 2));
        // No pipeline resolved while pipelines are excluded: nothing to show.
        $this->assertTrue($filters->pipelineExcluded($request, null));
        $this->assertFalse($filters->pipelineExcluded(Request::create('/', 'GET'), null));
        $this->assertFalse($filters->pipelineExcluded(Request::create('/', 'GET', ['lead_pipeline_id' => '1']), 1));
    }

    public function test_a_board_falls_back_to_a_pipeline_the_exclusion_has_not_ruled_out(): void
    {
        $filters = new DealFilters;
        // Default pipeline first, then the rest, as the controller offers them.
        $candidates = [2, 1, 2, 3];

        $none = Request::create('/', 'GET');
        $this->assertSame(2, $filters->firstPipelineNotExcluded($none, $candidates));

        // Excluding the default must not leave the board on it.
        $notDefault = Request::create('/', 'GET', ['lead_pipeline_id' => '2', 'lead_pipeline_id_mode' => 'not_in']);
        $this->assertSame(1, $filters->firstPipelineNotExcluded($notDefault, $candidates));

        $notTwo = Request::create('/', 'GET', ['lead_pipeline_id' => '2,1', 'lead_pipeline_id_mode' => 'not_in']);
        $this->assertSame(3, $filters->firstPipelineNotExcluded($notTwo, $candidates));

        // Everything excluded: nothing to open, so the caller keeps the default.
        $all = Request::create('/', 'GET', ['lead_pipeline_id' => '1,2,3', 'lead_pipeline_id_mode' => 'not_in']);
        $this->assertNull($filters->firstPipelineNotExcluded($all, $candidates));

        // No default pipeline configured: the first real one.
        $this->assertSame(1, $filters->firstPipelineNotExcluded($none, [null, 1, 2]));

        // "Is one of" is not an exclusion.
        $in = Request::create('/', 'GET', ['lead_pipeline_id' => '2']);
        $this->assertSame(2, $filters->firstPipelineNotExcluded($in, $candidates));
    }

    // ── source (on the contact) ──────────────────────────────────────────

    public function test_source_is_read_from_the_contact(): void
    {
        $facebook = $this->insertDeal(['lead_id' => $this->insertContact(1)]);
        $google = $this->insertDeal(['lead_id' => $this->insertContact(2)]);
        $unsourced = $this->insertDeal(['lead_id' => $this->insertContact(null)]);
        $noContact = $this->insertDeal(['lead_id' => null]);

        $this->assertSame([$facebook], $this->ids(['source_id' => '1']));
        $this->assertSame(
            [$google, $unsourced, $noContact],
            $this->ids(['source_id' => '1', 'source_id_mode' => 'not_in'])
        );
        $this->assertSame([$unsourced, $noContact], $this->ids(['source_id_mode' => 'empty']));
    }

    // ── packages (many-to-many) ──────────────────────────────────────────

    public function test_packages_not_in_empty_and_any(): void
    {
        $starter = $this->insertPackage('Starter');
        $premium = $this->insertPackage('Premium');

        $onStarter = $this->insertDeal();
        $this->attachPackage($onStarter, $starter);
        $onBoth = $this->insertDeal();
        $this->attachPackage($onBoth, $starter);
        $this->attachPackage($onBoth, $premium);
        $onPremium = $this->insertDeal();
        $this->attachPackage($onPremium, $premium);
        $bare = $this->insertDeal();

        $this->assertSame([$onPremium, $bare], $this->ids(['package_id' => (string) $starter, 'package_id_mode' => 'not_in']));
        $this->assertSame([$bare], $this->ids(['package_id_mode' => 'empty']));
        $this->assertSame([$onStarter, $onBoth, $onPremium], $this->ids(['package_id_mode' => 'any']));
        // Unchanged: "is one of".
        $this->assertSame([$onStarter, $onBoth], $this->ids(['package_id' => (string) $starter]));
    }

    // ── agent ────────────────────────────────────────────────────────────

    public function test_agent_empty_any_and_not_in_keep_unassigned_deals_where_they_belong(): void
    {
        $anna = $this->insertAgent(userId: 11, status: 'active');
        $ben = $this->insertAgent(userId: 12, status: 'active');

        $withAnna = $this->insertDeal(['agent_id' => $anna]);
        $withBen = $this->insertDeal(['agent_id' => $ben]);
        $unassigned = $this->insertDeal(['agent_id' => null]);

        $this->assertSame([$unassigned], $this->ids(['agent_id_mode' => 'empty']));
        $this->assertSame([$withAnna, $withBen], $this->ids(['agent_id_mode' => 'any']));

        // agent_id carries the user id; an unassigned deal is "not Anna" too.
        $this->assertSame([$withBen, $unassigned], $this->ids(['agent_id' => '11', 'agent_id_mode' => 'not_in']));
        // Unchanged: "is one of".
        $this->assertSame([$withAnna], $this->ids(['agent_id' => '11']));
    }

    public function test_agent_can_be_asked_for_by_status(): void
    {
        $active = $this->insertAgent(userId: 21, status: 'active');
        $inactive = $this->insertAgent(userId: 22, status: 'deactive');

        $onActive = $this->insertDeal(['agent_id' => $active]);
        $onInactive = $this->insertDeal(['agent_id' => $inactive]);
        $this->insertDeal(['agent_id' => null]);

        $this->assertSame([$onActive], $this->ids(['agent_id_mode' => 'active']));
        $this->assertSame([$onInactive], $this->ids(['agent_id_mode' => 'inactive']));
    }

    public function test_the_older_agent_status_param_still_works(): void
    {
        $anna = $this->insertAgent(userId: 11, status: 'active');
        $this->insertDeal(['agent_id' => $anna]);
        $unassigned = $this->insertDeal(['agent_id' => null]);

        $this->assertSame([$unassigned], $this->ids(['agent_status' => 'unassigned']));
    }

    public function test_a_mode_that_agent_does_not_take_is_ignored(): void
    {
        $anna = $this->insertAgent(userId: 11, status: 'active');
        $withAnna = $this->insertDeal(['agent_id' => $anna]);
        $this->insertDeal(['agent_id' => null]);

        $this->assertSame([$withAnna], $this->ids(['agent_id' => '11', 'agent_id_mode' => 'sideways']));
    }

    // ── closed date and value ────────────────────────────────────────────

    public function test_closed_date_empty_and_any_replace_the_range(): void
    {
        $closed = $this->insertDeal(['close_date' => '2026-02-01 00:00:00']);
        $open = $this->insertDeal(['close_date' => null]);

        $this->assertSame([$open], $this->ids(['close_start_mode' => 'empty']));
        $this->assertSame([$closed], $this->ids(['close_start_mode' => 'any']));
        $this->assertSame([$open], $this->ids(['close_start_mode' => 'empty', 'close_start' => '2026-01-01']));
    }

    public function test_deal_value_empty_means_null_or_zero(): void
    {
        $priced = $this->insertDeal(['value' => 250000]);
        $zero = $this->insertDeal(['value' => 0]);
        $null = $this->insertDeal(['value' => null]);

        $this->assertSame([$zero, $null], $this->ids(['value_range_mode' => 'empty']));
        // The range keeps working without the mode.
        $this->assertSame([$priced], $this->ids(['min_value_range' => '100']));
        // ...and gives way to it with.
        $this->assertSame([$zero, $null], $this->ids(['value_range_mode' => 'empty', 'min_value_range' => '100']));
    }

    // ── harness ──────────────────────────────────────────────────────────

    /**
     * @param  array<string, string>  $params
     * @return array<int, int>
     */
    private function ids(array $params): array
    {
        $query = Deal::query();
        (new DealFilters)->apply($query, Request::create('/deals', 'GET', $params));

        return $query->orderBy('deals.id')->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    private function insertContact(?int $sourceId): int
    {
        return (int) DB::table('leads')->insertGetId([
            'company_id' => $this->companyId,
            'client_name' => 'Contact',
            'source_id' => $sourceId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertAgent(int $userId, string $status): int
    {
        DB::table('users')->insert(['id' => $userId, 'name' => "User {$userId}", 'status' => $status]);

        return (int) DB::table('lead_agents')->insertGetId([
            'company_id' => $this->companyId,
            'user_id' => $userId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertPackage(string $name): int
    {
        return (int) DB::table('packages')->insertGetId([
            'company_id' => $this->companyId,
            'name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachPackage(int $dealId, int $packageId): void
    {
        DB::table('deal_package')->insert(['deal_id' => $dealId, 'package_id' => $packageId]);
    }

    /** @param  array<string, mixed>  $attributes */
    private function insertDeal(array $attributes = []): int
    {
        return (int) DB::table('deals')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'name' => 'Test Deal',
            'lead_id' => null,
            'lead_pipeline_id' => null,
            'pipeline_stage_id' => null,
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

    private function resetSchema(): void
    {
        foreach (['deal_package', 'packages', 'lead_agents', 'users', 'leads', 'deals'] as $table) {
            Schema::dropIfExists($table);
        }
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

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->unsignedInteger('source_id')->nullable();
            $table->unsignedInteger('merged_into_lead_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('status')->default('active');
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->timestamps();
        });

        Schema::create('packages', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deal_package', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('package_id');
        });
    }
}
