<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class LeadMergeEndpointTest extends TestCase
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
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_merge_route_returns_404_when_flag_disabled(): void
    {
        $this->setFeatureFlag('crm.lead-merge', false);
        $this->withoutMiddleware();

        $primaryId = $this->insertLead(['client_name' => 'Primary', 'client_email' => 'a@example.com']);
        $duplicateId = $this->insertLead(['client_name' => 'Duplicate', 'client_email' => 'b@example.com']);

        $response = $this->postJson('/account/lead-contact/' . $primaryId . '/merge', [
            'duplicate_id' => $duplicateId,
        ]);

        $response->assertStatus(404);
    }

    public function test_duplicates_route_returns_404_when_flag_disabled(): void
    {
        $this->setFeatureFlag('crm.lead-merge', false);
        $this->withoutMiddleware();

        $leadId = $this->insertLead(['client_name' => 'Lead', 'client_email' => 'a@example.com']);

        $response = $this->getJson('/account/lead-contact/' . $leadId . '/duplicates');

        $response->assertStatus(404);
    }

    public function test_merge_route_requires_authentication(): void
    {
        $this->setFeatureFlag('crm.lead-merge', true);

        $primaryId = $this->insertLead(['client_name' => 'Primary', 'client_email' => 'a@example.com']);
        $duplicateId = $this->insertLead(['client_name' => 'Duplicate', 'client_email' => 'b@example.com']);

        $response = $this->post('/account/lead-contact/' . $primaryId . '/merge', [
            'duplicate_id' => $duplicateId,
        ]);

        $this->assertTrue(
            in_array($response->status(), [401, 302, 303], true),
            'Expected unauthenticated response, got ' . $response->status()
        );
    }

    public function test_merge_denied_when_user_lacks_merge_permission(): void
    {
        $lead = new Lead([
            'company_id' => $this->companyId,
            'added_by' => 1,
            'lead_owner' => 1,
        ]);
        $lead->id = 1;

        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->shouldReceive('permission')->with('merge_lead')->andReturn('none');

        $access = PermissionService::checkAccess($user, 'merge_lead', $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);

        $this->assertFalse($access['canAccess']);
    }

    public function test_scoped_user_cannot_merge_lead_outside_ownership(): void
    {
        $lead = new Lead([
            'company_id' => $this->companyId,
            'added_by' => 1,
            'lead_owner' => 2,
        ]);
        $lead->id = 5;

        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->shouldReceive('permission')->with('merge_lead')->andReturn('owned');

        $access = PermissionService::checkAccess($user, 'merge_lead', $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);

        $this->assertFalse($access['canAccess']);
    }

    private function resetSchema(): void
    {
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
            $table->unsignedInteger('merged_into_lead_id')->nullable();
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
    private function insertLead(array $attributes): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'client_email' => null,
            'merged_into_lead_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
