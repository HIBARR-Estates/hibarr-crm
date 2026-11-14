<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\DealController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\PipelineStage;
use App\Services\AgentWorkspace\DealPulse;
use App\Services\ConditionEvaluatorService;
use App\Services\FieldResolverService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Deals: the agent workspace's board and list at /agent/deals. The query,
 * scope and filters are the Deals index's own; what is checked here is the
 * wiring and the two things the page adds, each deal's stage conditions and
 * its last activity.
 */
class AgentWorkspaceDealsTest extends TestCase
{
    private const TABLES = ['crm_events', 'deal_automation_actions', 'deal_automation_conditions', 'deal_automations', 'deals', 'pipeline_stages', 'lead_pipelines'];

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->integer('priority')->default(0);
            $table->timestamps();
        });
        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->integer('priority')->default(0);
            $table->timestamps();
        });
        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->decimal('value', 12, 2)->default(0);
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->timestamps();
        });
        Schema::create('deal_automations', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->unsignedInteger('pipeline_id')->nullable();
            $table->string('subject_type')->nullable();
            $table->boolean('active')->default(true);
            $table->integer('priority')->default(0);
            $table->timestamps();
        });
        Schema::create('deal_automation_conditions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_automation_id');
            $table->string('field');
            $table->string('operator');
            $table->text('value')->nullable();
            $table->timestamps();
        });
        Schema::create('deal_automation_actions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_automation_id');
            $table->string('action_type')->nullable();
            $table->unsignedInteger('target_stage_id')->nullable();
            $table->timestamps();
        });
        Schema::create('crm_events', function (Blueprint $table) {
            $table->increments('id');
            $table->string('uuid')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedInteger('model_id')->nullable();
            $table->dateTime('occurred_at')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
        Mockery::close();
        parent::tearDown();
    }

    public function test_the_page_is_registered_behind_the_workspace_gate(): void
    {
        $this->assertTrue(Route::has('agent.deals'));
        $this->assertStringEndsWith('/agent/deals', route('agent.deals', [], false));

        $route = Route::getRoutes()->getByName('agent.deals');
        $this->assertSame(DealController::class.'@agentIndex', $route->getActionName());
        $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
        $this->assertContains('auth', $route->gatherMiddleware());
    }

    public function test_the_page_and_a_deal_do_not_shadow_each_other(): void
    {
        $page = Route::getRoutes()->getByName('agent.deals');
        $deal = Route::getRoutes()->getByName('agent.deals.show');

        $this->assertTrue($page->matches(Request::create('/agent/deals')));
        $this->assertFalse($deal->matches(Request::create('/agent/deals')));
        $this->assertTrue($deal->matches(Request::create('/agent/deals/42')));
    }

    public function test_the_dock_opens_deals_on_the_agent_page(): void
    {
        $destinations = file_get_contents(base_path('resources/js/Components/Redesign/agent/destinations.ts'));

        $this->assertStringContainsString('segment: "deals", href: "/agent/deals"', $destinations);
    }

    public function test_someone_without_view_deals_gets_a_403_not_a_redirect_back(): void
    {
        $controller = new class extends DealController
        {
            public function __construct()
            {
                $this->viewLeadPermission = 'none';
            }
        };

        try {
            $controller->agentIndex(Request::create('/agent/deals'), app(DealPulse::class));
            $this->fail('A denied request must abort.');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function test_an_empty_page_needs_no_queries_for_the_extras(): void
    {
        DB::enableQueryLog();

        $this->assertSame([], $this->pulse()->forDeals(collect()));
        $this->assertCount(0, DB::getQueryLog());
    }

    public function test_conditions_count_the_next_stages_requirements_a_deal_already_meets(): void
    {
        [$first, $second] = $this->pipeline();
        $a = $this->deal($first, 'Ready');
        $b = $this->deal($first, 'Not yet');
        $this->moveAutomation($second, ['deal.expose_sent', 'deal.meeting_held']);

        $resolver = Mockery::mock(FieldResolverService::class);
        $resolver->shouldReceive('resolve')->andReturnUsing(
            fn (Deal $deal, string $field) => $deal->id === $a->id ? 'yes' : ($field === 'deal.meeting_held' ? 'yes' : null)
        );

        $result = $this->pulse($resolver)->forDeals(collect([$a, $b]));

        $this->assertSame(['met' => 2, 'total' => 2], $result[$a->id]['conditions']);
        $this->assertSame(['met' => 1, 'total' => 2], $result[$b->id]['conditions']);
    }

    public function test_a_deal_in_the_last_stage_or_with_no_requirements_has_none(): void
    {
        [$first, $second] = $this->pipeline();
        $inLast = $this->deal($second, 'Last stage');
        $inFirst = $this->deal($first, 'No rules');
        $this->moveAutomation($first, ['deal.expose_sent']);

        $resolver = Mockery::mock(FieldResolverService::class);
        $resolver->shouldReceive('resolve')->andReturn('yes');

        $result = $this->pulse($resolver)->forDeals(collect([$inLast, $inFirst]));

        $this->assertSame(['met' => 0, 'total' => 0], $result[$inLast->id]['conditions']);
        $this->assertSame(['met' => 0, 'total' => 0], $result[$inFirst->id]['conditions']);
    }

    public function test_an_inactive_automation_sets_no_requirements(): void
    {
        [$first, $second] = $this->pipeline();
        $deal = $this->deal($first, 'Deal');
        $this->moveAutomation($second, ['deal.expose_sent'], active: false);

        $result = $this->pulse(Mockery::mock(FieldResolverService::class))->forDeals(collect([$deal]));

        $this->assertSame(['met' => 0, 'total' => 0], $result[$deal->id]['conditions']);
    }

    public function test_last_activity_is_the_newest_event_on_that_deal_only(): void
    {
        [$first] = $this->pipeline();
        $a = $this->deal($first, 'A');
        $b = $this->deal($first, 'B');
        $c = $this->deal($first, 'C');

        $this->event(Deal::class, $a->id, '2026-11-01 09:00:00');
        $this->event(Deal::class, $a->id, '2026-11-08 12:30:00');
        $this->event(Deal::class, $b->id, '2026-10-20 08:00:00');
        $this->event('App\\Models\\Lead', $c->id, '2026-11-09 08:00:00');

        $result = $this->pulse(Mockery::mock(FieldResolverService::class))->forDeals(collect([$a, $b, $c]));

        $this->assertStringStartsWith('2026-11-08T12:30:00', $result[$a->id]['last_activity_at']);
        $this->assertStringStartsWith('2026-10-20T08:00:00', $result[$b->id]['last_activity_at']);
        $this->assertNull($result[$c->id]['last_activity_at']);
    }

    private function pulse(?FieldResolverService $resolver = null): DealPulse
    {
        return new DealPulse($resolver ?? Mockery::mock(FieldResolverService::class), new ConditionEvaluatorService);
    }

    /** @return array{0: PipelineStage, 1: PipelineStage} */
    private function pipeline(): array
    {
        // Plain inserts: the models' observers expect a signed-in user.
        DB::table('lead_pipelines')->insert(['id' => 1, 'name' => 'Sales', 'priority' => 1]);
        DB::table('pipeline_stages')->insert([
            ['id' => 1, 'lead_pipeline_id' => 1, 'name' => 'Initial', 'priority' => 1],
            ['id' => 2, 'lead_pipeline_id' => 1, 'name' => 'Presentation', 'priority' => 2],
        ]);

        return [PipelineStage::query()->find(1), PipelineStage::query()->find(2)];
    }

    private function deal(PipelineStage $stage, string $name): Deal
    {
        $id = DB::table('deals')->insertGetId([
            'name' => $name,
            'value' => 1000,
            'lead_pipeline_id' => $stage->lead_pipeline_id,
            'pipeline_stage_id' => $stage->id,
        ]);

        return Deal::query()->find($id);
    }

    /** An automation that moves a deal to $target once every field exists. */
    private function moveAutomation(PipelineStage $target, array $fields, bool $active = true): void
    {
        $id = DB::table('deal_automations')->insertGetId([
            'name' => 'Move on',
            'pipeline_id' => $target->lead_pipeline_id,
            'subject_type' => DealAutomation::SUBJECT_DEAL,
            'active' => $active,
            'priority' => 1,
        ]);
        foreach ($fields as $field) {
            DB::table('deal_automation_conditions')->insert(['deal_automation_id' => $id, 'field' => $field, 'operator' => 'exists']);
        }
        DB::table('deal_automation_actions')->insert(['deal_automation_id' => $id, 'action_type' => 'stage_transition', 'target_stage_id' => $target->id]);
    }

    private function event(string $type, int $id, string $at): void
    {
        DB::table('crm_events')->insert([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'model_type' => $type,
            'model_id' => $id,
            'occurred_at' => $at,
            'created_at' => $at,
            'updated_at' => $at,
        ]);
    }
}
