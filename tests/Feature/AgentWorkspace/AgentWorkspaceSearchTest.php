<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\AgentWorkspace\SearchController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use App\Services\AgentWorkspace\AgentSearch;
use App\Services\AgentWorkspace\ContactDeals;
use App\Services\LeadService;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Agent search: the dock dropdown (L7-23) and the results page (L7-24). The
 * sources keep their own visibility rules, so what is checked here is the
 * wiring and what a too-short or odd word does before any source is asked.
 */
class AgentWorkspaceSearchTest extends TestCase
{
    private function search(): AgentSearch
    {
        return new AgentSearch($this->createMock(LeadService::class), $this->createMock(ContactDeals::class));
    }

    public function test_the_page_and_the_dropdown_are_registered_behind_the_workspace_gate(): void
    {
        foreach (['search' => 'results', 'search.suggest' => 'suggest'] as $name => $action) {
            $route = Route::getRoutes()->getByName('agent.'.$name);

            $this->assertNotNull($route, "agent.{$name} is missing");
            $this->assertSame(SearchController::class.'@'.$action, $route->getActionName());
            $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
            $this->assertContains('auth', $route->gatherMiddleware());
        }

        $this->assertContains('throttle:60,1', Route::getRoutes()->getByName('agent.search.suggest')->gatherMiddleware());
        $this->assertStringEndsWith('/agent/search?q=M%C3%BCl', route('agent.search', ['q' => 'Mül'], false));
    }

    public function test_the_word_is_trimmed_collapsed_and_cut(): void
    {
        $this->assertSame('Claudia Müller', AgentSearch::clean("  Claudia \n  Müller  "));
        $this->assertSame('', AgentSearch::clean(null));
        $this->assertSame('', AgentSearch::clean(['a']));
        $this->assertSame(AgentSearch::MAX_LENGTH, mb_strlen(AgentSearch::clean(str_repeat('ab', 200))));
    }

    public function test_a_word_shorter_than_two_letters_asks_no_source(): void
    {
        $result = $this->search()->search('M', 3);

        $this->assertSame(0, $result['total']);
        $this->assertSame(array_fill_keys(AgentSearch::GROUPS, 0), $result['counts']);
        foreach (AgentSearch::GROUPS as $group) {
            $this->assertSame([], $result['groups'][$group]);
        }
    }

    public function test_the_groups_are_the_six_the_boards_name(): void
    {
        $this->assertSame(['people', 'deals', 'properties', 'tasks', 'meetings', 'notes'], AgentSearch::GROUPS);
    }

    public function test_the_dock_opens_the_search_on_the_results_page(): void
    {
        $dock = file_get_contents(base_path('resources/js/Components/Redesign/agent/AgentDockSearch.tsx'));

        $this->assertStringContainsString('agent.search', $dock);
        $this->assertStringNotContainsString('lead-contact.index', $dock);
    }
}
