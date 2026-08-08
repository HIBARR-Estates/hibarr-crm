<?php

namespace Tests\Feature;

use App\Enums\LeadTemperature;
use App\Models\Lead;
use App\Services\CrmEventService;
use App\Services\LeadService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Mockery;
use Tests\TestCase;

class LeadTemperatureTest extends TestCase
{
    private int $companyId = 1;

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
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_temperature_can_be_set_to_each_allowed_value_and_persists(): void
    {
        foreach (LeadTemperature::cases() as $case) {
            $leadId = $this->insertLead(['client_name' => 'Lead ' . $case->value]);

            $lead = Lead::findOrFail($leadId);
            $lead->temperature = $case->value;
            $lead->save();

            $fresh = Lead::findOrFail($leadId);
            $this->assertInstanceOf(LeadTemperature::class, $fresh->temperature);
            $this->assertSame($case, $fresh->temperature);
        }
    }

    public function test_lead_can_have_no_temperature_set(): void
    {
        $leadId = $this->insertLead(['client_name' => 'No Temp']);

        $lead = Lead::findOrFail($leadId);

        $this->assertNull($lead->temperature);
    }

    public function test_validation_rejects_temperature_outside_allowed_values(): void
    {
        $validator = Validator::make(
            ['temperature' => 'lukewarm'],
            ['temperature' => ['nullable', 'in:' . implode(',', LeadTemperature::values())]]
        );

        $this->assertTrue($validator->fails());
    }

    public function test_validation_allows_null_temperature(): void
    {
        $validator = Validator::make(
            ['temperature' => null],
            ['temperature' => ['nullable', 'in:' . implode(',', LeadTemperature::values())]]
        );

        $this->assertFalse($validator->fails());
    }

    public function test_temperature_change_fires_lead_updated_crm_event(): void
    {
        $leadId = $this->insertLead(['client_name' => 'Event Lead']);

        $lead = Lead::findOrFail($leadId);
        $lead->temperature = 'hot';
        $lead->save();

        $temperatureEvents = array_filter(
            $this->recordedCrmEvents,
            fn (array $event) => ($event['event_type_slug'] ?? null) === 'lead_updated'
                && ($event['metadata']['to_temperature'] ?? null) === 'hot'
        );

        $this->assertNotEmpty($temperatureEvents);
    }

    public function test_unrelated_field_change_does_not_fire_temperature_event(): void
    {
        $leadId = $this->insertLead(['client_name' => 'Untouched']);

        $lead = Lead::findOrFail($leadId);
        $lead->client_name = 'Renamed';
        $lead->save();

        $temperatureEvents = array_filter(
            $this->recordedCrmEvents,
            fn (array $event) => ($event['event_type_slug'] ?? null) === 'lead_updated'
        );

        $this->assertEmpty($temperatureEvents);
    }

    public function test_filter_by_temperature_returns_only_matching_leads(): void
    {
        $hotId = $this->insertLead(['client_name' => 'Hot Lead', 'temperature' => 'hot']);
        $this->insertLead(['client_name' => 'Cold Lead', 'temperature' => 'cold']);
        $this->insertLead(['client_name' => 'No Temp Lead']);

        $request = Request::create('/lead-contact', 'GET', ['temperature' => 'hot']);

        $applyFilters = new \ReflectionMethod(LeadService::class, 'applyFilters');
        $applyFilters->setAccessible(true);

        $query = Lead::query();
        $applyFilters->invoke(app(LeadService::class), $query, $request);

        $ids = $query->pluck('id')->all();

        $this->assertSame([$hotId], $ids);
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
            $table->string('gender')->nullable();
            $table->string('temperature')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
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
    private function insertLead(array $attributes): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'client_email' => null,
            'mobile' => null,
            'gender' => null,
            'temperature' => null,
            'lead_owner' => null,
            'added_by' => null,
            'last_updated_by' => null,
            'merged_into_lead_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
