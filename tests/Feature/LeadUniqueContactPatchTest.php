<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\User;
use App\Services\LeadCoreFieldsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * Inline lead edits (PatchRequest) must reject values that collide with the
 * global unique indexes on `leads` as a 422 field error, instead of letting
 * save() hit the index and the controller's catch-all return a generic 200.
 */
class LeadUniqueContactPatchTest extends TestCase
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

        $this->withoutMiddleware();
        $this->actingAsEditor();
        Lead::unsetEventDispatcher();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_patch_accepts_a_unique_email(): void
    {
        $leadId = $this->insertLead(['client_email' => 'old@example.com']);
        $this->insertLead(['client_email' => 'taken@example.com']);

        $this->patchJson('/account/lead-contact/'.$leadId, [
            'client_email' => 'fresh@example.com',
        ])->assertOk()->assertJsonPath('status', 'success');

        $this->assertSame('fresh@example.com', Lead::findOrFail($leadId)->client_email);
    }

    public function test_patch_rejects_an_email_used_by_another_lead(): void
    {
        $leadId = $this->insertLead(['client_email' => 'old@example.com']);
        $this->insertLead(['client_email' => 'taken@example.com']);

        $this->patchJson('/account/lead-contact/'.$leadId, [
            'client_email' => 'taken@example.com',
        ])->assertStatus(422)
            ->assertJsonPath('errors.client_email.0', __('messages.leadDuplicateEmail'));

        $this->assertSame('old@example.com', Lead::findOrFail($leadId)->client_email);
    }

    public function test_patch_allows_resaving_the_leads_own_email(): void
    {
        $leadId = $this->insertLead(['client_email' => 'mine@example.com']);

        $this->patchJson('/account/lead-contact/'.$leadId, [
            'client_email' => 'mine@example.com',
        ])->assertOk()->assertJsonPath('status', 'success');
    }

    public function test_patch_allows_clearing_the_email(): void
    {
        $leadId = $this->insertLead(['client_email' => 'mine@example.com']);
        $this->insertLead(['client_email' => null]);

        $this->patchJson('/account/lead-contact/'.$leadId, [
            'client_email' => null,
        ])->assertOk()->assertJsonPath('status', 'success');

        $this->assertNull(Lead::findOrFail($leadId)->client_email);
    }

    public function test_patch_rejects_an_email_held_by_a_soft_deleted_lead(): void
    {
        // The DB unique index ignores deleted_at, so validation must too.
        $leadId = $this->insertLead(['client_email' => 'old@example.com']);
        $this->insertLead(['client_email' => 'archived@example.com', 'deleted_at' => now()]);

        $this->patchJson('/account/lead-contact/'.$leadId, [
            'client_email' => 'archived@example.com',
        ])->assertStatus(422)->assertJsonValidationErrors('client_email');
    }

    /**
     * @dataProvider uniqueHandleFields
     */
    public function test_patch_rejects_a_duplicate_handle(string $field, string $label): void
    {
        $leadId = $this->insertLead([$field => 'mine']);
        $this->insertLead([$field => 'taken']);

        $this->patchJson('/account/lead-contact/'.$leadId, [
            $field => 'taken',
        ])->assertStatus(422)
            ->assertJsonPath("errors.{$field}.0", __('messages.leadDuplicateContact', ['attribute' => $label]));

        $this->assertSame('mine', DB::table('leads')->where('id', $leadId)->value($field));
    }

    /**
     * @dataProvider uniqueHandleFields
     */
    public function test_patch_allows_resaving_the_leads_own_handle(string $field): void
    {
        $leadId = $this->insertLead([$field => 'mine']);

        $this->patchJson('/account/lead-contact/'.$leadId, [
            $field => 'mine',
        ])->assertOk()->assertJsonPath('status', 'success');
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function uniqueHandleFields(): array
    {
        return [
            'whatsapp' => ['client_whatsapp', 'WhatsApp'],
            'telegram' => ['client_telegram', 'Telegram'],
            'instagram' => ['client_instagram', 'Instagram'],
        ];
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
            $table->string('client_email')->nullable()->unique();
            $table->string('client_whatsapp')->nullable()->unique();
            $table->string('client_telegram')->nullable()->unique();
            $table->string('client_instagram')->nullable()->unique();
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
