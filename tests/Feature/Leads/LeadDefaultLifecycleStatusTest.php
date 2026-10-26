<?php

namespace Tests\Feature\Leads;

use App\Http\Requests\Contact\CreateOrUpdateContactRequest;
use App\Models\Lead;
use App\Services\LeadLifecycleStatusService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * Leads created with saveQuietly() (external API, Bitrix import) skip
 * LeadObserver::creating, so the default lifecycle status has to be applied
 * explicitly — and existing status-less leads get it from a backfill.
 */
class LeadDefaultLifecycleStatusTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->dropSchema();
        $this->createSchema();
    }

    protected function tearDown(): void
    {
        $this->dropSchema();
        parent::tearDown();
    }

    public function test_quietly_saved_lead_gets_company_default_status(): void
    {
        $newId = $this->insertStatus(1, 'new');
        $this->insertStatus(2, 'new');

        $lead = new Lead;
        $lead->company_id = 1;
        $lead->client_name = 'API lead';
        app(LeadLifecycleStatusService::class)->applyDefaultIfMissing($lead);
        $lead->saveQuietly();

        $this->assertSame($newId, (int) $lead->fresh()->lead_lifecycle_status_id);
    }

    public function test_explicit_status_is_kept(): void
    {
        $this->insertStatus(1, 'new');
        $qualifiedId = $this->insertStatus(1, 'qualified');

        $lead = new Lead;
        $lead->company_id = 1;
        $lead->lead_lifecycle_status_id = $qualifiedId;
        app(LeadLifecycleStatusService::class)->applyDefaultIfMissing($lead);

        $this->assertSame($qualifiedId, (int) $lead->lead_lifecycle_status_id);
    }

    public function test_company_without_default_status_is_left_unset(): void
    {
        $lead = new Lead;
        $lead->company_id = 1;
        app(LeadLifecycleStatusService::class)->applyDefaultIfMissing($lead);

        $this->assertNull($lead->lead_lifecycle_status_id);
    }

    public function test_backfill_sets_each_companys_default_only_on_status_less_leads(): void
    {
        $newA = $this->insertStatus(1, 'new');
        $qualifiedA = $this->insertStatus(1, 'qualified');
        $newB = $this->insertStatus(2, 'new');

        $missingA = $this->insertLead(1, null);
        $keptA = $this->insertLead(1, $qualifiedA);
        $missingB = $this->insertLead(2, null);
        $noDefault = $this->insertLead(3, null);

        $this->backfill()->up();

        $this->assertSame($newA, $this->statusOf($missingA));
        $this->assertSame($qualifiedA, $this->statusOf($keptA));
        $this->assertSame($newB, $this->statusOf($missingB));
        $this->assertNull($this->statusOf($noDefault));
    }

    public function test_backfill_keeps_a_status_a_user_deliberately_cleared(): void
    {
        $newId = $this->insertStatus(1, 'new');

        $cleared = $this->insertLead(1, null);
        $this->insertStatusChangeEvent($cleared);
        $missing = $this->insertLead(1, null);

        $this->backfill()->up();

        $this->assertNull($this->statusOf($cleared));
        $this->assertSame($newId, $this->statusOf($missing));
    }

    public function test_contact_api_rejects_another_companys_lifecycle_status(): void
    {
        $own = $this->insertStatus(1, 'qualified');
        $foreign = $this->insertStatus(2, 'qualified');

        $this->assertTrue($this->contactStatusRulePasses($own, 1));
        $this->assertFalse($this->contactStatusRulePasses($foreign, 1));
    }

    private function contactStatusRulePasses(int $statusId, int $companyId): bool
    {
        $request = CreateOrUpdateContactRequest::create('/api/contact/create', 'POST', [], [], [], [
            'HTTP_X_COMPANY_ID' => (string) $companyId,
        ]);
        $rule = $request->rules()['lead_lifecycle_status_id'];

        return Validator::make(
            ['lead_lifecycle_status_id' => $statusId],
            ['lead_lifecycle_status_id' => $rule],
        )->passes();
    }

    private function insertStatusChangeEvent(int $leadId): void
    {
        $typeId = DB::table('crm_event_types')->insertGetId([
            'slug' => 'lead_lifecycle_status_changed',
        ]);

        DB::table('crm_events')->insert([
            'event_type_id' => $typeId,
            'model_type' => Lead::class,
            'model_id' => $leadId,
        ]);
    }

    private function backfill(): Migration
    {
        return require database_path('migrations/2026_10_23_000001_backfill_default_lifecycle_status_on_leads.php');
    }

    private function statusOf(int $leadId): ?int
    {
        $value = DB::table('leads')->where('id', $leadId)->value('lead_lifecycle_status_id');

        return $value === null ? null : (int) $value;
    }

    private function insertStatus(int $companyId, string $key): int
    {
        return (int) DB::table('lead_lifecycle_statuses')->insertGetId([
            'company_id' => $companyId,
            'key' => $key,
            'label' => ucfirst($key),
        ]);
    }

    private function insertLead(int $companyId, ?int $statusId): int
    {
        return (int) DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'client_name' => 'Lead',
            'lead_lifecycle_status_id' => $statusId,
        ]);
    }

    private function dropSchema(): void
    {
        Schema::dropIfExists('crm_events');
        Schema::dropIfExists('crm_event_types');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('lead_lifecycle_statuses');
    }

    private function createSchema(): void
    {
        Schema::create('lead_lifecycle_statuses', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->string('key');
            $table->string('label');
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('slug');
        });

        Schema::create('crm_events', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('event_type_id');
            $table->string('model_type')->nullable();
            $table->unsignedInteger('model_id')->nullable();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name')->nullable();
            $table->unsignedInteger('lead_lifecycle_status_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }
}
