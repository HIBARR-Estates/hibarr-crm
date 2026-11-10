<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\AgentWorkspace\AgentWorkspaceController;
use App\Models\Company;
use App\Models\User;
use App\Services\Dashboard\DashboardMetricsService;
use Carbon\CarbonInterface;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Mockery\MockInterface;
use ReflectionClass;
use Tests\TestCase;

/**
 * Today › My work: what the first paint carries, and that each deferred
 * group asks the metrics service only for its own data.
 */
class AgentWorkspaceTodayTest extends TestCase
{
    private const USER = 10;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        foreach (['taskboard_columns', 'task_category'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::create('taskboard_columns', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('column_name');
            $table->string('slug');
            $table->string('label_color')->nullable();
            $table->integer('priority')->default(0);
        });
        Schema::create('task_category', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('category_name');
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
        });
        DB::table('taskboard_columns')->insert(['id' => 1, 'column_name' => 'To Do', 'slug' => 'to_do', 'priority' => 1]);
        DB::table('task_category')->insert(['id' => 1, 'category_name' => 'Call', 'added_by' => self::USER]);

        $user = Mockery::mock(User::class)->makePartial();
        $user->setRawAttributes(['id' => self::USER, 'company_id' => 1, 'name' => 'Selin Kaya']);
        $user->shouldReceive('permission')->andReturn(false);

        $company = new Company;
        $company->setRawAttributes(['id' => 1, 'timezone' => 'Asia/Tokyo']);

        session(['user' => $user, 'company' => $company, 'user_roles' => ['employee']]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        foreach (['taskboard_columns', 'task_category'] as $table) {
            Schema::dropIfExists($table);
        }
        parent::tearDown();
    }

    public function test_the_first_paint_carries_no_panel_data_and_names_three_groups(): void
    {
        $metrics = Mockery::mock(DashboardMetricsService::class);
        $metrics->shouldNotReceive('personalQueue', 'personalStats', 'commissionSummary', 'openDealsByPipeline', 'meetingsBetween', 'personalTasksBetween');

        $page = $this->visit($metrics);

        $this->assertSame('AgentWorkspace/Today', $page['component']);
        $this->assertSame('Selin Kaya', $page['props']['userName']);
        $this->assertSame(self::USER, $page['props']['userId']);
        foreach (['queue', 'taskBoardColumns', 'taskCategories', 'stats', 'commission', 'openDeals', 'schedule'] as $key) {
            $this->assertArrayNotHasKey($key, $page['props']);
        }
        $this->assertSame(
            [
                'queue' => ['queue', 'taskBoardColumns', 'taskCategories'],
                'stats' => ['stats', 'commission', 'openDeals'],
                'schedule' => ['schedule'],
            ],
            $page['deferredProps']
        );
    }

    public function test_the_queue_group_only_reads_the_queue(): void
    {
        $metrics = Mockery::mock(DashboardMetricsService::class, function (MockInterface $mock) {
            $mock->shouldReceive('personalQueue')->once()->with(self::USER)->andReturn(['tasks' => [], 'counts' => [], 'uncovered' => []]);
            $mock->shouldNotReceive('personalStats', 'commissionSummary', 'openDealsByPipeline', 'meetingsBetween', 'personalTasksBetween');
        });

        $page = $this->visit($metrics, 'queue,taskBoardColumns,taskCategories');

        $this->assertSame(['tasks' => [], 'counts' => [], 'uncovered' => []], $page['props']['queue']);
        $this->assertSame(['to_do'], array_column($page['props']['taskBoardColumns'], 'slug'));
        $this->assertSame(['Call'], array_column($page['props']['taskCategories'], 'category_name'));
    }

    public function test_the_schedule_covers_the_viewers_own_day(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-10 20:00:00', 'UTC')); // already the 11th in Tokyo

        $windows = [];
        $metrics = Mockery::mock(DashboardMetricsService::class, function (MockInterface $mock) use (&$windows) {
            $capture = function (string $name, array $result) use (&$windows) {
                return function (int $userId, CarbonInterface $from, CarbonInterface $to) use (&$windows, $name, $result) {
                    $windows[$name] = [$from->toIso8601String(), $to->toIso8601String()];

                    return $result;
                };
            };
            $mock->shouldReceive('meetingsBetween')->once()->andReturnUsing($capture('meetings', [['id' => 1]]));
            $mock->shouldReceive('personalTasksBetween')->once()->andReturnUsing($capture('tasks', [['id' => 2]]));
            $mock->shouldNotReceive('personalQueue', 'personalStats', 'commissionSummary', 'openDealsByPipeline');
        });

        $page = $this->visit($metrics, 'schedule');

        $this->assertSame(['meetings' => [['id' => 1]], 'tasks' => [['id' => 2]]], $page['props']['schedule']);
        $tokyoDay = ['2026-11-11T00:00:00+09:00', '2026-11-11T23:59:59+09:00'];
        $this->assertSame($tokyoDay, $windows['meetings']);
        $this->assertSame($tokyoDay, $windows['tasks']);

        Carbon::setTestNow();
    }

    public function test_the_stats_group_reads_stats_commission_and_open_deals(): void
    {
        $metrics = Mockery::mock(DashboardMetricsService::class, function (MockInterface $mock) {
            $mock->shouldReceive('personalStats')->once()->with(self::USER)->andReturn(['leads' => ['new' => 3]]);
            $mock->shouldReceive('commissionSummary')->once()->with(self::USER)->andReturnNull();
            $mock->shouldReceive('openDealsByPipeline')->once()->with(self::USER)->andReturn([]);
            $mock->shouldNotReceive('personalQueue', 'meetingsBetween', 'personalTasksBetween');
        });

        $page = $this->visit($metrics, 'stats,commission,openDeals');

        $this->assertSame(3, $page['props']['stats']['leads']['new']);
        $this->assertNull($page['props']['commission']);
        $this->assertSame([], $page['props']['openDeals']);
    }

    /** @return array<string, mixed> The Inertia page object. */
    private function visit(DashboardMetricsService $metrics, ?string $partial = null): array
    {
        $controller = (new ReflectionClass(AgentWorkspaceController::class))->newInstanceWithoutConstructor();
        $request = Request::create('/agent/today');
        $request->headers->set('X-Inertia', 'true');
        if ($partial !== null) {
            $request->headers->set('X-Inertia-Partial-Component', 'AgentWorkspace/Today');
            $request->headers->set('X-Inertia-Partial-Data', $partial);
        }
        $this->app->instance('request', $request);

        return $controller->today($metrics)->toResponse($request)->getData(true);
    }
}
