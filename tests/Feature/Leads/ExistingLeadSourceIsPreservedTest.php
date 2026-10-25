<?php

namespace Tests\Feature\Leads;

use App\Http\Controllers\Api\DealContactApiController;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\LeadCoreFieldsTestCase;

/**
 * The backend pushes every lead it touches through contact/create and deal/create,
 * always with a lead_source_id (falling back to a default). Once a lead exists in
 * the CRM its source belongs to the CRM: a push may fill an empty source but must
 * never overwrite one that is already set.
 */
class ExistingLeadSourceIsPreservedTest extends LeadCoreFieldsTestCase
{
    private int $companyId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resetSchema();
        $this->createMinimalSchema();

        $this->companyId = DB::table('companies')->insertGetId([
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_existing_source_is_not_overwritten(): void
    {
        $originalSource = $this->seedSource('Referral');
        $pushedSource = $this->seedSource('Website');
        $leadId = $this->seedLead(['source_id' => $originalSource]);

        $this->resolveContact(['lead_source_id' => $pushedSource]);

        $this->assertSame($originalSource, (int) DB::table('leads')->where('id', $leadId)->value('source_id'));
    }

    public function test_empty_source_is_filled(): void
    {
        $pushedSource = $this->seedSource('Website');
        $leadId = $this->seedLead(['source_id' => null]);

        $this->resolveContact(['lead_source_id' => $pushedSource]);

        $this->assertSame($pushedSource, (int) DB::table('leads')->where('id', $leadId)->value('source_id'));
    }

    private function resolveContact(array $input): array
    {
        $request = new Request(array_merge([
            'name' => 'Test Lead',
            'email' => 'lead@example.com',
        ], $input));

        $controller = new DealContactApiController;
        $method = new \ReflectionMethod($controller, 'resolveContact');
        $method->setAccessible(true);

        return $method->invoke($controller, $request, $this->companyId);
    }

    private function seedSource(string $type): int
    {
        return DB::table('lead_sources')->insertGetId([
            'company_id' => $this->companyId,
            'type' => $type,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedLead(array $extra = []): int
    {
        return DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'client_email' => 'lead@example.com',
            'column_priority' => 0,
            'next_follow_up' => 'no',
            'created_at' => now(),
            'updated_at' => now(),
        ], $extra));
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_sources');
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

        Schema::create('lead_sources', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('type');
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->string('client_email')->nullable();
            $table->string('mobile')->nullable();
            $table->string('gender')->nullable();
            $table->unsignedInteger('source_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->integer('column_priority')->default(0);
            $table->string('next_follow_up')->default('no');
            $table->timestamps();
        });
    }
}
