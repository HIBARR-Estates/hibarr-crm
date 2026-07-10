<?php

namespace Tests\Feature\LeadCoreFieldPromotions;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\LeadCoreFieldsTestCase;

class MigrationBackfillTest extends LeadCoreFieldsTestCase
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

    public function test_migration_backfills_core_fields_from_custom_fields(): void
    {
        $companyId = DB::table('companies')->insertGetId([
            'company_name' => 'Backfill Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'client_name' => 'Backfill Lead',
            'client_email' => 'backfill@example.com',
            'column_priority' => 0,
            'next_follow_up' => 'no',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $languageFieldId = $this->seedCustomField($companyId, 'language');
        $nationalityFieldId = $this->seedCustomField($companyId, 'nationality');
        $occupationFieldId = $this->seedCustomField($companyId, 'occupation');
        $dobFieldId = $this->seedCustomField($companyId, 'date-of-birth');

        $this->seedCustomFieldValue($languageFieldId, $leadId, 'German');
        $this->seedCustomFieldValue($nationalityFieldId, $leadId, 'Germany');
        $this->seedCustomFieldValue($occupationFieldId, $leadId, 'Consultant');
        $this->seedCustomFieldValue($dobFieldId, $leadId, '1992-03-10');

        Artisan::call('migrate', [
            '--path' => 'database/migrations/2026_06_11_000005_add_lead_core_fields_to_leads_table.php',
            '--force' => true,
        ]);

        $lead = DB::table('leads')->where('id', $leadId)->first();

        $this->assertSame('["de"]', $lead->languages);
        $this->assertSame('Germany', $lead->nationality);
        $this->assertSame('Consultant', $lead->occupation);
        $this->assertSame('1992-03-10', $lead->date_of_birth);
    }

    public function test_migration_prefers_existing_core_date_of_birth(): void
    {
        $companyId = DB::table('companies')->insertGetId([
            'company_name' => 'Dob Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'client_name' => 'Dob Lead',
            'client_email' => 'dob@example.com',
            'column_priority' => 0,
            'next_follow_up' => 'no',
            'date_of_birth' => '2000-01-01',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $dobFieldId = $this->seedCustomField($companyId, 'date-of-birth');
        $this->seedCustomFieldValue($dobFieldId, $leadId, '1992-03-10');

        Artisan::call('migrate', [
            '--path' => 'database/migrations/2026_06_11_000005_add_lead_core_fields_to_leads_table.php',
            '--force' => true,
        ]);

        $lead = DB::table('leads')->where('id', $leadId)->first();
        $this->assertSame('2000-01-01', $lead->date_of_birth);
    }

    public function test_migration_leaves_unparseable_dob_null(): void
    {
        $companyId = DB::table('companies')->insertGetId([
            'company_name' => 'Bad Dob Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $leadId = DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'client_name' => 'Bad Dob Lead',
            'client_email' => 'baddob@example.com',
            'column_priority' => 0,
            'next_follow_up' => 'no',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $dobFieldId = $this->seedCustomField($companyId, 'date-of-birth');
        $this->seedCustomFieldValue($dobFieldId, $leadId, 'not-a-real-date');

        Artisan::call('migrate', [
            '--path' => 'database/migrations/2026_06_11_000005_add_lead_core_fields_to_leads_table.php',
            '--force' => true,
        ]);

        $lead = DB::table('leads')->where('id', $leadId)->first();
        $this->assertNull($lead->date_of_birth);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('custom_fields_data');
        Schema::dropIfExists('custom_fields');
        Schema::dropIfExists('custom_field_groups');
        Schema::dropIfExists('language_settings');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('companies');
        Schema::dropIfExists('migrations');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('migrations', function (Blueprint $table) {
            $table->increments('id');
            $table->string('migration');
            $table->integer('batch');
        });

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
            $table->date('date_of_birth')->nullable();
            $table->timestamps();
        });

        DB::table('language_settings')->insert([
            ['language_code' => 'de', 'language_name' => 'German', 'status' => 'enabled', 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('custom_field_groups')->insert([
            'id' => 1,
            'model' => 'App\Models\Lead',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedCustomField(int $companyId, string $name): int
    {
        return DB::table('custom_fields')->insertGetId([
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
        DB::table('custom_fields_data')->insert([
            'custom_field_id' => $fieldId,
            'model_id' => $leadId,
            'model' => 'App\Models\Lead',
            'value' => $value,
        ]);
    }
}
