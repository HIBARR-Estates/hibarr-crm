<?php

namespace Tests\Feature;

use App\Enums\LeadContactMethodType;
use App\Models\Lead;
use App\Services\LeadContactMethodService;
use App\Support\LeadSearchQuery;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LeadContactMethodServiceTest extends TestCase
{
    private int $companyId = 1;

    private LeadContactMethodService $service;

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

        $this->service = app(LeadContactMethodService::class);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_sync_uses_mobile_as_main_phone_and_stores_cell_as_alternate(): void
    {
        $leadId = $this->insertLead([
            'client_email' => 'a@example.com',
            'mobile' => '111',
            'cell' => '222',
        ]);

        $this->service->syncFromLeadColumns(Lead::findOrFail($leadId));
        $this->service->syncFromLeadColumns(Lead::findOrFail($leadId));

        $phones = DB::table('lead_contact_methods')->where('lead_id', $leadId)->where('type', 'phone')->get()->keyBy('normalized');
        $this->assertCount(2, $phones);
        $this->assertTrue((bool) $phones['111']->is_main);
        $this->assertSame('mobile', $phones['111']->source_field);
        $this->assertFalse((bool) $phones['222']->is_main);
        $this->assertSame('cell', $phones['222']->source_field);
    }

    public function test_sync_falls_back_to_cell_as_main_phone_when_mobile_empty(): void
    {
        $leadId = $this->insertLead([
            'client_email' => 'a@example.com',
            'mobile' => null,
            'cell' => '555',
        ]);

        $this->service->syncFromLeadColumns(Lead::findOrFail($leadId));

        $phones = DB::table('lead_contact_methods')->where('lead_id', $leadId)->where('type', 'phone')->get();
        $this->assertCount(1, $phones);
        $this->assertSame('555', $phones->first()->normalized);
        $this->assertTrue((bool) $phones->first()->is_main);
        $this->assertSame('cell', $phones->first()->source_field);
    }

    public function test_sync_stores_office_as_non_main_phone(): void
    {
        $leadId = $this->insertLead([
            'client_email' => 'a@example.com',
            'mobile' => '111',
            'office' => '333',
        ]);

        $this->service->syncFromLeadColumns(Lead::findOrFail($leadId));

        $office = DB::table('lead_contact_methods')
            ->where('lead_id', $leadId)
            ->where('normalized', '333')
            ->first();

        $this->assertNotNull($office);
        $this->assertFalse((bool) $office->is_main);
        $this->assertSame('office', $office->source_field);
    }

    public function test_changing_email_demotes_old_main_and_keeps_it_as_alternate(): void
    {
        $leadId = $this->insertLead(['client_email' => 'old@example.com']);
        $lead = Lead::findOrFail($leadId);
        $this->service->syncFromLeadColumns($lead);

        $lead->client_email = 'new@example.com';
        $lead->save();

        $emails = DB::table('lead_contact_methods')->where('lead_id', $leadId)->where('type', 'email')->get()->keyBy('normalized');
        $this->assertFalse((bool) $emails['old@example.com']->is_main);
        $this->assertTrue((bool) $emails['new@example.com']->is_main);
        $this->assertCount(2, $emails);
    }

    public function test_skips_invalidated_unique_values(): void
    {
        $leadId = $this->insertLead(['client_email' => 'invalid_lead_abcd1234_old@example.com']);

        $this->service->syncFromLeadColumns(Lead::findOrFail($leadId));

        $this->assertSame(0, DB::table('lead_contact_methods')->where('lead_id', $leadId)->count());
    }

    public function test_parses_antd_json_phone_into_digits(): void
    {
        $parsed = $this->service->parsePhone(json_encode([
            'countryCode' => '49',
            'areaCode' => '30',
            'phoneNumber' => '1234567',
        ]));

        $this->assertSame('+49301234567', $parsed['identifier']);
        $this->assertSame('49301234567', $parsed['normalized']);
    }

    public function test_add_alternate_never_sets_is_main(): void
    {
        $leadId = $this->insertLead(['client_email' => 'main@example.com']);
        $lead = Lead::findOrFail($leadId);
        $this->service->syncFromLeadColumns($lead);

        $this->service->addAlternate($lead, LeadContactMethodType::Email, 'alt@example.com', 'client_email');

        $alt = DB::table('lead_contact_methods')
            ->where('lead_id', $leadId)
            ->where('normalized', 'alt@example.com')
            ->first();

        $this->assertNotNull($alt);
        $this->assertFalse((bool) $alt->is_main);
    }

    public function test_search_matches_alternate_contact_method(): void
    {
        $matchId = $this->insertLead(['client_name' => 'Match', 'client_email' => 'keep@example.com']);
        $this->insertLead(['client_name' => 'Other', 'client_email' => 'other@example.com']);

        DB::table('lead_contact_methods')->insert([
            'lead_id' => $matchId,
            'company_id' => $this->companyId,
            'type' => 'email',
            'identifier' => 'merged-in@example.com',
            'normalized' => 'merged-in@example.com',
            'is_main' => false,
            'source_field' => 'client_email',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $ids = Lead::query()
            ->where(function ($query) {
                LeadSearchQuery::applyContactMethodMatch($query, 'merged-in@example.com');
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $this->assertSame([$matchId], $ids);
    }

    public function test_create_user_alternate_does_not_change_primary_columns(): void
    {
        $leadId = $this->insertLead(['client_email' => 'primary@example.com', 'mobile' => '111']);
        $lead = Lead::findOrFail($leadId);

        $method = $this->service->createUserAlternate($lead, LeadContactMethodType::Email, 'alt@example.com');

        $lead->refresh();
        $this->assertSame('primary@example.com', $lead->client_email);
        $this->assertSame('111', $lead->mobile);
        $this->assertFalse($method->is_main);
        $this->assertNull($method->source_field);
        $this->assertSame('alt@example.com', $method->normalized);
    }

    public function test_create_user_alternate_blocks_own_primary_email(): void
    {
        $lead = Lead::findOrFail($this->insertLead(['client_email' => 'primary@example.com']));

        $this->expectException(\App\Exceptions\LeadContactMethodException::class);
        $this->expectExceptionMessage("This email is already the lead's primary email.");

        $this->service->createUserAlternate($lead, LeadContactMethodType::Email, 'PRIMARY@example.com');
    }

    public function test_create_user_alternate_blocks_duplicate_on_same_lead(): void
    {
        $lead = Lead::findOrFail($this->insertLead(['client_email' => 'primary@example.com']));
        $this->service->createUserAlternate($lead, LeadContactMethodType::Email, 'alt@example.com');

        $this->expectException(\App\Exceptions\LeadContactMethodException::class);
        $this->expectExceptionMessage('This contact method already exists on this lead.');

        $this->service->createUserAlternate($lead, LeadContactMethodType::Email, 'alt@example.com');
    }

    public function test_create_user_alternate_blocks_other_lead_primary_with_conflicts(): void
    {
        $otherId = $this->insertLead(['client_name' => 'Taken', 'client_email' => 'taken@example.com']);
        $lead = Lead::findOrFail($this->insertLead(['client_email' => 'mine@example.com']));

        try {
            $this->service->createUserAlternate($lead, LeadContactMethodType::Email, 'taken@example.com');
            $this->fail('Expected conflict');
        } catch (\App\Exceptions\LeadContactMethodException $e) {
            $this->assertSame('This email is already used on another lead.', $e->getMessage());
            $this->assertCount(1, $e->conflicts);
            $this->assertSame($otherId, $e->conflicts[0]['lead_id']);
            $this->assertSame('primary', $e->conflicts[0]['match']);
            $this->assertSame('Taken', $e->conflicts[0]['client_name']);
        }
    }

    public function test_create_user_alternate_blocks_other_lead_alternate(): void
    {
        $otherId = $this->insertLead(['client_name' => 'Other', 'client_email' => 'other@example.com']);
        DB::table('lead_contact_methods')->insert([
            'lead_id' => $otherId,
            'company_id' => $this->companyId,
            'type' => 'email',
            'identifier' => 'shared@example.com',
            'normalized' => 'shared@example.com',
            'is_main' => false,
            'source_field' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $lead = Lead::findOrFail($this->insertLead(['client_email' => 'mine@example.com']));

        try {
            $this->service->createUserAlternate($lead, LeadContactMethodType::Email, 'shared@example.com');
            $this->fail('Expected conflict');
        } catch (\App\Exceptions\LeadContactMethodException $e) {
            $this->assertSame($otherId, $e->conflicts[0]['lead_id']);
            $this->assertSame('alternate', $e->conflicts[0]['match']);
        }
    }

    public function test_create_user_alternate_ignores_trashed_other_lead(): void
    {
        $trashedId = $this->insertLead(['client_email' => 'gone@example.com']);
        DB::table('leads')->where('id', $trashedId)->update(['deleted_at' => now()]);
        $lead = Lead::findOrFail($this->insertLead(['client_email' => 'mine@example.com']));

        $method = $this->service->createUserAlternate($lead, LeadContactMethodType::Email, 'gone@example.com');

        $this->assertSame('gone@example.com', $method->normalized);
    }

    public function test_update_and_delete_reject_main_rows(): void
    {
        $leadId = $this->insertLead(['client_email' => 'primary@example.com']);
        $lead = Lead::findOrFail($leadId);
        $this->service->syncFromLeadColumns($lead);
        $main = $lead->contactMethods()->where('is_main', true)->first();
        $this->assertNotNull($main);

        try {
            $this->service->updateUserAlternate($lead, $main, 'new@example.com');
            $this->fail('Expected main update to fail');
        } catch (\App\Exceptions\LeadContactMethodException $e) {
            $this->assertSame('The primary email or phone cannot be changed here.', $e->getMessage());
        }

        try {
            $this->service->deleteUserAlternate($lead, $main);
            $this->fail('Expected main delete to fail');
        } catch (\App\Exceptions\LeadContactMethodException $e) {
            $this->assertSame('The primary email or phone cannot be changed here.', $e->getMessage());
        }

        $this->assertSame('primary@example.com', $lead->fresh()->client_email);
        $this->assertTrue($main->fresh()->is_main);
    }

    public function test_update_and_delete_user_alternate(): void
    {
        $lead = Lead::findOrFail($this->insertLead(['client_email' => 'primary@example.com']));
        $method = $this->service->createUserAlternate($lead, LeadContactMethodType::Email, 'old-alt@example.com');

        $updated = $this->service->updateUserAlternate($lead, $method, 'new-alt@example.com');
        $this->assertSame('new-alt@example.com', $updated->normalized);
        $this->assertFalse($updated->is_main);

        $this->service->deleteUserAlternate($lead, $updated);
        $this->assertNull(\App\Models\LeadContactMethod::query()->find($updated->id));
        $this->assertSame('primary@example.com', $lead->fresh()->client_email);
    }

    public function test_create_user_alternate_phone_blocks_other_primary_mobile(): void
    {
        $otherId = $this->insertLead(['client_name' => 'Phone Taken', 'client_email' => 'a@example.com', 'mobile' => '555111']);
        $lead = Lead::findOrFail($this->insertLead(['client_email' => 'b@example.com', 'mobile' => '111']));

        try {
            $this->service->createUserAlternate($lead, LeadContactMethodType::Phone, '+555111');
            $this->fail('Expected conflict');
        } catch (\App\Exceptions\LeadContactMethodException $e) {
            $this->assertSame($otherId, $e->conflicts[0]['lead_id']);
            $this->assertSame('primary', $e->conflicts[0]['match']);
        }
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
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->timestamp('assigned_at')->nullable();
            $table->unsignedInteger('referred_by_agent_id')->nullable();
            $table->string('hash')->nullable();
            $table->unsignedInteger('lead_lifecycle_status_id')->nullable();
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
