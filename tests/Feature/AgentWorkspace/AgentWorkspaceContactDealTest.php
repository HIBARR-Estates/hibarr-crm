<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\DealController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use App\Models\User;
use App\Services\AgentWorkspace\ContactDeals;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * People › contact page in a deal's state: /agent/people/{lead}/deals/{deal}
 * renders from the deal page's own props and access check, and
 * /agent/deals/{deal} sends a bare deal id to its person's page.
 *
 * Like the other agent workspace tests, the schema is hand-built in memory
 * with only the columns these queries read.
 */
class AgentWorkspaceContactDealTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('deals');
        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('outcome_status')->nullable();
            $table->timestamps();
        });
        DB::table('deals')->insert([
            ['id' => 31, 'name' => 'Iskele apartment', 'lead_id' => 7],
            ['id' => 40, 'name' => 'No contact', 'lead_id' => null],
        ]);

        session(['user' => new User]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('deals');
        parent::tearDown();
    }

    public function test_the_routes_are_registered_behind_the_workspace_gate(): void
    {
        $this->assertStringEndsWith('/agent/people/7/deals/31', route('agent.people.deal', ['lead' => 7, 'deal' => 31], false));
        $this->assertStringEndsWith('/agent/deals/31', route('agent.deals.show', 31, false));

        foreach (['agent.people.deal' => 'agentShow', 'agent.deals.show' => 'agentOpen'] as $name => $method) {
            $route = Route::getRoutes()->getByName($name);
            $this->assertSame(DealController::class.'@'.$method, $route->getActionName());
            $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
            $this->assertContains('auth', $route->gatherMiddleware());
        }
    }

    public function test_the_routes_only_take_numeric_ids(): void
    {
        $deal = Route::getRoutes()->getByName('agent.people.deal');
        $this->assertTrue($deal->matches(Request::create('/agent/people/7/deals/31')));
        $this->assertFalse($deal->matches(Request::create('/agent/people/7/deals/abc')));
        $this->assertFalse($deal->matches(Request::create('/agent/people/abc/deals/31')));

        $open = Route::getRoutes()->getByName('agent.deals.show');
        $this->assertTrue($open->matches(Request::create('/agent/deals/31')));
        $this->assertFalse($open->matches(Request::create('/agent/deals/abc')));
    }

    public function test_the_agent_page_drops_the_classic_only_props_and_lists_the_persons_deals(): void
    {
        $page = $this->visit(fn (DealController $c) => $c->agentShow(7, 31, $this->deals([['id' => 31]])));

        $this->assertSame('AgentWorkspace/ContactDeal', $page['component']);
        foreach (DealController::AGENT_CONTACT_UNUSED_PROPS as $key) {
            $this->assertArrayNotHasKey($key, $page['props']);
        }
        $this->assertSame(['id' => 31], $page['props']['deal']);
        $this->assertSame([['id' => 31]], $page['props']['contactDeals']);
    }

    public function test_the_classic_deal_page_keeps_every_prop(): void
    {
        $page = $this->visit(fn (DealController $c) => $c->show(31));

        $this->assertSame('Deals/Show', $page['component']);
        foreach (array_keys($this->props()) as $key) {
            $this->assertArrayHasKey($key, $page['props']);
        }
        $this->assertArrayNotHasKey('contactDeals', $page['props']);
    }

    public function test_a_deal_of_another_person_is_not_found(): void
    {
        foreach ([[8, 31], [7, 40], [7, 999]] as [$lead, $deal]) {
            try {
                $this->controller($this->props())->agentShow($lead, $deal, $this->deals([]));
                $this->fail("Expected a 404 for person {$lead}, deal {$deal}.");
            } catch (HttpException $e) {
                $this->assertSame(404, $e->getStatusCode());
            }
        }
    }

    public function test_a_redirect_without_access_passes_through(): void
    {
        $redirect = new RedirectResponse('/agent/today');

        $this->assertSame($redirect, $this->controller($redirect)->agentShow(7, 31, $this->deals([])));
    }

    public function test_a_bare_deal_id_opens_on_its_persons_page(): void
    {
        $controller = $this->controller([]);

        $this->assertStringEndsWith('/agent/people/7/deals/31', $controller->agentOpen(31)->getTargetUrl());
        // A deal with no person has no contact page: it opens the deal page.
        $this->assertSame(route('deals.show', 40), $controller->agentOpen(40)->getTargetUrl());

        try {
            $controller->agentOpen(999);
            $this->fail('Expected a 404 for a missing deal.');
        } catch (HttpException $e) {
            $this->assertSame(404, $e->getStatusCode());
        }
    }

    /** @return array<string, mixed> */
    private function props(): array
    {
        $props = ['deal' => ['id' => 31], 'pageTitle' => 'Deal'];
        foreach (DealController::AGENT_CONTACT_UNUSED_PROPS as $key) {
            $props[$key] = 'classic-only';
        }

        return $props;
    }

    /** @param  list<array<string, mixed>>  $deals */
    private function deals(array $deals): ContactDeals
    {
        $fake = new class extends ContactDeals
        {
            /** @var list<array<string, mixed>> */
            public array $deals = [];

            public function forLead(int $leadId, User $viewer): array
            {
                return $this->deals;
            }
        };
        $fake->deals = $deals;

        return $fake;
    }

    /**
     * A controller whose showProps returns the given props (or redirect).
     *
     * @param  array<string, mixed>|RedirectResponse  $result
     */
    private function controller(array|RedirectResponse $result): DealController
    {
        $controller = new class extends DealController
        {
            /** @var array<string, mixed>|RedirectResponse */
            public array|RedirectResponse $fake = [];

            public function __construct() {}

            protected function showProps($id): array|RedirectResponse
            {
                return $this->fake;
            }
        };
        $controller->fake = $result;

        return $controller;
    }

    /**
     * @param  callable(DealController): mixed  $call
     * @return array<string, mixed> The Inertia page object.
     */
    private function visit(callable $call): array
    {
        $request = Request::create('/agent/people/7/deals/31');
        $request->headers->set('X-Inertia', 'true');
        $this->app->instance('request', $request);

        return $call($this->controller($this->props()))->toResponse($request)->getData(true);
    }
}
