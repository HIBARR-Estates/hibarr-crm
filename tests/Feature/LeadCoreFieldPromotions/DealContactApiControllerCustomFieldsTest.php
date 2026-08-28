<?php

namespace Tests\Feature\LeadCoreFieldPromotions;

use App\Http\Controllers\Api\DealContactApiController;
use App\Models\Lead;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\LeadCoreFieldsTestCase;

class DealContactApiControllerCustomFieldsTest extends LeadCoreFieldsTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->resetSchema();
        $this->createMinimalSchema();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    /**
     * A promoted field (e.g. "nationality") now lives on the leads.nationality
     * core column. If a caller still submits its legacy custom-field ID via
     * lead_custom_fields, applyLeadCustomFields() must not also write it to
     * custom_fields_data — that would leave a stale legacy value alongside
     * the core column with no way to tell which one is authoritative.
     */
    public function test_promoted_field_id_is_not_written_to_custom_fields_data(): void
    {
        $companyId = $this->seedCompany();
        $nationalityFieldId = $this->seedCustomField($companyId, 'nationality');
        $noteFieldId = $this->seedCustomField($companyId, 'custom-note');
        $leadId = $this->seedLead($companyId);

        $lead = Lead::withoutGlobalScopes()->findOrFail($leadId);

        $request = new Request([
            'lead_custom_fields' => [
                (string) $nationalityFieldId => 'Legacy Nationality Value',
                (string) $noteFieldId => 'hello',
            ],
        ]);

        $controller = new DealContactApiController;
        $method = new \ReflectionMethod($controller, 'applyLeadCustomFields');
        $method->setAccessible(true);
        $method->invoke($controller, $lead, $request);

        $this->assertDatabaseMissing('custom_fields_data', [
            'custom_field_id' => $nationalityFieldId,
            'model_id' => $leadId,
        ]);

        $this->assertDatabaseHas('custom_fields_data', [
            'custom_field_id' => $noteFieldId,
            'model_id' => $leadId,
            'value' => 'hello',
        ]);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('custom_fields_data');
        Schema::dropIfExists('custom_fields');
        Schema::dropIfExists('custom_field_groups');
        Schema::dropIfExists('language_settings');
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

        Schema::create('custom_field_groups', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('model');
            $table->timestamps();
        });

        Schema::create('custom_fields', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('custom_field_group_id')->nullable();
            $table->string('label');
            $table->string('name');
            $table->string('type')->default('text');
            $table->string('required')->default('no');
        });

        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('custom_field_id');
            $table->unsignedInteger('model_id');
            $table->string('model')->nullable();
            $table->text('value')->nullable();
        });

        Schema::create('language_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('language_code');
            $table->string('language_name');
            $table->string('status')->default('enabled');
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->string('client_email')->nullable();
            $table->integer('column_priority')->default(0);
            $table->string('next_follow_up')->default('no');
            $table->json('languages')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('nationality')->nullable();
            $table->string('occupation')->nullable();
            $table->timestamps();
        });
    }

    private function seedCompany(): int
    {
        return \DB::table('companies')->insertGetId([
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedLead(int $companyId, array $extra = []): int
    {
        return \DB::table('leads')->insertGetId(array_merge([
            'company_id' => $companyId,
            'client_name' => 'Test Lead',
            'client_email' => 'lead@example.com',
            'column_priority' => 0,
            'next_follow_up' => 'no',
            'created_at' => now(),
            'updated_at' => now(),
        ], $extra));
    }

    private function seedCustomField(int $companyId, string $name): int
    {
        \DB::table('custom_field_groups')->updateOrInsert(
            ['company_id' => $companyId, 'model' => Lead::CUSTOM_FIELD_MODEL],
            ['created_at' => now(), 'updated_at' => now()]
        );

        $groupId = \DB::table('custom_field_groups')
            ->where('company_id', $companyId)
            ->where('model', Lead::CUSTOM_FIELD_MODEL)
            ->value('id');

        return \DB::table('custom_fields')->insertGetId([
            'company_id' => $companyId,
            'custom_field_group_id' => $groupId,
            'label' => ucfirst($name),
            'name' => $name,
            'type' => 'text',
            'required' => 'no',
        ]);
    }
}
