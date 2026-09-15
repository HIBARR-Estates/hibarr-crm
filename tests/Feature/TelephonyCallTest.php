<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class TelephonyCallTest extends TestCase
{
    use SetsFeatureFlags;

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
        $this->seedCompany();

        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);
        config()->set('services.ol.telephony_calls_path', '/telephony/calls');

        Lead::unsetEventDispatcher();
        Deal::unsetEventDispatcher();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();

        parent::tearDown();
    }

    public function test_flag_off_returns_404(): void
    {
        $this->setFeatureFlag('shared.3cx-calling', false);
        $this->withoutMiddleware();
        $this->actingAsAuthorizedUser();

        $leadId = $this->insertLead();

        $this->postJson(route('telephony.calls.store'), [
            'phone' => '+491701234567',
            'entity_type' => 'lead',
            'entity_id' => $leadId,
        ])->assertStatus(404);
    }

    public function test_successful_lead_call_proxies_to_ol(): void
    {
        $this->setFeatureFlag('shared.3cx-calling', true);
        $this->withoutMiddleware();
        $this->actingAsAuthorizedUser();

        $leadId = $this->insertLead();

        Http::fake([
            'https://ol.test/v1/telephony/calls' => Http::response([
                'message' => 'Your extension is ringing.',
                'data' => ['callId' => 'call-123'],
            ], 201),
        ]);

        $this->postJson(route('telephony.calls.store'), [
            'phone' => '+49 170 1234567',
            'entity_type' => 'lead',
            'entity_id' => $leadId,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('message', 'Your extension is ringing.');

        Http::assertSent(function ($request) use ($leadId) {
            return $request->url() === 'https://ol.test/v1/telephony/calls'
                && $request['phone_number'] === '+491701234567'
                && $request['entity_type'] === 'lead'
                && $request['entity_id'] === $leadId
                && $request['user_id'] === 99;
        });
    }

    public function test_no_view_permission_returns_403(): void
    {
        $this->setFeatureFlag('shared.3cx-calling', true);
        $this->withoutMiddleware();
        $this->actingAsRestrictedUser();

        $leadId = $this->insertLead(['added_by' => 1, 'lead_owner' => 1]);

        $this->postJson(route('telephony.calls.store'), [
            'phone' => '+491701234567',
            'entity_type' => 'lead',
            'entity_id' => $leadId,
        ])->assertStatus(403);
    }

    public function test_unbound_extension_error_is_forwarded(): void
    {
        $this->setFeatureFlag('shared.3cx-calling', true);
        $this->withoutMiddleware();
        $this->actingAsAuthorizedUser();

        $leadId = $this->insertLead();

        Http::fake([
            'https://ol.test/v1/telephony/calls' => Http::response([
                'message' => 'No 3CX extension is bound to this user.',
                'code' => 'NO_BOUND_EXTENSION',
            ], 422),
        ]);

        $this->postJson(route('telephony.calls.store'), [
            'phone' => '+491701234567',
            'entity_type' => 'lead',
            'entity_id' => $leadId,
        ])
            ->assertStatus(422)
            ->assertJsonPath('status', 'fail')
            ->assertJsonPath('message', 'No 3CX extension is bound to this user.');
    }

    public function test_deal_call_uses_deal_entity(): void
    {
        $this->setFeatureFlag('shared.3cx-calling', true);
        $this->withoutMiddleware();
        $this->actingAsAuthorizedUser();

        $leadId = $this->insertLead();
        $dealId = $this->insertDeal(['lead_id' => $leadId, 'added_by' => 99]);

        Http::fake([
            'https://ol.test/v1/telephony/calls' => Http::response([
                'message' => 'Your extension is ringing.',
            ], 201),
        ]);

        $this->postJson(route('telephony.calls.store'), [
            'phone' => '+491701234567',
            'entity_type' => 'deal',
            'entity_id' => $dealId,
        ])->assertOk();

        Http::assertSent(function ($request) use ($dealId) {
            return $request['entity_type'] === 'deal'
                && $request['entity_id'] === $dealId;
        });
    }

    private function actingAsAuthorizedUser(): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->company_id = $this->companyId;
        $user->shouldReceive('permission')->andReturn('all');
        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => $this->companyId]]);
    }

    private function actingAsRestrictedUser(): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->company_id = $this->companyId;
        $user->shouldReceive('permission')->with('view_lead')->andReturn('added');
        $user->shouldReceive('permission')->andReturn('none');
        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => $this->companyId]]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('deals');
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
            $table->string('client_email')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->boolean('is_locked')->default(false);
            $table->softDeletes();
            $table->timestamps();
        });
    }

    private function seedCompany(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertLead(array $attributes = []): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'client_email' => null,
            'added_by' => 99,
            'lead_owner' => 99,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertDeal(array $attributes = []): int
    {
        return (int) DB::table('deals')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'lead_id' => null,
            'added_by' => 99,
            'agent_id' => null,
            'is_locked' => false,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
