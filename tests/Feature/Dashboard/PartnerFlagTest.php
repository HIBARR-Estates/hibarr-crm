<?php

namespace Tests\Feature\Dashboard;

use App\Http\Controllers\PartnerFlagController;
use App\Models\PartnerFlag;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use ReflectionClass;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * Partner flags sit on the trust boundary.
 *
 * A partner can raise one only against a lead their own agent record
 * introduced, and that check lives in the controller — not in a hidden form
 * field, not in the UI. The "another partner's referral" case is the test that
 * must never be allowed to regress.
 */
class PartnerFlagTest extends TestCase
{
    private int $companyId = 1;

    private int $partnerUserId = 10;

    private int $partnerAgentId = 1;

    private int $otherAgentId = 2;

    private int $managerUserId = 20;

    private PartnerFlagController $controller;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();

        Notification::fake();

        $this->controller = (new ReflectionClass(PartnerFlagController::class))
            ->newInstanceWithoutConstructor();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_a_partner_can_flag_a_lead_they_referred(): void
    {
        $this->actAsPartner();

        $this->controller->store($this->request([
            'lead_id' => 1,
            'reason' => 'stalled',
            'message' => 'No update in weeks',
        ]));

        $this->assertSame(1, PartnerFlag::count());
        $this->assertSame('stalled', PartnerFlag::first()->reason);
    }

    public function test_a_partner_cannot_flag_a_lead_they_did_not_refer(): void
    {
        $this->actAsPartner();

        $this->expectException(HttpException::class);

        // Lead 2 belongs to a different agent's referral book.
        $this->controller->store($this->request([
            'lead_id' => 2,
            'reason' => 'stalled',
        ]));
    }

    public function test_flagging_twice_while_open_does_not_duplicate(): void
    {
        $this->actAsPartner();
        $payload = ['lead_id' => 1, 'reason' => 'stalled'];

        $this->controller->store($this->request($payload));
        $this->controller->store($this->request($payload));

        $this->assertSame(1, PartnerFlag::count());
    }

    public function test_a_resolved_flag_does_not_block_a_new_one(): void
    {
        $this->actAsPartner();
        $this->controller->store($this->request(['lead_id' => 1, 'reason' => 'stalled']));

        PartnerFlag::first()->update(['status' => PartnerFlag::STATUS_RESOLVED]);

        // The same concern can recur; a three-month-old answer must not gag them.
        $this->controller->store($this->request(['lead_id' => 1, 'reason' => 'stalled']));

        $this->assertSame(2, PartnerFlag::count());
    }

    public function test_an_unknown_reason_is_rejected(): void
    {
        $this->actAsPartner();

        $this->expectException(ValidationException::class);

        $this->controller->store($this->request([
            'lead_id' => 1,
            'reason' => 'i_just_feel_like_it',
        ]));
    }

    public function test_resolving_requires_the_permission(): void
    {
        $this->actAsPartner();
        $this->controller->store($this->request(['lead_id' => 1, 'reason' => 'stalled']));

        $this->expectException(HttpException::class);

        $this->controller->resolve(
            $this->request(['response' => 'Looking into it']),
            PartnerFlag::first(),
        );
    }

    public function test_resolving_stamps_who_answered_and_when(): void
    {
        // Seeded rather than raised through the controller: user() memoises
        // per request, so acting as two people in one test would keep the
        // first. The raise path is covered by the tests above.
        PartnerFlag::create([
            'company_id' => $this->companyId,
            'lead_agent_id' => $this->partnerAgentId,
            'lead_id' => 1,
            'reason' => 'stalled',
            'status' => PartnerFlag::STATUS_OPEN,
        ]);

        $this->actAsManager();
        $this->controller->resolve(
            $this->request(['response' => 'Reassigned to another agent']),
            PartnerFlag::first(),
        );

        $flag = PartnerFlag::first();

        $this->assertSame(PartnerFlag::STATUS_RESOLVED, $flag->status);
        $this->assertSame('Reassigned to another agent', $flag->response);
        $this->assertSame($this->managerUserId, $flag->resolved_by);
        $this->assertNotNull($flag->resolved_at);
    }

    private function actAsPartner(): void
    {
        Auth::setUser(User::findOrFail($this->partnerUserId));
    }

    private function actAsManager(): void
    {
        Auth::setUser(User::findOrFail($this->managerUserId));
    }

    private function request(array $payload): Request
    {
        $request = Request::create('/account/partner-flags', 'POST', $payload);
        $this->app->instance('request', $request);

        return $request;
    }

    private function resetSchema(): void
    {
        foreach ([
            'partner_flags', 'user_permissions', 'permission_types', 'permissions', 'client_contacts', 'sessions',
            'leads', 'lead_agents', 'users', 'companies',
        ] as $table) {
            Schema::dropIfExists($table);
        }
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
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('status')->default('active');
        });

        // User eager-loads both by default; left empty.
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedInteger('user_id')->nullable();
        });

        Schema::create('client_contacts', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedBigInteger('referred_by_agent_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });

        Schema::create('permission_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });

        Schema::create('user_permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('permission_id');
            $table->unsignedInteger('permission_type_id');
        });

        Schema::create('partner_flags', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('lead_agent_id');
            $table->unsignedInteger('lead_id');
            $table->string('reason', 32);
            $table->text('message')->nullable();
            $table->string('status', 16)->default('open');
            $table->text('response')->nullable();
            $table->unsignedInteger('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);

        DB::table('users')->insert([
            ['id' => $this->partnerUserId, 'company_id' => $this->companyId, 'name' => 'Partner', 'status' => 'active'],
            ['id' => $this->managerUserId, 'company_id' => $this->companyId, 'name' => 'Manager', 'status' => 'active'],
        ]);

        DB::table('lead_agents')->insert([
            ['id' => $this->partnerAgentId, 'company_id' => $this->companyId, 'user_id' => $this->partnerUserId],
            ['id' => $this->otherAgentId, 'company_id' => $this->companyId, 'user_id' => null],
        ]);

        DB::table('leads')->insert([
            ['id' => 1, 'company_id' => $this->companyId, 'client_name' => 'Mine', 'referred_by_agent_id' => $this->partnerAgentId],
            ['id' => 2, 'company_id' => $this->companyId, 'client_name' => 'Theirs', 'referred_by_agent_id' => $this->otherAgentId],
        ]);

        DB::table('permissions')->insert(['id' => 1, 'name' => 'manage_partner_flags']);
        DB::table('permission_types')->insert(['id' => 4, 'name' => 'all']);
        DB::table('user_permissions')->insert([
            'user_id' => $this->managerUserId,
            'permission_id' => 1,
            'permission_type_id' => 4,
        ]);
    }
}
