<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\TaskController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use App\Models\User;
use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Tasks: the agent workspace's list at /agent/tasks. It runs on the Tasks
 * index's own permission check and filters, so what is checked here is the
 * wiring, the scope rules and that the rows are not part of the first paint.
 */
class AgentWorkspaceTasksTest extends TestCase
{
    protected function tearDown(): void
    {
        session()->forget('user');
        parent::tearDown();
    }

    public function test_the_page_is_registered_behind_the_workspace_gate(): void
    {
        $this->assertTrue(Route::has('agent.tasks'));
        $this->assertStringEndsWith('/agent/tasks', route('agent.tasks', [], false));

        $route = Route::getRoutes()->getByName('agent.tasks');
        $this->assertSame(TaskController::class.'@agentIndex', $route->getActionName());
        $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
        $this->assertContains('auth', $route->gatherMiddleware());
    }

    public function test_a_task_can_be_fetched_by_id_for_the_people_preview(): void
    {
        $route = Route::getRoutes()->getByName('agent.tasks.show');

        $this->assertSame(TaskController::class.'@agentShow', $route->getActionName());
        $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
        $this->assertTrue($route->matches(Request::create('/agent/tasks/42')));
        // The list page is not shadowed by it, and a non-numeric segment is not a task.
        $this->assertFalse($route->matches(Request::create('/agent/tasks')));
        $this->assertFalse($route->matches(Request::create('/agent/tasks/abc')));
    }

    public function test_the_dock_opens_tasks_on_the_agent_page(): void
    {
        $destinations = file_get_contents(base_path('resources/js/Components/Redesign/agent/destinations.ts'));

        $this->assertStringContainsString('segment: "tasks", href: "/agent/tasks"', $destinations);
    }

    public function test_someone_without_view_tasks_gets_a_403_not_a_redirect_back(): void
    {
        try {
            $this->visit('none', Request::create('/agent/tasks'));
            $this->fail('A denied request must abort.');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function test_the_team_scope_is_only_for_someone_who_sees_all_tasks(): void
    {
        $all = $this->visit('all', Request::create('/agent/tasks', 'GET', ['scope' => 'team']));
        $owned = $this->visit('owned', Request::create('/agent/tasks', 'GET', ['scope' => 'team']));

        $this->assertSame('AgentWorkspace/Tasks', $all['component']);
        $this->assertSame('team', $all['props']['scope']);
        $this->assertTrue($all['props']['canSeeTeam']);

        $this->assertSame('mine', $owned['props']['scope']);
        $this->assertFalse($owned['props']['canSeeTeam']);
    }

    public function test_an_unknown_scope_is_my_tasks_and_filters_are_echoed_back(): void
    {
        $page = $this->visit('all', Request::create('/agent/tasks', 'GET', ['scope' => 'nonsense', 'priority' => 'high', 'status' => 'done']));

        $this->assertSame('mine', $page['props']['scope']);
        $this->assertSame(5, $page['props']['userId']);
        $this->assertSame(TaskController::AGENT_TASKS_LIMIT, $page['props']['limit']);
        // Status is not a filter here: the page is the open tasks.
        $this->assertSame(['priority' => 'high'], $page['props']['filters']);
    }

    public function test_the_rows_and_lookups_follow_the_first_paint(): void
    {
        $page = $this->visit('all', Request::create('/agent/tasks'));

        foreach (['tasks', 'taskBoardColumns', 'taskCategories', 'users', 'projects'] as $deferred) {
            $this->assertArrayNotHasKey($deferred, $page['props'], "{$deferred} must not block the first paint");
        }
        $this->assertContains('tasks', $page['deferredProps']['tasks'] ?? []);
    }

    /**
     * @return array<string, mixed>
     */
    private function visit(string $level, Request $request): array
    {
        $user = new class extends User
        {
            public string $level = 'none';

            public function permission($permission)
            {
                return $permission === 'view_tasks' ? $this->level : false;
            }
        };
        $user->id = 5;
        $user->level = $level;
        session(['user' => $user]);

        $request->headers->set('X-Inertia', 'true');
        $this->app->instance('request', $request);

        $controller = new class extends TaskController
        {
            public function __construct() {}
        };

        return $controller->agentIndex($request, new DashboardMetricsService)->toResponse($request)->getData(true);
    }
}
