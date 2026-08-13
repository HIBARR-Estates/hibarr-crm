<?php

namespace Tests\Feature\Dashboard;

use App\Http\Controllers\DashboardV2Controller;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

/**
 * The Partner tab is gated twice: on the permission, and on the account
 * actually having referral data.
 *
 * Only the second gate is tested here — the permission half is framework code
 * this change does not touch. What matters is that a staff account that still
 * holds view_partner_dashboard does not get a tab rendering an empty state.
 */
class PartnerViewGateTest extends TestCase
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

    public function test_account_with_no_agent_record_has_no_partner_data(): void
    {
        $this->assertFalse($this->hasPartnerData(99));
    }

    public function test_agent_with_no_referrals_or_commissions_has_no_partner_data(): void
    {
        $this->makeAgent(userId: 10);

        $this->assertFalse($this->hasPartnerData(10));
    }

    public function test_a_single_referred_lead_is_enough(): void
    {
        $agentId = $this->makeAgent(userId: 11);

        Lead::insert([
            'company_id' => $this->companyId,
            'client_name' => 'Referred client',
            'referred_by_agent_id' => $agentId,
        ]);

        $this->assertTrue($this->hasPartnerData(11));
    }

    public function test_a_commission_alone_is_enough(): void
    {
        $agentId = $this->makeAgent(userId: 12);

        MlmCommission::insert([
            'company_id' => $this->companyId,
            'agent_id' => $agentId,
            'amount' => 100,
            'status' => 'pending',
        ]);

        $this->assertTrue($this->hasPartnerData(12));
    }

    public function test_another_agents_referral_does_not_count(): void
    {
        $mine = $this->makeAgent(userId: 13);
        $theirs = $this->makeAgent(userId: 14);

        Lead::insert([
            'company_id' => $this->companyId,
            'client_name' => 'Not mine',
            'referred_by_agent_id' => $theirs,
        ]);

        $this->assertTrue($this->hasPartnerData(14));
        $this->assertFalse($this->hasPartnerData(13), 'Referral leaked across agents');

        // Silences the unused-variable warning while documenting intent.
        $this->assertNotSame($mine, $theirs);
    }

    private function hasPartnerData(int $userId): bool
    {
        $method = new ReflectionMethod(DashboardV2Controller::class, 'hasPartnerData');
        $method->setAccessible(true);

        // The constructor is AccountBaseController's and renders view state this
        // test has no use for; the method under test reads only its argument.
        $controller = (new \ReflectionClass(DashboardV2Controller::class))
            ->newInstanceWithoutConstructor();

        return $method->invoke($controller, $userId);
    }

    private function makeAgent(int $userId): int
    {
        return LeadAgent::insertGetId([
            'company_id' => $this->companyId,
            'user_id' => $userId,
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('mlm_commissions');
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->unsignedBigInteger('referred_by_agent_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('parent_agent_id')->nullable();
            $table->timestamps();
        });

        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->decimal('amount', 15, 2)->default(0);
            $table->string('status')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
    }
}
