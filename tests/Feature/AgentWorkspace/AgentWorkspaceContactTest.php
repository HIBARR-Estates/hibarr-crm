<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\LeadContactController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * People › contact page: /agent/people/{lead} renders the agent contact page
 * from the lead page's own props and access checks, minus the props only
 * the classic lead page's tabs read.
 */
class AgentWorkspaceContactTest extends TestCase
{
    public function test_the_route_is_registered_behind_the_workspace_gate(): void
    {
        $this->assertTrue(Route::has('agent.people.show'));
        $this->assertStringEndsWith('/agent/people/42', route('agent.people.show', 42, false));

        $route = Route::getRoutes()->getByName('agent.people.show');
        $this->assertSame(LeadContactController::class.'@agentShow', $route->getActionName());
        $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
        $this->assertContains('auth', $route->gatherMiddleware());
    }

    public function test_the_route_only_takes_a_numeric_lead_id(): void
    {
        $route = Route::getRoutes()->getByName('agent.people.show');

        $this->assertTrue($route->matches(Request::create('/agent/people/42')));
        $this->assertFalse($route->matches(Request::create('/agent/people/abc')));
    }

    public function test_the_agent_page_drops_the_classic_only_props(): void
    {
        $page = $this->visit('agentShow', $this->props());

        $this->assertSame('AgentWorkspace/Contact', $page['component']);
        foreach (LeadContactController::AGENT_CONTACT_UNUSED_PROPS as $key) {
            $this->assertArrayNotHasKey($key, $page['props']);
        }
        $this->assertSame(['id' => 7], $page['props']['lead']);
        $this->assertSame('tr', $page['props']['statuses']);
    }

    public function test_the_classic_lead_page_keeps_every_prop(): void
    {
        $page = $this->visit('show', $this->props());

        $this->assertSame('Leads/Show', $page['component']);
        foreach (array_keys($this->props()) as $key) {
            $this->assertArrayHasKey($key, $page['props']);
        }
    }

    public function test_a_redirect_without_access_passes_through(): void
    {
        $redirect = new RedirectResponse('/agent/today');
        $controller = $this->controller($redirect);

        $this->assertSame($redirect, $controller->agentShow(7, Request::create('/agent/people/7')));
        $this->assertSame($redirect, $controller->show(7, Request::create('/account/leads/7')));
    }

    /** @return array<string, mixed> */
    private function props(): array
    {
        $props = ['lead' => ['id' => 7], 'statuses' => 'tr'];
        foreach (LeadContactController::AGENT_CONTACT_UNUSED_PROPS as $key) {
            $props[$key] = 'classic-only';
        }

        return $props;
    }

    /**
     * A controller whose showProps returns the given props (or redirect),
     * so the test reads what agentShow/show do with them.
     *
     * @param  array<string, mixed>|RedirectResponse  $result
     */
    private function controller(array|RedirectResponse $result): LeadContactController
    {
        $controller = new class extends LeadContactController
        {
            /** @var array<string, mixed>|RedirectResponse */
            public array|RedirectResponse $fake = [];

            public function __construct() {}

            protected function showProps($id, Request $request): array|RedirectResponse
            {
                return $this->fake;
            }
        };
        $controller->fake = $result;

        return $controller;
    }

    /**
     * @param  array<string, mixed>  $props
     * @return array<string, mixed> The Inertia page object.
     */
    private function visit(string $method, array $props): array
    {
        $request = Request::create('/agent/people/7');
        $request->headers->set('X-Inertia', 'true');
        $this->app->instance('request', $request);

        return $this->controller($props)->{$method}(7, $request)->toResponse($request)->getData(true);
    }
}
