<?php

namespace Tests\Feature\Dashboard;

use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The manager view covers every enabled lead agent with an active account —
 * not the viewer's downline. Team is the hierarchy surface; this one is for
 * managers of agents.
 */
class ManagerViewScopeTest extends TestCase
{
    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_includes_every_enabled_agent_not_just_the_viewers_reports(): void
    {
        $this->agent(1, 10, parentId: null);
        $this->agent(2, 11, parentId: 1);
        // Sibling of the viewer's report — old scope dropped this.
        $this->agent(3, 12, parentId: null);

        $ids = $this->ids();

        $this->assertEqualsCanonicalizing([1, 2, 3], $ids);
    }

    public function test_does_not_require_the_viewer_to_be_an_agent(): void
    {
        $this->agent(1, 10);

        $this->assertSame([1], $this->ids());
    }

    public function test_excludes_disabled_agents(): void
    {
        $this->agent(1, 10, status: 'enabled');
        $this->agent(2, 11, status: 'disabled');

        $this->assertSame([1], $this->ids());
    }

    public function test_excludes_agents_whose_user_is_not_active(): void
    {
        $this->agent(1, 10, userStatus: 'active');
        $this->agent(2, 11, userStatus: 'deactive');

        $this->assertSame([1], $this->ids());
    }

    /** @return array<int, int> */
    private function ids(): array
    {
        return array_map('intval', app(DashboardMetricsService::class)->activeAgentIds());
    }

    private function agent(
        int $id,
        int $userId,
        ?int $parentId = null,
        string $status = 'enabled',
        string $userStatus = 'active'
    ): void {
        DB::table('users')->insert([
            'id' => $userId,
            'company_id' => $this->companyId,
            'name' => "User {$userId}",
            'email' => "user{$userId}@example.test",
            'status' => $userStatus,
        ]);

        DB::table('lead_agents')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'user_id' => $userId,
            'parent_agent_id' => $parentId,
            'status' => $status,
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('parent_agent_id')->nullable();
            $table->string('status')->default('enabled');
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
    }
}
