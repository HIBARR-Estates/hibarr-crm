<?php

namespace Tests\Feature;

use App\Http\Controllers\LeadContactController;
use App\Models\Lead;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Admin-only bulk fields, exercised through the real
 * LeadContactController::applyBulkUpdateFields().
 *
 * The referrer is write-once, and a mass update bypasses LeadObserver, so the
 * guard has to live in the query — that is what these pin down.
 */
class LeadBulkAdminFieldsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('referred_by_agent_id')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            // User carries an ActiveScope global scope.
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->string('status')->default('enabled');
            $table->timestamps();
        });

        DB::table('users')->insert([
            ['id' => 4, 'name' => 'Admin', 'status' => 'active', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 5, 'name' => 'Deactivated', 'status' => 'deactive', 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('lead_agents')->insert([
            ['id' => 9, 'company_id' => 1, 'user_id' => 4, 'status' => 'enabled', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_referrer_fills_only_leads_without_one(): void
    {
        $this->actAsAdmin();
        $empty = $this->insertLead(['client_name' => 'No referrer']);
        $taken = $this->insertLead(['client_name' => 'Has referrer', 'referred_by_agent_id' => 7]);

        $error = $this->applyFields(
            ['referred_by_agent_id' => 9],
            [$empty, $taken],
            ['referred_by_agent_id']
        );

        $this->assertNull($error);
        $this->assertSame(9, (int) Lead::findOrFail($empty)->referred_by_agent_id);
        $this->assertSame(7, (int) Lead::findOrFail($taken)->referred_by_agent_id);
    }

    public function test_added_by_is_written_to_every_selected_lead(): void
    {
        $this->actAsAdmin();
        $a = $this->insertLead(['client_name' => 'A', 'added_by' => 1]);
        $b = $this->insertLead(['client_name' => 'B']);

        $error = $this->applyFields(['added_by' => 4], [$a, $b], ['added_by']);

        $this->assertNull($error);
        $this->assertSame(4, (int) Lead::findOrFail($a)->added_by);
        $this->assertSame(4, (int) Lead::findOrFail($b)->added_by);
    }

    public function test_non_admins_are_refused_and_nothing_is_written(): void
    {
        session(['user_roles' => ['employee']]);
        $lead = $this->insertLead(['client_name' => 'Untouched']);

        foreach ([['added_by' => 4], ['referred_by_agent_id' => 9]] as $payload) {
            $field = array_key_first($payload);
            $error = $this->applyFields($payload, [$lead], [$field]);

            $this->assertNotNull($error, "{$field} must be refused for non-admins");
        }

        $fresh = Lead::findOrFail($lead);
        $this->assertNull($fresh->added_by);
        $this->assertNull($fresh->referred_by_agent_id);
    }

    public function test_unknown_agent_id_is_rejected_before_any_write(): void
    {
        $this->actAsAdmin();
        $lead = $this->insertLead(['client_name' => 'Untouched']);

        $error = $this->applyFields(
            ['referred_by_agent_id' => 12345],
            [$lead],
            ['referred_by_agent_id']
        );

        $this->assertNotNull($error);
        $this->assertNull(Lead::findOrFail($lead)->referred_by_agent_id);
    }

    public function test_unknown_user_id_is_rejected_before_any_write(): void
    {
        $this->actAsAdmin();
        $lead = $this->insertLead(['client_name' => 'Untouched']);

        $error = $this->applyFields(['added_by' => 999], [$lead], ['added_by']);

        $this->assertNotNull($error);
        $this->assertNull(Lead::findOrFail($lead)->added_by);
    }

    public function test_deactivated_users_are_rejected_like_lead_owner_already_does(): void
    {
        $this->actAsAdmin();
        $lead = $this->insertLead(['client_name' => 'Untouched']);

        // User::whereKey()->exists() runs under ActiveScope, so a deactivated
        // user cannot be assigned — same rule the lead_owner branch has always had.
        $error = $this->applyFields(['added_by' => 5], [$lead], ['added_by']);

        $this->assertNotNull($error);
        $this->assertNull(Lead::findOrFail($lead)->added_by);
    }

    private function actAsAdmin(): void
    {
        // user_roles() reads the session before touching the DB.
        session(['user_roles' => ['admin']]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<int>  $rowIds
     * @param  list<string>  $fields
     */
    private function applyFields(array $payload, array $rowIds, array $fields): ?string
    {
        $method = new ReflectionMethod(LeadContactController::class, 'applyBulkUpdateFields');
        $method->setAccessible(true);

        return $method->invoke(
            app(LeadContactController::class),
            Request::create('/lead-contact/apply-quick-action', 'POST', $payload),
            $rowIds,
            $fields
        );
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('users');
        Schema::dropIfExists('leads');
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertLead(array $attributes): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => 1,
            'client_name' => 'Test Lead',
            'added_by' => null,
            'referred_by_agent_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
