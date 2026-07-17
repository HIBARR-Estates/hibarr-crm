<?php

namespace Tests\Feature\LeadCoreFieldPromotions;

use App\Models\Lead;
use App\Services\LeadCoreFieldsService;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\Concerns\SetsFeatureFlags;
use Tests\LeadCoreFieldsTestCase;

class LeadCoreFieldsServiceTest extends LeadCoreFieldsTestCase
{
    use SetsFeatureFlags;

    private LeadCoreFieldsService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->service = app(LeadCoreFieldsService::class);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_flag_off_reads_from_custom_fields(): void
    {
        $this->setFeatureFlag('crm.lead-language-core-field', false);

        $companyId = $this->seedCompany();
        $leadId = $this->seedLead($companyId);
        $languageFieldId = $this->seedCustomField($companyId, 'language');
        $this->seedCustomFieldValue($languageFieldId, $leadId, 'German');

        $lead = Lead::withoutGlobalScopes()->findOrFail($leadId);
        $values = $this->service->read($lead);

        $this->assertSame(['de'], $values['languages']);
    }

    public function test_flag_on_reads_from_core_columns(): void
    {
        $this->setFeatureFlag('crm.lead-language-core-field', true);

        $companyId = $this->seedCompany();
        $leadId = $this->seedLead($companyId, [
            'languages' => json_encode(['en', 'de']),
            'nationality' => 'Germany',
            'occupation' => 'Engineer',
            'date_of_birth' => '1990-05-15',
        ]);

        $lead = Lead::withoutGlobalScopes()->findOrFail($leadId);
        $values = $this->service->read($lead);

        $this->assertSame(['en', 'de'], $values['languages']);
        $this->assertSame('1990-05-15', $values['date_of_birth']);
        $this->assertSame('Germany', $values['nationality']);
        $this->assertSame('Engineer', $values['occupation']);
    }

    public function test_flag_on_writes_core_columns_only(): void
    {
        $this->setFeatureFlag('crm.lead-language-core-field', true);

        $companyId = $this->seedCompany();
        $leadId = $this->seedLead($companyId);
        $lead = Lead::withoutGlobalScopes()->findOrFail($leadId);

        $this->service->write($lead, [
            'languages' => ['en'],
            'nationality' => 'Turkey',
            'occupation' => 'Agent',
            'date_of_birth' => '1985-01-20',
        ]);
        $lead->save();

        $lead->refresh();
        $this->assertSame(['en'], $lead->languages);
        $this->assertSame('Turkey', $lead->nationality);
        $this->assertSame('Agent', $lead->occupation);
        $this->assertSame('1985-01-20', $lead->date_of_birth?->format('Y-m-d'));
    }

    public function test_flag_off_write_is_noop(): void
    {
        $this->setFeatureFlag('crm.lead-language-core-field', false);

        $companyId = $this->seedCompany();
        $leadId = $this->seedLead($companyId);
        $lead = Lead::withoutGlobalScopes()->findOrFail($leadId);

        $this->service->write($lead, [
            'languages' => ['en'],
            'nationality' => 'Turkey',
        ]);
        $lead->save();
        $lead->refresh();

        $this->assertNull($lead->languages);
        $this->assertNull($lead->nationality);
    }

    public function test_filter_custom_fields_from_payload_when_flag_on(): void
    {
        $this->setFeatureFlag('crm.lead-language-core-field', true);

        $companyId = $this->seedCompany();
        $languageFieldId = $this->seedCustomField($companyId, 'language');
        $otherFieldId = $this->seedCustomField($companyId, 'custom-note');

        $filtered = $this->service->filterCustomFieldsFromPayload([
            'custom_fields_data' => [
                'language_' . $languageFieldId => 'de',
                'custom_note_' . $otherFieldId => 'hello',
            ],
        ], $companyId);

        $this->assertArrayNotHasKey('language_' . $languageFieldId, $filtered['custom_fields_data']);
        $this->assertArrayHasKey('custom_note_' . $otherFieldId, $filtered['custom_fields_data']);
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

        \DB::table('language_settings')->insert([
            ['language_code' => 'en', 'language_name' => 'English', 'status' => 'enabled', 'created_at' => now(), 'updated_at' => now()],
            ['language_code' => 'de', 'language_name' => 'German', 'status' => 'enabled', 'created_at' => now(), 'updated_at' => now()],
        ]);

        \DB::table('custom_field_groups')->insert([
            'id' => 1,
            'model' => 'App\Models\Lead',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
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
        return \DB::table('custom_fields')->insertGetId([
            'company_id' => $companyId,
            'custom_field_group_id' => 1,
            'label' => ucfirst($name),
            'name' => $name,
            'type' => 'text',
            'required' => 'no',
        ]);
    }

    private function seedCustomFieldValue(int $fieldId, int $leadId, string $value): void
    {
        \DB::table('custom_fields_data')->insert([
            'custom_field_id' => $fieldId,
            'model_id' => $leadId,
            'model' => 'App\Models\Lead',
            'value' => $value,
        ]);
    }
}
