<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\LeadContactController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use App\Models\User;
use App\Services\AgentWorkspace\ContactDeals;
use App\Services\LeadService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;
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

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('lead_lifecycle_statuses');
        Schema::create('lead_lifecycle_statuses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable();
            $table->string('key');
            $table->string('label');
            $table->string('description')->nullable();
            $table->integer('sort_order')->default(0);
            $table->string('label_color')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('lead_lifecycle_statuses');
        session()->forget('user');

        parent::tearDown();
    }

    public function test_someone_without_view_lead_gets_a_403_not_a_redirect_back(): void
    {
        try {
            $this->visit('none', Request::create('/agent/people'));
            $this->fail('A denied request must abort.');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function test_the_default_view_follows_the_permission_scope(): void
    {
        $all = $this->visit('all', Request::create('/agent/people'));
        $owned = $this->visit('owned', Request::create('/agent/people'));

        $this->assertSame('AgentWorkspace/People', $all['component']);
        $this->assertSame('all', $all['props']['scope']);
        $this->assertSame('mine', $owned['props']['scope']);
        $this->assertSame(5, $owned['props']['userId']);
    }

    public function test_it_opens_sorted_by_next_action_and_clamps_the_page_size(): void
    {
        $service = $this->service();

        $this->visit('all', Request::create('/agent/people'), $service);
        $this->assertSame('next_action', $service->seen[0]->input('sort_by'));
        $this->assertSame('asc', $service->seen[0]->input('sort_direction'));
        $this->assertSame(25, $service->seen[0]->input('per_page'));

        $this->visit('all', Request::create('/agent/people', 'GET', ['per_page' => 5000, 'sort_direction' => 'desc']), $service);
        $this->assertSame(100, $service->seen[1]->input('per_page'));
        $this->assertSame('desc', $service->seen[1]->input('sort_direction'));

        $this->visit('all', Request::create('/agent/people', 'GET', ['per_page' => 1]), $service);
        $this->assertSame(10, $service->seen[2]->input('per_page'));
    }

    public function test_the_chip_counts_ignore_the_next_action_filter_and_the_page(): void
    {
        $service = $this->service();
        $request = Request::create('/agent/people', 'GET', ['next_action' => 'today', 'page' => 3, 'search' => 'anna']);

        $page = $this->visit('all', $request, $service, only: 'counts');

        $this->assertSame(['all' => 11, 'overdue' => 7, 'today' => 7, 'week' => 7, 'none' => 7], $page['props']['counts']);
        $this->assertNotEmpty($service->counted);
        foreach ($service->counted as $countRequest) {
            $this->assertNull($countRequest->input('next_action'));
            $this->assertNull($countRequest->input('page'));
            $this->assertSame('anna', $countRequest->input('search'));
        }
    }

    /**
     * A LeadService that records the requests it is given.
     */
    private function service(): LeadService
    {
        return new class extends LeadService
        {
            /** @var list<Request> */
            public array $seen = [];

            /** @var list<Request> */
            public array $counted = [];

            public function __construct() {}

            public function getPaginatedLeads(Request $request, $dataTable = null): LengthAwarePaginator
            {
                $this->seen[] = $request;

                return new LengthAwarePaginator([], 0, (int) $request->input('per_page', 25));
            }

            public function countMatching(Request $request): int
            {
                $this->counted[] = $request;

                return 11;
            }

            public function countNextActionBucket(Request $request, string $bucket): int
            {
                $this->counted[] = $request;

                return 7;
            }
        };
    }

    /**
     * Runs agentIndex as a user holding view_lead at the given level
     * ('none' for no permission) and returns the Inertia page object.
     *
     * @return array<string, mixed>
     */
    private function visit(string $level, Request $request, ?LeadService $service = null, ?string $only = null): array
    {
        $user = new class extends User
        {
            public string $level = 'none';

            public function permission($permission)
            {
                return $permission === 'view_lead' ? $this->level : false;
            }
        };
        $user->id = 5;
        $user->level = $level;
        session(['user' => $user]);

        $request->headers->set('X-Inertia', 'true');
        if ($only !== null) {
            $request->headers->set('X-Inertia-Partial-Component', 'AgentWorkspace/People');
            $request->headers->set('X-Inertia-Partial-Data', $only);
        }
        $this->app->instance('request', $request);

        $service ??= $this->service();
        $controller = new class($service) extends LeadContactController
        {
            public function __construct(LeadService $service)
            {
                $this->leadService = $service;
            }
        };

        return $controller->agentIndex($request, new ContactDeals)->toResponse($request)->getData(true);
    }
}
