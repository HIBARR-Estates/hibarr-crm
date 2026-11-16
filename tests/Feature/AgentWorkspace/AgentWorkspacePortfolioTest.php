<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\AgentWorkspace\PortfolioController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Property;
use App\Models\User;
use App\Services\AgentWorkspace\PortfolioPresenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Portfolio: the three listing views at /agent/portfolio. They run on the
 * Properties and Projects features' own data, so what is checked here is the
 * wiring, the access rule, that the cards stay out of the first paint and the
 * shapes the cards read.
 */
class AgentWorkspacePortfolioTest extends TestCase
{
    protected function tearDown(): void
    {
        session()->forget('user');
        parent::tearDown();
    }

    public function test_the_three_views_are_registered_behind_the_workspace_gate(): void
    {
        foreach (['portfolio' => 'forDeals', 'portfolio.browse' => 'browse', 'portfolio.projects' => 'projects'] as $name => $action) {
            $route = Route::getRoutes()->getByName('agent.'.$name);

            $this->assertNotNull($route, "agent.{$name} is missing");
            $this->assertSame(PortfolioController::class.'@'.$action, $route->getActionName());
            $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
            $this->assertContains('auth', $route->gatherMiddleware());
        }

        $this->assertStringEndsWith('/agent/portfolio/browse', route('agent.portfolio.browse', [], false));
    }

    public function test_the_dock_opens_portfolio_on_the_agent_page(): void
    {
        $destinations = file_get_contents(base_path('resources/js/Components/Redesign/agent/destinations.ts'));

        $this->assertStringContainsString('segment: "portfolio", href: "/agent/portfolio"', $destinations);
    }

    public function test_someone_who_cannot_view_properties_gets_a_403(): void
    {
        foreach (['forDeals', 'browse', 'projects'] as $action) {
            try {
                $this->visit('none', $action, Request::create('/agent/portfolio'));
                $this->fail("{$action} must abort without view access.");
            } catch (HttpException $e) {
                $this->assertSame(403, $e->getStatusCode());
            }
        }
    }

    public function test_a_property_manager_can_open_portfolio_without_view_product(): void
    {
        $page = $this->visit('none', 'browse', Request::create('/agent/portfolio/browse'), 'all');

        $this->assertSame('browse', $page['props']['view']);
    }

    public function test_browse_sends_a_light_shell_and_defers_the_cards_and_options(): void
    {
        $page = $this->visit('all', 'browse', Request::create('/agent/portfolio/browse', 'GET', ['city' => 'iskele', 'bogus' => 'x', 'max_price' => '350000']));

        $this->assertSame('AgentWorkspace/Portfolio', $page['component']);
        $this->assertSame('browse', $page['props']['view']);
        $this->assertSame(['city' => 'iskele', 'max_price' => '350000'], $page['props']['filters']);

        foreach (['properties', 'options'] as $deferred) {
            $this->assertArrayNotHasKey($deferred, $page['props'], "{$deferred} must not block the first paint");
            $this->assertContains($deferred, $page['deferredProps'][$deferred] ?? []);
        }
    }

    public function test_the_lists_are_paged_so_no_page_is_endless(): void
    {
        // Browse is four columns of four; Projects and the deals rail are smaller pages;
        // the matches are asked for in a number that pages out at six.
        $this->assertSame(16, PortfolioController::BROWSE_PAGE_SIZE);
        $this->assertSame(12, PortfolioController::PROJECTS_PAGE_SIZE);
        $this->assertSame(8, PortfolioController::DEALS_PAGE_SIZE);
        $this->assertSame(0, PortfolioController::RECOMMENDATION_LIMIT % 6);

        $controller = file_get_contents(base_path('app/Http/Controllers/AgentWorkspace/PortfolioController.php'));
        $this->assertStringContainsString("'deals_page'", $controller);
        $this->assertStringContainsString('min($lastPage, max(1, (int) $request->query(\'deals_page\', 1)))', $controller, 'a page past the end falls back to the last one');
        $this->assertStringContainsString('\'deal_id\' => (int) $deal->id', $controller, 'matches say which deal they are for');

        $view = file_get_contents(base_path('resources/js/Pages/AgentWorkspace/portfolio/ForDealsView.tsx'));
        $this->assertStringContainsString('MATCHES_PER_PAGE = 6', $view);
        $this->assertStringNotContainsString('deals.source', $view, 'the source note under the rail is gone');
    }

