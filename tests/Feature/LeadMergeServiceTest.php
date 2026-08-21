<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Models\LeadMarketing;
use App\Models\LeadNote;
use App\Services\CrmEventService;
use App\Services\LeadDuplicateDetectionService;
use App\Services\LeadMergeService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class LeadMergeServiceTest extends TestCase
{
    private int $companyId = 1;

    private LeadMergeService $service;

    private array $recordedCrmEvents = [];

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
        $this->bindCrmEventMock();

        $this->service = app(LeadMergeService::class);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_reassigns_related_records_and_soft_deletes_duplicate(): void
    {
        $primaryId = $this->insertLead(['client_name' => 'Primary', 'client_email' => 'primary@example.com']);
        $duplicateId = $this->insertLead(['client_name' => 'Duplicate', 'client_email' => 'dup@example.com']);

        $dealId = DB::table('deals')->insertGetId([
            'lead_id' => $duplicateId,
            'company_id' => $this->companyId,
            'name' => 'Dup Deal',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $noteId = DB::table('lead_notes')->insertGetId([
            'lead_id' => $duplicateId,
            'title' => 'Note',
            'details' => 'Details',
            'type' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $qualId = DB::table('lead_qualifications')->insertGetId([
            'company_id' => $this->companyId,
            'lead_id' => $duplicateId,
            'template_id' => 'default',
            'template_version' => 1,
            'agent_id' => 1,
            'status' => 'inProgress',
            'started_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $activityId = DB::table('communication_activities')->insertGetId([
            'lead_id' => $duplicateId,
            'company_id' => $this->companyId,
            'channel' => 'email',
            'timestamp' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $flightId = DB::table('lead_flight_itineraries')->insertGetId([
            'lead_id' => $duplicateId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $followUpId = DB::table('lead_follow_up')->insertGetId([
            'lead_id' => $duplicateId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('taskables')->insert([
            'task_id' => 10,
            'taskable_id' => $duplicateId,
            'taskable_type' => Lead::class,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $primary = Lead::findOrFail($primaryId);
        $duplicate = Lead::findOrFail($duplicateId);

        $this->service->merge($primary, $duplicate, [], 99);

        $this->assertSame($primaryId, (int) DB::table('deals')->where('id', $dealId)->value('lead_id'));
        $this->assertSame($primaryId, (int) DB::table('lead_notes')->where('id', $noteId)->value('lead_id'));
        $this->assertSame($primaryId, (int) DB::table('lead_qualifications')->where('id', $qualId)->value('lead_id'));
        $this->assertSame($primaryId, (int) DB::table('communication_activities')->where('id', $activityId)->value('lead_id'));
        $this->assertSame($primaryId, (int) DB::table('lead_flight_itineraries')->where('id', $flightId)->value('lead_id'));
        $this->assertSame($primaryId, (int) DB::table('lead_follow_up')->where('id', $followUpId)->value('lead_id'));
        $this->assertSame($primaryId, (int) DB::table('taskables')->where('task_id', 10)->value('taskable_id'));

        $trashed = Lead::withTrashed()->find($duplicateId);
        $this->assertNotNull($trashed);
        $this->assertTrue($trashed->trashed());
        $this->assertSame($primaryId, (int) $trashed->merged_into_lead_id);
        $this->assertStringStartsWith('invalid_lead_', (string) $trashed->client_email);
        $this->assertNull(Lead::find($duplicateId));

        $this->assertNotEmpty($this->recordedCrmEvents);
        $this->assertSame('lead_merged', $this->recordedCrmEvents[0]['event_type_slug']);
    }

    public function test_fills_primary_empty_contact_fields_from_duplicate(): void
    {
        $primaryId = $this->insertLead([
            'client_name' => 'Primary',
            'client_email' => null,
            'mobile' => null,
            'company_name' => null,
            'address' => null,
        ]);
        $duplicateId = $this->insertLead([
            'client_name' => 'Duplicate',
            'client_email' => 'from-dup@example.com',
            'mobile' => '555-0100',
            'company_name' => 'Dup Co',
            'address' => '1 Dup St',
        ]);

        $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 1);

        $primary = Lead::findOrFail($primaryId);
        $this->assertSame('from-dup@example.com', $primary->client_email);
        $this->assertSame('555-0100', $primary->mobile);
        $this->assertSame('Dup Co', $primary->company_name);
        $this->assertSame('1 Dup St', $primary->address);
    }

    public function test_merge_copies_email_onto_empty_primary_when_unique_index_exists(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->unique('client_email', 'leads_client_email_unique');
            $table->unique('client_whatsapp', 'leads_client_whatsapp_unique');
        });

        $primaryId = $this->insertLead([
            'client_name' => 'Primary Empty Email',
            'client_email' => null,
            'client_whatsapp' => null,
        ]);
        $duplicateId = $this->insertLead([
            'client_name' => 'Duplicate With Email',
            'client_email' => 'befus81@web.de',
            'client_whatsapp' => '+49123456789',
        ]);

        $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 177);

        $primary = Lead::findOrFail($primaryId);
        $this->assertSame('befus81@web.de', $primary->client_email);
        $this->assertSame('+49123456789', $primary->client_whatsapp);

        $trashed = Lead::withTrashed()->findOrFail($duplicateId);
        $this->assertTrue($trashed->trashed());
        $this->assertSame($primaryId, (int) $trashed->merged_into_lead_id);
        $this->assertStringStartsWith('invalid_lead_', (string) $trashed->client_email);
        $this->assertStringStartsWith('invalid_lead_', (string) $trashed->client_whatsapp);
    }

    public function test_keeps_primary_contact_value_and_creates_conflict_note(): void
    {
        $primaryId = $this->insertLead([
            'client_name' => 'Primary',
            'client_email' => 'keep@example.com',
            'mobile' => '111',
        ]);
        $duplicateId = $this->insertLead([
            'client_name' => 'Duplicate',
            'client_email' => 'discard@example.com',
            'mobile' => '222',
        ]);

        $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 1);

        $primary = Lead::findOrFail($primaryId);
        $this->assertSame('keep@example.com', $primary->client_email);
        $this->assertSame('111', $primary->mobile);

        $note = LeadNote::query()->where('lead_id', $primaryId)->where('title', 'Merged lead — previous contact details')->first();
        $this->assertNotNull($note);
        $this->assertStringContainsString('client_email', (string) $note->details);
        $this->assertStringContainsString('discard@example.com', (string) $note->details);

        $emails = DB::table('lead_contact_methods')->where('lead_id', $primaryId)->where('type', 'email')->get()->keyBy('normalized');
        $this->assertTrue((bool) $emails['keep@example.com']->is_main);
        $this->assertFalse((bool) $emails['discard@example.com']->is_main);
        $this->assertCount(2, $emails);

        $phones = DB::table('lead_contact_methods')->where('lead_id', $primaryId)->where('type', 'phone')->get()->keyBy('normalized');
        $this->assertTrue((bool) $phones['111']->is_main);
        $this->assertFalse((bool) $phones['222']->is_main);
    }

    public function test_applies_ownership_picks_and_defaults_missing_to_primary(): void
    {
        $primaryId = $this->insertLead([
            'client_name' => 'Primary',
            'client_email' => 'a@example.com',
            'lead_owner' => 10,
            'added_by' => 20,
            'client_id' => 30,
            'agent_id' => 40,
        ]);
        $duplicateId = $this->insertLead([
            'client_name' => 'Duplicate',
            'client_email' => 'b@example.com',
            'lead_owner' => 11,
            'added_by' => 21,
            'client_id' => 31,
            'agent_id' => 41,
        ]);

        $this->service->merge(
            Lead::findOrFail($primaryId),
            Lead::findOrFail($duplicateId),
            ['lead_owner' => 11],
            77,
        );

        $primary = Lead::findOrFail($primaryId);
        $this->assertSame(11, (int) $primary->lead_owner);
        $this->assertSame(20, (int) $primary->added_by);
        $this->assertSame(30, (int) $primary->client_id);
        $this->assertSame(40, (int) $primary->agent_id);
        $this->assertSame(77, (int) $primary->last_updated_by);
    }

    public function test_keeps_primary_marketing_and_discards_duplicate(): void
    {
        $primaryId = $this->insertLead(['client_name' => 'Primary', 'client_email' => 'a@example.com']);
        $duplicateId = $this->insertLead(['client_name' => 'Duplicate', 'client_email' => 'b@example.com']);

        DB::table('lead_marketing')->insert([
            ['lead_id' => $primaryId, 'utm_source' => 'primary-src', 'created_at' => now(), 'updated_at' => now()],
            ['lead_id' => $duplicateId, 'utm_source' => 'dup-src', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 1);

        $this->assertSame(1, LeadMarketing::query()->where('lead_id', $primaryId)->count());
        $this->assertSame('primary-src', LeadMarketing::query()->where('lead_id', $primaryId)->value('utm_source'));
        $this->assertSame(0, DB::table('lead_marketing')->where('lead_id', $duplicateId)->count());
    }

    public function test_reassigns_empty_custom_fields_and_notes_conflicts(): void
    {
        $primaryId = $this->insertLead(['client_name' => 'Primary', 'client_email' => 'a@example.com']);
        $duplicateId = $this->insertLead(['client_name' => 'Duplicate', 'client_email' => 'b@example.com']);

        DB::table('custom_fields')->insert([
            ['id' => 1, 'label' => 'Language', 'type' => 'text', 'required' => 'no'],
            ['id' => 2, 'label' => 'Budget', 'type' => 'text', 'required' => 'no'],
        ]);

        DB::table('custom_fields_data')->insert([
            [
                'custom_field_id' => 1,
                'model_id' => $duplicateId,
                'model' => Lead::CUSTOM_FIELD_MODEL,
                'value' => 'German',
            ],
            [
                'custom_field_id' => 2,
                'model_id' => $primaryId,
                'model' => Lead::CUSTOM_FIELD_MODEL,
                'value' => 'High',
            ],
            [
                'custom_field_id' => 2,
                'model_id' => $duplicateId,
                'model' => Lead::CUSTOM_FIELD_MODEL,
                'value' => 'Low',
            ],
        ]);

        $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 1);

        $moved = DB::table('custom_fields_data')
            ->where('model_id', $primaryId)
            ->where('custom_field_id', 1)
            ->value('value');
        $this->assertSame('German', $moved);

        $kept = DB::table('custom_fields_data')
            ->where('model_id', $primaryId)
            ->where('custom_field_id', 2)
            ->value('value');
        $this->assertSame('High', $kept);

        $leftOnDuplicate = DB::table('custom_fields_data')
            ->where('model_id', $duplicateId)
            ->where('custom_field_id', 2)
            ->value('value');
        $this->assertSame('Low', $leftOnDuplicate);

        $note = LeadNote::query()->where('lead_id', $primaryId)->where('title', 'Merged lead — previous contact details')->first();
        $this->assertNotNull($note);
        $this->assertStringContainsString('custom_field_2', (string) $note->details);
        $this->assertStringContainsString('Low', (string) $note->details);
    }

    public function test_rolls_back_all_changes_when_merge_fails(): void
    {
        $primaryId = $this->insertLead(['client_name' => 'Primary', 'client_email' => 'a@example.com']);
        $duplicateId = $this->insertLead(['client_name' => 'Duplicate', 'client_email' => 'b@example.com']);

        DB::table('deals')->insert([
            'lead_id' => $duplicateId,
            'company_id' => $this->companyId,
            'name' => 'Should Roll Back',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $listener = function (Lead $lead) {
            if ($lead->merged_into_lead_id) {
                throw new \RuntimeException('Forced merge failure');
            }
        };
        Lead::updating($listener);

        try {
            $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 1);
            $this->fail('Expected merge to throw');
        } catch (\RuntimeException $e) {
            $this->assertSame('Forced merge failure', $e->getMessage());
        } finally {
            Lead::getEventDispatcher()->forget('eloquent.updating: '.Lead::class);
        }

        $this->assertSame($duplicateId, (int) DB::table('deals')->where('name', 'Should Roll Back')->value('lead_id'));
        $this->assertNotNull(Lead::find($duplicateId));
        $this->assertNull(Lead::withTrashed()->find($duplicateId)?->merged_into_lead_id);
        $this->assertSame(0, DB::table('lead_contact_methods')->count());
    }

    public function test_build_review_returns_counts_conflicts_and_ownership_view(): void
    {
        $primaryId = $this->insertLead([
            'client_name' => 'Primary',
            'client_email' => 'primary@example.com',
            'mobile' => '111',
            'lead_owner' => 10,
            'added_by' => 20,
        ]);
        $duplicateId = $this->insertLead([
            'client_name' => 'Duplicate',
            'client_email' => 'dup@example.com',
            'mobile' => '111',
            'lead_owner' => 11,
            'added_by' => 20,
        ]);

        DB::table('deals')->insert([
            'lead_id' => $duplicateId,
            'company_id' => $this->companyId,
            'name' => 'Dup Deal',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('lead_notes')->insert([
            'lead_id' => $primaryId,
            'title' => 'Note',
            'details' => 'Details',
            'type' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $review = $this->service->buildReview(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId));

        $this->assertSame(
            ['primary' => 'primary@example.com', 'duplicate' => 'dup@example.com'],
            $review['contact_conflicts']['client_email'],
        );
        $this->assertArrayNotHasKey('mobile', $review['contact_conflicts']);

        $ownershipByField = collect($review['ownership_fields'])->keyBy('field');
        $this->assertTrue($ownershipByField['lead_owner']['differs']);
        $this->assertSame(10, $ownershipByField['lead_owner']['primary_value']);
        $this->assertSame(11, $ownershipByField['lead_owner']['duplicate_value']);
        $this->assertFalse($ownershipByField['added_by']['differs']);

        $this->assertSame(0, $review['counts']['primary']['deals']);
        $this->assertSame(1, $review['counts']['duplicate']['deals']);
        $this->assertSame(1, $review['counts']['primary']['notes']);
        $this->assertSame(0, $review['counts']['duplicate']['notes']);
    }

    public function test_build_review_throws_for_already_merged_duplicate(): void
    {
        $primaryId = $this->insertLead(['client_name' => 'Primary', 'client_email' => 'a@example.com']);
        $duplicateId = $this->insertLead([
            'client_name' => 'Duplicate',
            'client_email' => 'b@example.com',
            'merged_into_lead_id' => $primaryId,
        ]);

        $this->expectException(\InvalidArgumentException::class);

        $this->service->buildReview(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId));
    }

    public function test_find_duplicates_by_email_and_phone_excludes_trashed(): void
    {
        $leadId = $this->insertLead([
            'client_name' => 'Source',
            'client_email' => 'shared@example.com',
            'mobile' => '999-0000',
            'cell' => null,
        ]);
        $emailMatchId = $this->insertLead([
            'client_name' => 'Email Match',
            'client_email' => 'shared@example.com',
            'mobile' => '111',
        ]);
        $phoneMatchId = $this->insertLead([
            'client_name' => 'Phone Match',
            'client_email' => 'other@example.com',
            'mobile' => '999-0000',
        ]);
        $trashedId = $this->insertLead([
            'client_name' => 'Trashed Match',
            'client_email' => 'shared@example.com',
            'mobile' => '222',
        ]);
        Lead::findOrFail($trashedId)->delete();

        $detector = app(LeadDuplicateDetectionService::class);
        $ids = $detector->findDuplicates(Lead::findOrFail($leadId))->pluck('id')->all();

        $this->assertContains($emailMatchId, $ids);
        $this->assertContains($phoneMatchId, $ids);
        $this->assertNotContains($trashedId, $ids);
        $this->assertNotContains($leadId, $ids);
    }

    public function test_merge_seeds_primary_mains_when_lead_had_no_method_rows(): void
    {
        $primaryId = $this->insertLead([
            'client_name' => 'Primary',
            'client_email' => 'keep@example.com',
            'mobile' => '111',
        ]);
        $duplicateId = $this->insertLead([
            'client_name' => 'Duplicate',
            'client_email' => 'keep@example.com',
            'mobile' => '111',
        ]);

        $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 1);

        $rows = DB::table('lead_contact_methods')->where('lead_id', $primaryId)->get();
        $this->assertTrue($rows->contains(fn ($row) => $row->type === 'email' && $row->normalized === 'keep@example.com' && (bool) $row->is_main));
        $this->assertTrue($rows->contains(fn ($row) => $row->type === 'phone' && $row->normalized === '111' && (bool) $row->is_main));
    }

    public function test_merge_empty_primary_email_becomes_main_not_alternate(): void
    {
        $primaryId = $this->insertLead(['client_name' => 'Primary', 'client_email' => null, 'mobile' => '111']);
        $duplicateId = $this->insertLead(['client_name' => 'Duplicate', 'client_email' => 'from-dup@example.com', 'mobile' => '111']);

        $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 1);

        $this->assertSame('from-dup@example.com', Lead::findOrFail($primaryId)->client_email);

        $emails = DB::table('lead_contact_methods')->where('lead_id', $primaryId)->where('type', 'email')->get();
        $this->assertCount(1, $emails);
        $this->assertSame('from-dup@example.com', $emails->first()->normalized);
        $this->assertTrue((bool) $emails->first()->is_main);
    }

    public function test_merge_dedupes_conflicting_phones_by_normalized_value(): void
    {
        $primaryId = $this->insertLead([
            'client_name' => 'Primary',
            'client_email' => 'a@example.com',
            'mobile' => '111',
            'cell' => '111',
            'office' => '333',
        ]);
        $duplicateId = $this->insertLead([
            'client_name' => 'Duplicate',
            'client_email' => 'a@example.com',
            'mobile' => '222',
            'cell' => '222',
            'office' => '333',
        ]);

        $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 1);

        $phones = DB::table('lead_contact_methods')
            ->where('lead_id', $primaryId)
            ->where('type', 'phone')
            ->get()
            ->keyBy('normalized');

        $this->assertCount(3, $phones);
        $this->assertTrue((bool) $phones['111']->is_main);
        $this->assertFalse((bool) $phones['222']->is_main);
        $this->assertFalse((bool) $phones['333']->is_main);
    }

    public function test_merge_does_not_persist_invalidated_unique_values_as_methods(): void
    {
        $primaryId = $this->insertLead(['client_name' => 'Primary', 'client_email' => 'keep@example.com']);
        $duplicateId = $this->insertLead(['client_name' => 'Duplicate', 'client_email' => 'discard@example.com']);

        $this->service->merge(Lead::findOrFail($primaryId), Lead::findOrFail($duplicateId), [], 1);

        $identifiers = DB::table('lead_contact_methods')->pluck('identifier')->all();
        foreach ($identifiers as $identifier) {
            $this->assertStringStartsNotWith('invalid_lead_', (string) $identifier);
        }

        $trashedEmail = Lead::withTrashed()->findOrFail($duplicateId)->client_email;
        $this->assertStringStartsWith('invalid_lead_', (string) $trashedEmail);
    }

    public function test_find_duplicates_via_alternate_contact_method(): void
    {
        $leadId = $this->insertLead([
            'client_name' => 'Source',
            'client_email' => 'source@example.com',
            'mobile' => '111',
        ]);
        $matchId = $this->insertLead([
            'client_name' => 'Has Alternate',
            'client_email' => 'other@example.com',
            'mobile' => '999',
        ]);
        $this->insertLead([
            'client_name' => 'Unrelated',
            'client_email' => 'unrelated@example.com',
            'mobile' => '888',
        ]);

        DB::table('lead_contact_methods')->insert([
            'lead_id' => $matchId,
            'company_id' => $this->companyId,
            'type' => 'email',
            'identifier' => 'source@example.com',
            'normalized' => 'source@example.com',
            'is_main' => false,
            'source_field' => 'client_email',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $detector = app(LeadDuplicateDetectionService::class);
        $ids = $detector->findDuplicates(Lead::findOrFail($leadId))->pluck('id')->all();

        $this->assertContains($matchId, $ids);
        $this->assertNotContains($leadId, $ids);
    }

    public function test_duplicate_detection_is_not_registered_on_scheduler(): void
    {
        $kernel = file_get_contents(app_path('Console/Kernel.php'));
        $this->assertIsString($kernel);
        $this->assertStringNotContainsString('LeadDuplicate', $kernel);
        $this->assertStringNotContainsString('findDuplicates', $kernel);
        $this->assertStringNotContainsStringIgnoringCase('lead merge duplicate', $kernel);
    }

    private function bindCrmEventMock(): void
    {
        $this->recordedCrmEvents = [];

        $mock = Mockery::mock(CrmEventService::class);
        $mock->shouldReceive('record')
            ->andReturnUsing(function (array $params) {
                $this->recordedCrmEvents[] = $params;

                return null;
            });

        $this->app->instance(CrmEventService::class, $mock);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('custom_fields_data');
        Schema::dropIfExists('custom_fields');
        Schema::dropIfExists('taskables');
        Schema::dropIfExists('lead_follow_up');
        Schema::dropIfExists('lead_flight_itineraries');
        Schema::dropIfExists('communication_activities');
        Schema::dropIfExists('lead_qualifications');
        Schema::dropIfExists('lead_notes');
        Schema::dropIfExists('lead_marketing');
        Schema::dropIfExists('lead_contact_methods');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name')->nullable();
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
            $table->string('company_name')->nullable();
            $table->text('address')->nullable();
            $table->string('client_whatsapp')->nullable();
            $table->string('client_telegram')->nullable();
            $table->string('client_instagram')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->timestamp('assigned_at')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('client_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->unsignedInteger('merged_into_lead_id')->nullable();
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

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('title')->nullable();
            $table->text('details')->nullable();
            $table->integer('type')->default(0);
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_qualifications', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('lead_id');
            $table->string('template_id');
            $table->unsignedInteger('template_version');
            $table->unsignedInteger('agent_id');
            $table->string('status')->default('inProgress');
            $table->timestamp('started_at')->nullable();
            $table->timestamps();
        });

        Schema::create('communication_activities', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('channel')->nullable();
            $table->timestamp('timestamp')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_flight_itineraries', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->timestamps();
        });

        Schema::create('taskables', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->unsignedInteger('taskable_id');
            $table->string('taskable_type');
            $table->timestamps();
        });

        Schema::create('lead_marketing', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('utm_source')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_fields', function (Blueprint $table) {
            $table->increments('id');
            $table->string('label')->nullable();
            $table->string('type', 10)->nullable();
            $table->enum('required', ['yes', 'no'])->default('no');
        });

        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('custom_field_id');
            $table->unsignedInteger('model_id');
            $table->string('model')->nullable();
            $table->string('value', 1000);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
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
            'mobile' => null,
            'cell' => null,
            'office' => null,
            'company_name' => null,
            'address' => null,
            'client_whatsapp' => null,
            'client_telegram' => null,
            'client_instagram' => null,
            'lead_owner' => null,
            'added_by' => null,
            'client_id' => null,
            'agent_id' => null,
            'last_updated_by' => null,
            'merged_into_lead_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
