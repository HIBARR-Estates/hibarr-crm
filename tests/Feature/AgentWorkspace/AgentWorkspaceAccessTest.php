<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\AgentWorkspace\AgentWorkspaceAccessController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use App\Models\User;
use App\Support\AgentWorkspaceAccess;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Mockery;
use ReflectionClass;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * Who gets the agent workspace at /agent, and the admin list that overrides
 * the lead-agent default. Like the Company dashboard access tests, the
 * schema is built in memory and the app's user()/company()/user_roles()
 * helpers are driven through the session.
 */
class AgentWorkspaceAccessTest extends TestCase
{
    use SetsFeatureFlags;

    private const ADMIN = 1;

    private const AGENT = 2;

    private const COLLEAGUE = 3;

    private const DISABLED_AGENT = 4;

    private const PARTNER_AGENT = 5;

    private const OTHER_COMPANY = 6;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        foreach (['agent_workspace_access', 'lead_agents', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('image')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->string('status')->default('enabled');
            $table->boolean('is_partner')->default(false);
            $table->timestamps();
        });

        Schema::create('agent_workspace_access', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('user_id');
            $table->string('access', 10);
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
            $table->unique(['company_id', 'user_id']);
        });

        DB::table('users')->insert([
            ['id' => self::ADMIN, 'company_id' => 1, 'name' => 'Admin', 'email' => 'admin@one.test'],
            ['id' => self::AGENT, 'company_id' => 1, 'name' => 'Agent', 'email' => 'agent@one.test'],
            ['id' => self::COLLEAGUE, 'company_id' => 1, 'name' => 'Colleague', 'email' => 'colleague@one.test'],
            ['id' => self::DISABLED_AGENT, 'company_id' => 1, 'name' => 'Disabled agent', 'email' => 'off@one.test'],
            ['id' => self::PARTNER_AGENT, 'company_id' => 1, 'name' => 'Partner agent', 'email' => 'partner@one.test'],
            ['id' => self::OTHER_COMPANY, 'company_id' => 2, 'name' => 'Other company', 'email' => 'someone@two.test'],
        ]);

        DB::table('lead_agents')->insert([
            ['company_id' => 1, 'user_id' => self::AGENT, 'status' => 'enabled', 'is_partner' => false],
            ['company_id' => 1, 'user_id' => self::DISABLED_AGENT, 'status' => 'disabled', 'is_partner' => false],
            ['company_id' => 1, 'user_id' => self::PARTNER_AGENT, 'status' => 'enabled', 'is_partner' => true],
        ]);

        $this->setFeatureFlag(AgentWorkspaceAccess::FLAG, true);
        $this->signInAs(self::ADMIN, ['admin', 'employee']);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        foreach (['agent_workspace_access', 'lead_agents', 'users'] as $table) {
            Schema::dropIfExists($table);
        }
        parent::tearDown();
    }

    /** @param list<string> $roles */
    private function user(int $id, array $roles = ['employee']): User
    {
        $user = new User;
        $user->setRawAttributes((array) DB::table('users')->where('id', $id)->first(), true);
        $user->exists = true;
        $user->setRelation('roles', collect(array_map(fn (string $name) => (object) ['name' => $name], $roles)));

        return $user;
    }

    /** @param list<string> $roles */
    private function signInAs(int $userId, array $roles): void
    {
        $user = Mockery::mock(User::class)->makePartial();
        $user->setRawAttributes((array) DB::table('users')->where('id', $userId)->first());
        $user->shouldReceive('permission')->andReturn(false);

        session([
            'user' => $user,
            'company' => (object) ['id' => (int) $user->company_id],
            'user_roles' => $roles,
        ]);
    }

    private function allows(int $userId, array $roles = ['employee']): bool
    {
        // Each check is its own request, so nothing is answered from the request cache.
        $this->app->instance('request', Request::create('/agent/today'));

        return AgentWorkspaceAccess::allows($this->user($userId, $roles));
    }

    private function override(int $userId, string $access): void
    {
        DB::table('agent_workspace_access')->insert(['company_id' => 1, 'user_id' => $userId, 'access' => $access]);
    }

    private function controller(): AgentWorkspaceAccessController
    {
        return (new ReflectionClass(AgentWorkspaceAccessController::class))->newInstanceWithoutConstructor();
    }

    public function test_flag_is_known(): void
    {
        $this->assertContains(AgentWorkspaceAccess::FLAG, config('features.known_flags'));
    }

    public function test_the_workspace_lives_at_agent_behind_auth_and_the_access_check(): void
    {
        $this->assertSame('/agent/today', route('agent.today', [], false));

        $middleware = app('router')->getRoutes()->getByName('agent.today')->gatherMiddleware();
        $this->assertContains('auth', $middleware);
        $this->assertContains('partner.restrict', $middleware);
        $this->assertContains(EnsureAgentWorkspaceAccess::class, $middleware);
    }

    public function test_nobody_gets_in_while_the_flag_is_off(): void
    {
        $this->setFeatureFlag(AgentWorkspaceAccess::FLAG, false);
        $this->override(self::COLLEAGUE, 'allow');

        $this->assertFalse($this->allows(self::AGENT));
        $this->assertFalse($this->allows(self::COLLEAGUE));
    }

    public function test_enabled_lead_agents_get_in_by_default(): void
    {
        $this->assertTrue($this->allows(self::AGENT));
    }

    public function test_disabled_and_partner_lead_agents_and_other_staff_do_not(): void
    {
        $this->assertFalse($this->allows(self::DISABLED_AGENT));
        $this->assertFalse($this->allows(self::PARTNER_AGENT));
        $this->assertFalse($this->allows(self::COLLEAGUE));
        $this->assertFalse($this->allows(self::ADMIN, ['admin', 'employee']));
    }

    public function test_an_allow_entry_lets_someone_in_who_is_not_a_lead_agent(): void
    {
        $this->override(self::COLLEAGUE, 'allow');

        $this->assertTrue($this->allows(self::COLLEAGUE));
    }

    public function test_a_block_entry_keeps_a_lead_agent_out(): void
    {
        $this->override(self::AGENT, 'block');

        $this->assertFalse($this->allows(self::AGENT));
    }

    public function test_partner_only_accounts_never_get_in_even_when_allowed(): void
    {
        $this->override(self::COLLEAGUE, 'allow');

        $this->assertFalse($this->allows(self::COLLEAGUE, ['partner', 'employee']));
    }

    public function test_an_entry_in_another_company_does_not_count(): void
    {
        DB::table('agent_workspace_access')->insert(['company_id' => 2, 'user_id' => self::AGENT, 'access' => 'block']);

        $this->assertTrue($this->allows(self::AGENT));
    }

    public function test_a_lead_agent_row_from_another_company_does_not_count(): void
    {
        DB::table('lead_agents')->insert(['company_id' => 2, 'user_id' => self::COLLEAGUE, 'status' => 'enabled', 'is_partner' => false]);

        $this->assertFalse($this->allows(self::COLLEAGUE));
    }

    public function test_the_middleware_answers_404_without_access(): void
    {
        $request = Request::create('/agent/today');
        $request->setUserResolver(fn () => $this->user(self::COLLEAGUE));

        $this->expectException(NotFoundHttpException::class);
        (new EnsureAgentWorkspaceAccess)->handle($request, fn () => response('ok'));
    }

    public function test_the_middleware_lets_a_lead_agent_through(): void
    {
        $request = Request::create('/agent/today');
        $request->setUserResolver(fn () => $this->user(self::AGENT));

        $response = (new EnsureAgentWorkspaceAccess)->handle($request, fn () => response('ok'));

        $this->assertSame('ok', $response->getContent());
    }

    public function test_only_admins_manage_the_list_and_only_while_the_flag_is_on(): void
    {
        AgentWorkspaceAccessController::ensureAllowed();

        $this->signInAs(self::AGENT, ['employee']);
        try {
            AgentWorkspaceAccessController::ensureAllowed();
            $this->fail('A non-admin managed the list.');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }

        $this->signInAs(self::ADMIN, ['admin', 'employee']);
        $this->setFeatureFlag(AgentWorkspaceAccess::FLAG, false);
        $this->expectException(NotFoundHttpException::class);
        AgentWorkspaceAccessController::ensureAllowed();
    }

    public function test_setting_access_twice_keeps_one_row_with_the_latest_choice(): void
    {
        $this->controller()->store(Request::create('/', 'POST', ['user_id' => self::COLLEAGUE, 'access' => 'allow']));
        $response = $this->controller()->store(Request::create('/', 'POST', ['user_id' => self::COLLEAGUE, 'access' => 'block']));

        $rows = DB::table('agent_workspace_access')->where('user_id', self::COLLEAGUE)->get();
        $this->assertCount(1, $rows);
        $this->assertSame('block', $rows[0]->access);
        $this->assertSame(self::ADMIN, (int) $rows[0]->added_by);
        $this->assertSame([self::COLLEAGUE], array_column($response['entries'], 'user_id'));
        $this->assertFalse($response['entries'][0]['lead_agent']);
    }

    public function test_access_must_be_allow_or_block(): void
    {
        $this->expectException(ValidationException::class);

        $this->controller()->store(Request::create('/', 'POST', ['user_id' => self::COLLEAGUE, 'access' => 'maybe']));
    }

    public function test_someone_from_another_company_cannot_be_added(): void
    {
        $this->expectException(ValidationException::class);

        try {
            $this->controller()->store(Request::create('/', 'POST', ['user_id' => self::OTHER_COMPANY, 'access' => 'allow']));
        } finally {
            $this->assertSame(0, DB::table('agent_workspace_access')->count());
        }
    }

    public function test_removing_only_touches_this_companys_list(): void
    {
        DB::table('agent_workspace_access')->insert([
            ['company_id' => 1, 'user_id' => self::AGENT, 'access' => 'block'],
            ['company_id' => 2, 'user_id' => self::AGENT, 'access' => 'block'],
        ]);

        $response = $this->controller()->destroy(self::AGENT);

        $this->assertSame(0, DB::table('agent_workspace_access')->where('company_id', 1)->count());
        $this->assertSame(1, DB::table('agent_workspace_access')->where('company_id', 2)->count());
        $this->assertSame([], $response['entries']);
    }
}