    public function test_projects_carry_the_search_and_filters_the_classic_projects_page_has(): void
    {
        $page = $this->visit('all', 'projects', Request::create('/agent/portfolio/projects', 'GET', ['search' => 'plage', 'developer_id' => '4', 'bogus' => 'x']));

        $this->assertSame(['search' => 'plage', 'developer_id' => '4'], $page['props']['filters']);
        foreach (['projects', 'options'] as $deferred) {
            $this->assertArrayNotHasKey($deferred, $page['props']);
            $this->assertContains($deferred, $page['deferredProps'][$deferred] ?? []);
        }
    }

    public function test_listings_use_the_same_buttons_as_the_other_agent_pages(): void
    {
        $dir = base_path('resources/js/Pages/AgentWorkspace/portfolio/');

        foreach (['PropertyCard.tsx', 'ForDealsView.tsx', 'ProjectsView.tsx'] as $file) {
            $this->assertStringNotContainsString('agent-pf__expose', file_get_contents($dir.$file), "{$file} must use the shared Button");
            $this->assertStringNotContainsString('agent-pf__chipbtn', file_get_contents($dir.$file), "{$file} must use the shared Button");
        }
    }

    public function test_locations_are_tidied_for_the_cards(): void
    {
        $this->assertSame('Long Beach', PortfolioPresenter::tidy('long_beach'));
        $this->assertSame('Iskele, Long Beach', PortfolioPresenter::tidy('iskele,  long-beach'));
        $this->assertNull(PortfolioPresenter::tidy('  _-  '));
        $this->assertNull(PortfolioPresenter::tidy(null));
    }

    public function test_a_property_card_carries_what_the_design_shows(): void
    {
        $property = new Property([
            'title' => 'La Plage · 2+1 sea view',
            'city' => 'iskele',
            'area' => 'Long Beach',
            'bedrooms' => 2,
            'living_area_sqm' => 86,
            'price' => json_encode(['amount' => 239000, 'currency' => 'EUR']),
            'construction_status' => 'under_construction',
        ]);
        $property->id = 7;

        $card = PortfolioPresenter::property($property);

        $this->assertSame(7, $card['id']);
        $this->assertSame('Long Beach', $card['area']);
        $this->assertSame(2, $card['bedrooms']);
        $this->assertSame(86.0, $card['size_sqm']);
        $this->assertSame(239000.0, $card['price']);
        $this->assertSame('EUR', $card['currency']);
        $this->assertNull($card['photo']);
    }

    public function test_a_projects_stock_is_quantity_minus_sold_and_zero_when_sold_out(): void
    {
        $project = new DeveloperProject(['name' => 'La Plage', 'currency' => 'EUR']);
        $project->id = 3;

        $open = new DeveloperProjectUnitType(['bedrooms' => 2, 'property_type' => 'apartment', 'quantity' => 32, 'total_sold' => 26]);
        $open->id = 1;
        $soldOut = new DeveloperProjectUnitType(['bedrooms' => 3, 'property_type' => 'villa', 'quantity' => 6, 'total_sold' => 4, 'is_sold_out' => true]);
        $soldOut->id = 2;
        $project->setRelation('unitTypes', collect([$open, $soldOut]));

        $card = PortfolioPresenter::project($project);

        $this->assertSame('EUR', $card['currency']);
        $this->assertSame(['available' => 6, 'total' => 32], ['available' => $card['unit_types'][0]['available'], 'total' => $card['unit_types'][0]['total']]);
        $this->assertSame(0, $card['unit_types'][1]['available']);
    }

    /**
     * @return array<string, mixed>
     */
    private function visit(string $level, string $action, Request $request, string|false $manageProperties = false): array
    {
        $user = new class extends User
        {
            public string $level = 'none';

            public string|false $manageProperties = false;

            public function permission($permission)
            {
                if ($permission === 'view_product') {
                    return $this->level;
                }

                if ($permission === 'manage_properties') {
                    return $this->manageProperties;
                }

                return false;
            }
        };
        $user->id = 5;
        $user->level = $level;
        $user->manageProperties = $manageProperties;
        session(['user' => $user]);

        $request->headers->set('X-Inertia', 'true');
        $this->app->instance('request', $request);

        $controller = new class extends PortfolioController
        {
            public function __construct() {}
        };

        return $controller->{$action}($request)->toResponse($request)->getData(true);
    }
}
