<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\LeadContactMethod;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class LeadContactMethodEndpointTest extends TestCase
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
        $this->seedCompany();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_contact_method_routes_are_registered(): void
    {
        $this->assertTrue(Route::has('lead-contact.contact-methods.index'));
        $this->assertTrue(Route::has('lead-contact.contact-methods.store'));
        $this->assertTrue(Route::has('lead-contact.contact-methods.update'));
        $this->assertTrue(Route::has('lead-contact.contact-methods.destroy'));
    }

    public function test_store_requires_authentication(): void
    {
        $leadId = $this->insertLead(['client_email' => 'a@example.com']);

        $response = $this->postJson('/account/lead-contact/'.$leadId.'/contact-methods', [
            'type' => 'email',
            'identifier' => 'alt@example.com',
        ]);

        $this->assertTrue(
            in_array($response->status(), [401, 302, 303], true),
            'Expected unauthenticated response, got '.$response->status()
        );
    }

    public function test_store_creates_alternate_and_leaves_primary_unchanged(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $leadId = $this->insertLead(['client_email' => 'primary@example.com', 'mobile' => '111']);

        $response = $this->postJson('/account/lead-contact/'.$leadId.'/contact-methods', [
            'type' => 'email',
            'identifier' => 'alt@example.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.identifier', 'alt@example.com')
            ->assertJsonPath('data.is_main', false);

        $this->assertSame('primary@example.com', Lead::findOrFail($leadId)->client_email);
    }

    public function test_store_returns_422_with_conflicts_for_other_lead_primary(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $otherId = $this->insertLead(['client_name' => 'Taken', 'client_email' => 'taken@example.com']);
        $leadId = $this->insertLead(['client_email' => 'mine@example.com']);

        $response = $this->postJson('/account/lead-contact/'.$leadId.'/contact-methods', [
            'type' => 'email',
            'identifier' => 'taken@example.com',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('status', 'fail')
            ->assertJsonPath('conflicts.0.lead_id', $otherId)
            ->assertJsonPath('conflicts.0.match', 'primary');
    }

    public function test_cannot_patch_or_delete_main_row(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $leadId = $this->insertLead(['client_email' => 'primary@example.com']);
        $mainId = (int) DB::table('lead_contact_methods')->insertGetId([
            'lead_id' => $leadId,
            'company_id' => $this->companyId,
            'type' => 'email',
            'identifier' => 'primary@example.com',
            'normalized' => 'primary@example.com',
            'is_main' => true,
            'source_field' => 'client_email',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->patchJson('/account/lead-contact/'.$leadId.'/contact-methods/'.$mainId, [
            'identifier' => 'new@example.com',
        ])->assertStatus(422);

        $this->deleteJson('/account/lead-contact/'.$leadId.'/contact-methods/'.$mainId)
            ->assertStatus(422);

        $this->assertTrue((bool) LeadContactMethod::query()->findOrFail($mainId)->is_main);
        $this->assertSame('primary@example.com', Lead::findOrFail($leadId)->client_email);
    }

    public function test_edit_denied_when_user_lacks_permission(): void
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
        $user->shouldReceive('permission')->with('edit_lead')->andReturn('none');

        $access = PermissionService::checkAccess($user, 'edit_lead', $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);

        $this->assertFalse($access['canAccess']);
    }

    private function actingAsEditor(): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->company_id = $this->companyId;
        $user->shouldReceive('permission')->andReturn('all');
        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => $this->companyId]]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_contact_methods');
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
            $table->string('mobile')->nullable();
            $table->string('cell')->nullable();
            $table->string('office')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('lead_contact_methods', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('type', 16);
            $table->string('identifier');
            $table->string('normalized');
            $table->boolean('is_main')->default(false);
            $table->string('source_field', 32)->nullable();
            $table->timestamps();
            $table->unique(['lead_id', 'type', 'normalized'], 'lead_contact_methods_lead_type_normalized_unique');
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
            'mobile' => null,
            'cell' => null,
            'office' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
