<?php

namespace Tests\Feature;

use App\Enums\PreferredContactTime;
use App\Http\Requests\Lead\PatchRequest;
use App\Models\Lead;
use App\Services\LeadService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class LeadPreferredContactTimeTest extends TestCase
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
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_preferred_contact_time_can_be_set_to_each_allowed_value_and_persists(): void
    {
        foreach (PreferredContactTime::cases() as $case) {
            $leadId = $this->insertLead(['client_name' => 'Lead '.$case->value]);

            $lead = Lead::findOrFail($leadId);
            $lead->preferred_contact_time = $case->value;
            $lead->save();

            $fresh = Lead::findOrFail($leadId);
            $this->assertInstanceOf(PreferredContactTime::class, $fresh->preferred_contact_time);
            $this->assertSame($case, $fresh->preferred_contact_time);
        }
    }

    public function test_lead_can_have_no_preferred_contact_time_set(): void
    {
        $leadId = $this->insertLead(['client_name' => 'No Preference']);

        $lead = Lead::findOrFail($leadId);

        $this->assertNull($lead->preferred_contact_time);
    }

    public function test_validation_rejects_preferred_contact_time_outside_allowed_values(): void
    {
        try {
            $this->validatePreferredContactTimeOnPatchRequest('midnight');
            $this->fail('Expected preferred_contact_time validation to fail.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('preferred_contact_time', $e->errors());
        }
    }

    public function test_validation_allows_null_preferred_contact_time(): void
    {
        $this->validatePreferredContactTimeOnPatchRequest(null);

        $this->addToAssertionCount(1);
    }

    public function test_validation_allows_each_preferred_contact_time_value(): void
    {
        foreach (PreferredContactTime::cases() as $case) {
            $this->validatePreferredContactTimeOnPatchRequest($case->value);
        }

        $this->addToAssertionCount(count(PreferredContactTime::cases()));
    }

    public function test_filter_by_preferred_contact_time_returns_only_matching_leads(): void
    {
        $morningId = $this->insertLead([
            'client_name' => 'Morning Lead',
            'preferred_contact_time' => 'morning',
        ]);
        $this->insertLead([
            'client_name' => 'Evening Lead',
            'preferred_contact_time' => 'evening',
        ]);
        $this->insertLead(['client_name' => 'No Preference Lead']);

        $request = Request::create('/lead-contact', 'GET', ['preferred_contact_time' => 'morning']);

        $applyFilters = new \ReflectionMethod(LeadService::class, 'applyFilters');
        $applyFilters->setAccessible(true);

        $query = Lead::query();
        $applyFilters->invoke(app(LeadService::class), $query, $request);

        $ids = $query->pluck('id')->all();

        $this->assertSame([$morningId], $ids);
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
            $table->string('preferred_contact_time')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
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

    private function validatePreferredContactTimeOnPatchRequest(mixed $value): void
    {
        $request = PatchRequest::create('/lead-contact/1', 'PATCH', [
            'preferred_contact_time' => $value,
        ]);
        $request->setContainer($this->app);
        $request->setRedirector($this->app->make('redirect'));
        $request->validateResolved();
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
            'preferred_contact_time' => null,
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
