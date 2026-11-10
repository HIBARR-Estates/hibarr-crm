<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\AgentWorkspace\AgentWorkspaceController;
use App\Models\Company;
use App\Models\User;
use App\Services\Dashboard\DashboardMetricsService;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Mockery;
use Mockery\MockInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionClass;
use Tests\TestCase;

/**
 * Today › Agenda: the JSON range endpoint behind the list, week and month
 * views. It reads the viewer's own days, caps the range, and asks the
 * metrics service for nothing but meetings and tasks.
 */
class AgentWorkspaceAgendaTest extends TestCase
{
    private const USER = 10;

    protected function setUp(): void
    {
        parent::setUp();

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
        parent::tearDown();
    }

    public function test_the_route_is_registered(): void
    {
        $this->assertTrue(Route::has('agent.today.agenda'));
        $this->assertStringEndsWith('/agent/today/agenda', route('agent.today.agenda', [], false));
    }

    public function test_a_range_reads_meetings_and_tasks_over_the_viewers_own_days(): void
    {
        $calls = [];
        $metrics = Mockery::mock(DashboardMetricsService::class, function (MockInterface $mock) use (&$calls) {
            $capture = function (string $name, array $result) use (&$calls) {
                return function (int $userId, CarbonInterface $from, CarbonInterface $to, int $limit) use (&$calls, $name, $result) {
                    $calls[$name] = [$userId, $from->toIso8601String(), $to->toIso8601String(), $limit];

                    return $result;
                };
            };
            $mock->shouldReceive('meetingsBetween')->once()->andReturnUsing($capture('meetings', [['id' => 1]]));
            $mock->shouldReceive('personalTasksBetween')->once()->andReturnUsing($capture('tasks', [['id' => 2]]));
            $mock->shouldNotReceive('personalQueue', 'personalStats', 'commissionSummary', 'openDealsByPipeline');
        });

        $response = $this->agenda($metrics, ['from' => '2026-11-09', 'to' => '2026-11-15']);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(['meetings' => [['id' => 1]], 'tasks' => [['id' => 2]]], $response->getData(true));
        $tokyoWeek = [self::USER, '2026-11-09T00:00:00+09:00', '2026-11-15T23:59:59+09:00', 300];
        $this->assertSame($tokyoWeek, $calls['meetings']);
        $this->assertSame($tokyoWeek, $calls['tasks']);
    }

    public function test_a_whole_month_grid_is_allowed(): void
    {
        $metrics = Mockery::mock(DashboardMetricsService::class, function (MockInterface $mock) {
            $mock->shouldReceive('meetingsBetween')->once()->andReturn([]);
            $mock->shouldReceive('personalTasksBetween')->once()->andReturn([]);
        });

        // Six whole weeks, the most a month grid shows.
        $response = $this->agenda($metrics, ['from' => '2026-10-26', 'to' => '2026-12-06']);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_a_range_longer_than_six_weeks_is_refused_without_reading(): void
    {
        $metrics = Mockery::mock(DashboardMetricsService::class);
        $metrics->shouldNotReceive('meetingsBetween', 'personalTasksBetween');

        $response = $this->agenda($metrics, ['from' => '2026-10-26', 'to' => '2026-12-07']);

        $this->assertSame(422, $response->getStatusCode());
        $this->assertArrayHasKey('message', $response->getData(true));
    }

    /** @return array<string, array<string, string>> */
    public static function badRanges(): array
    {
        return [
            'missing from' => [['to' => '2026-11-15']],
            'missing to' => [['from' => '2026-11-09']],
            'not a day' => [['from' => '2026-11-09T10:00', 'to' => '2026-11-15']],
            'backwards' => [['from' => '2026-11-15', 'to' => '2026-11-09']],
        ];
    }

    /** @param  array<string, string>  $query */
    #[DataProvider('badRanges')]
    public function test_a_bad_range_fails_validation_without_reading(array $query): void
    {
        $metrics = Mockery::mock(DashboardMetricsService::class);
        $metrics->shouldNotReceive('meetingsBetween', 'personalTasksBetween');

        $this->expectException(ValidationException::class);
        $this->agenda($metrics, $query);
    }

    /** @param  array<string, string>  $query */
    private function agenda(DashboardMetricsService $metrics, array $query): JsonResponse
    {
        $controller = (new ReflectionClass(AgentWorkspaceController::class))->newInstanceWithoutConstructor();
        $request = Request::create('/agent/today/agenda', 'GET', $query);
        $this->app->instance('request', $request);

        return $controller->agenda($request, $metrics);
    }
}
