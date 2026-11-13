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

    public function test_browse_sends_a_light_shell_and_defers_the_cards_and_options(): void
    {
        $page = $this->visit('all', 'browse', Request::create('/agent/portfolio/browse', 'GET', ['city' => 'iskele', 'bogus' => 'x', 'max_price' => '350000']));

        $this->assertSame('AgentWorkspace/Portfolio', $page['component']);
        $this->assertSame('browse', $page['props']['view']);
        $this->assertSame(['city' => 'iskele', 'max_price' => '350000'], $page['props']['filters']);
        $this->assertSame(PortfolioController::BROWSE_STEP, $page['props']['limit']);

        foreach (['properties', 'options'] as $deferred) {
            $this->assertArrayNotHasKey($deferred, $page['props'], "{$deferred} must not block the first paint");
            $this->assertContains($deferred, $page['deferredProps'][$deferred] ?? []);
        }
    }

    public function test_show_more_is_capped(): void
    {
        $page = $this->visit('all', 'browse', Request::create('/agent/portfolio/browse', 'GET', ['limit' => '99999']));
        $this->assertSame(PortfolioController::BROWSE_CAP, $page['props']['limit']);

        $page = $this->visit('all', 'browse', Request::create('/agent/portfolio/browse', 'GET', ['limit' => '1']));
        $this->assertSame(PortfolioController::BROWSE_STEP, $page['props']['limit']);
    }

    public function test_projects_defer_their_cards(): void
    {
        $page = $this->visit('all', 'projects', Request::create('/agent/portfolio/projects'));

        $this->assertSame('projects', $page['props']['view']);
        $this->assertArrayNotHasKey('projects', $page['props']);
        $this->assertContains('projects', $page['deferredProps']['projects'] ?? []);
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
    private function visit(string $level, string $action, Request $request): array
    {
        $user = new class extends User
        {
            public string $level = 'none';

            public function permission($permission)
            {
                return $permission === 'view_products' ? $this->level : false;
            }
        };
        $user->id = 5;
        $user->level = $level;
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
