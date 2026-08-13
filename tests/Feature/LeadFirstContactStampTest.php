<?php

namespace Tests\Feature;

use App\Models\Deal;
use App\Models\Lead;
use App\Services\CrmEventService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * leads.first_contacted_at is stamped by CrmEventService::record() rather than by
 * each emitter, so these cover the three things that make that work: only
 * configured slugs trigger it, deal-scoped events resolve back to their lead, and
 * the stamp never moves once set.
 */
class LeadFirstContactStampTest extends TestCase
{
    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('crm_events.first_contact.slugs', ['lead_note_added', 'deal_note_added']);

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedEventTypes(['lead_note_added', 'deal_note_added', 'lead_updated', 'lead_first_contact']);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_configured_slug_stamps_first_contacted_at(): void
    {
        $leadId = $this->insertLead();

        $this->record('lead_note_added', Lead::class, $leadId, '2026-08-01 09:00:00');

        $this->assertSame(
            '2026-08-01 09:00:00',
            DB::table('leads')->where('id', $leadId)->value('first_contacted_at')
        );
    }

    public function test_unconfigured_slug_does_not_stamp(): void
    {
        $leadId = $this->insertLead();

        $this->record('lead_updated', Lead::class, $leadId, '2026-08-01 09:00:00');

        $this->assertNull(DB::table('leads')->where('id', $leadId)->value('first_contacted_at'));
    }

    public function test_deal_scoped_event_resolves_back_to_its_lead(): void
    {
        $leadId = $this->insertLead();
        $dealId = $this->insertDeal($leadId);

        $this->record('deal_note_added', Deal::class, $dealId, '2026-08-02 11:30:00');

        $this->assertSame(
            '2026-08-02 11:30:00',
            DB::table('leads')->where('id', $leadId)->value('first_contacted_at')
        );
    }

    public function test_stamp_is_idempotent_and_keeps_the_earliest_contact(): void
    {
        $leadId = $this->insertLead();

        $this->record('lead_note_added', Lead::class, $leadId, '2026-08-01 09:00:00');
        $this->record('lead_note_added', Lead::class, $leadId, '2026-08-05 16:00:00');

        $this->assertSame(
            '2026-08-01 09:00:00',
            DB::table('leads')->where('id', $leadId)->value('first_contacted_at'),
            'A later activity must not move an existing first-contact stamp.'
        );
    }

    public function test_stamping_emits_a_lead_first_contact_event_exactly_once(): void
    {
        $leadId = $this->insertLead();

        $this->record('lead_note_added', Lead::class, $leadId, '2026-08-01 09:00:00');
        $this->record('lead_note_added', Lead::class, $leadId, '2026-08-05 16:00:00');

        $firstContactTypeId = DB::table('crm_event_types')->where('slug', 'lead_first_contact')->value('id');

        $this->assertSame(
            1,
            DB::table('crm_events')->where('event_type_id', $firstContactTypeId)->count()
        );
    }

    private function record(string $slug, string $modelType, int $modelId, string $occurredAt): void
    {
        app(CrmEventService::class)->record([
            'event_type_slug' => $slug,
            'company_id' => $this->companyId,
            'model_type' => $modelType,
            'model_id' => $modelId,
            'source' => 'observer',
            'occurred_at' => $occurredAt,
        ], forceSync: true);
    }

    private function insertLead(): int
    {
        return (int) DB::table('leads')->insertGetId([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'first_contacted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertDeal(int $leadId): int
    {
        return (int) DB::table('deals')->insertGetId([
            'company_id' => $this->companyId,
            'lead_id' => $leadId,
            'name' => 'Test Deal',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedEventTypes(array $slugs): void
    {
        DB::table('crm_event_categories')->insert([
            'id' => 1,
            'company_id' => null,
            'name' => 'Lead',
            'slug' => 'lead',
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($slugs as $index => $slug) {
            DB::table('crm_event_types')->insert([
                'id' => $index + 1,
                'company_id' => null,
                'category_id' => 1,
                'name' => $slug,
                'slug' => $slug,
                'is_active' => 1,
                'is_system' => 1,
                'sync_processing' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->timestamp('first_contacted_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('crm_event_categories', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('category_id');
            $table->string('name');
            $table->string('slug');
            $table->string('model_type')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('sync_processing')->default(true);
            $table->timestamps();
        });

        Schema::create('crm_events', function (Blueprint $table) {
            $table->increments('id');
            $table->string('uuid', 36);
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('event_type_id');
            $table->string('generation_type', 20)->default('user_generated');
            $table->string('status', 20)->default('completed');
            $table->string('direction', 10)->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedInteger('model_id')->nullable();
            $table->string('correlation_id', 36)->nullable();
            $table->unsignedInteger('causation_id')->nullable();
            $table->string('source', 20);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->text('metadata')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();
        });
    }

    private function resetSchema(): void
    {
        foreach (['crm_events', 'crm_event_types', 'crm_event_categories', 'deals', 'leads'] as $table) {
            Schema::dropIfExists($table);
        }
    }
}
