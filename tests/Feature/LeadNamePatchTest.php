<?php

namespace Tests\Feature;

use App\Http\Requests\Lead\PatchRequest;
use App\Models\Lead;
use App\Models\User;
use App\Services\LeadCoreFieldsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Mockery;
use Tests\TestCase;

class LeadNamePatchTest extends TestCase
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

        $core = Mockery::mock(LeadCoreFieldsService::class);
        $core->shouldReceive('validationRules')->andReturn([]);
        $core->shouldReceive('write')->andReturnNull();
        $core->shouldReceive('mergeOntoLead')->andReturnUsing(fn (Lead $lead) => $lead);
        $this->app->instance(LeadCoreFieldsService::class, $core);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_patch_renames_lead(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();
        Lead::unsetEventDispatcher();

        $leadId = $this->insertLead(['client_name' => 'Original Name']);

        $response = $this->patchJson('/account/lead-contact/'.$leadId, [
            'client_name' => 'Renamed Lead',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.lead.client_name', 'Renamed Lead');

        $this->assertSame('Renamed Lead', Lead::findOrFail($leadId)->client_name);
    }

    public function test_patch_rejects_empty_client_name(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $leadId = $this->insertLead(['client_name' => 'Original Name']);

        $this->patchJson('/account/lead-contact/'.$leadId, [
            'client_name' => '',
        ])->assertStatus(422);

        $this->assertSame('Original Name', Lead::findOrFail($leadId)->client_name);
    }

    public function test_patch_rejects_whitespace_only_client_name(): void
    {
        $this->withoutMiddleware();
        $this->actingAsEditor();

        $leadId = $this->insertLead(['client_name' => 'Original Name']);

        $this->patchJson('/account/lead-contact/'.$leadId, [
            'client_name' => '   ',
        ])->assertStatus(422);

        $this->assertSame('Original Name', Lead::findOrFail($leadId)->client_name);
    }

    public function test_patch_request_allows_a_non_empty_client_name(): void
    {
        $request = PatchRequest::create('/lead-contact/1', 'PATCH', [
            'client_name' => 'Ada Lovelace',
        ]);
        $request->setContainer($this->app);
        $request->setRedirector($this->app->make('redirect'));
        $request->validateResolved();

        $this->addToAssertionCount(1);
    }

    public function test_patch_request_rejects_empty_client_name(): void
    {
        $request = PatchRequest::create('/lead-contact/1', 'PATCH', [
            'client_name' => '',
        ]);
        $request->setContainer($this->app);
        $request->setRedirector($this->app->make('redirect'));

        try {
            $request->validateResolved();
            $this->fail('Expected client_name validation to fail.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('client_name', $e->errors());
        }
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
            $table->string('salutation')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
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
            'salutation' => null,
            'added_by' => 99,
            'lead_owner' => 99,
            'last_updated_by' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
