<?php

namespace Tests\Feature;

use App\Models\Lead;
use App\Services\CrmEventService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * The referrer (referred_by_agent_id) drives partner commission attribution,
 * so LeadObserver::saving() lets it be filled once and never reassigned.
 */
class LeadReferrerImmutableTest extends TestCase
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

        $crmEvents = Mockery::mock(CrmEventService::class);
        $crmEvents->shouldReceive('record')->andReturnNull();
        $this->app->instance(CrmEventService::class, $crmEvents);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_referrer_can_be_set_when_missing(): void
    {
        $lead = Lead::findOrFail($this->insertLead());

        $lead->referred_by_agent_id = 7;
        $lead->save();

        $this->assertSame(7, (int) Lead::findOrFail($lead->id)->referred_by_agent_id);
    }

    public function test_referrer_cannot_be_reassigned(): void
    {
        $lead = Lead::findOrFail($this->insertLead(['referred_by_agent_id' => 7]));

        $lead->referred_by_agent_id = 9;

        $this->expectException(\RuntimeException::class);

        try {
            $lead->save();
        } finally {
            $this->assertSame(7, (int) Lead::findOrFail($lead->id)->referred_by_agent_id);
        }
    }

    public function test_referrer_cannot_be_cleared(): void
    {
        $lead = Lead::findOrFail($this->insertLead(['referred_by_agent_id' => 7]));

        $lead->referred_by_agent_id = null;

        $this->expectException(\RuntimeException::class);

        $lead->save();
    }

    public function test_unrelated_edits_still_save_on_a_lead_that_has_a_referrer(): void
    {
        $lead = Lead::findOrFail($this->insertLead(['referred_by_agent_id' => 7]));

        $lead->client_name = 'Renamed';
        $lead->save();

        $this->assertSame('Renamed', Lead::findOrFail($lead->id)->client_name);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('notifications');
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
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->unsignedInteger('referred_by_agent_id')->nullable();
            $table->unsignedInteger('merged_into_lead_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
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
    private function insertLead(array $attributes = []): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'referred_by_agent_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
