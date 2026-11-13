<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\LeadContactController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * People: the agent workspace's lead list at /agent/people. It runs on the
 * Leads list's own controller, so its query, scope and filters are the same
 * ones the classic list tests cover; what is checked here is the wiring.
 */
class AgentWorkspacePeopleTest extends TestCase
{
    public function test_the_list_is_registered_behind_the_workspace_gate(): void
    {
        $this->assertTrue(Route::has('agent.people'));
        $this->assertStringEndsWith('/agent/people', route('agent.people', [], false));

        $route = Route::getRoutes()->getByName('agent.people');
        $this->assertSame(LeadContactController::class.'@agentIndex', $route->getActionName());
        $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
        $this->assertContains('auth', $route->gatherMiddleware());
    }

    public function test_the_list_and_a_person_do_not_shadow_each_other(): void
    {
        $list = Route::getRoutes()->getByName('agent.people');
        $person = Route::getRoutes()->getByName('agent.people.show');

        $this->assertTrue($list->matches(Request::create('/agent/people')));
        $this->assertFalse($person->matches(Request::create('/agent/people')));
        $this->assertFalse($list->matches(Request::create('/agent/people/42')));
        $this->assertTrue($person->matches(Request::create('/agent/people/42')));
    }

    public function test_the_dock_opens_people_on_the_agent_list(): void
    {
        $destinations = file_get_contents(base_path('resources/js/Components/Redesign/agent/destinations.ts'));

        $this->assertStringContainsString('segment: "people", href: "/agent/people"', $destinations);
    }
}
