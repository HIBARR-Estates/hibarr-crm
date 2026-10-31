<?php

namespace Tests\Feature\Migration;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CrmInventoryReportCommandTest extends TestCase
{
    private const PII_EMAIL = 'duplicate@example.com';

    private const PII_PHONE = '+15551234567';

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedInventoryFixture();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_json_report_has_expected_counts_without_pii_and_without_mutations(): void
    {
        $leadsBefore = DB::table('leads')->count();
        $methodsBefore = DB::table('lead_contact_methods')->count();
        $dealsBefore = DB::table('deals')->count();

        $exit = Artisan::call('migration:inventory-report', [
            '--format' => 'json',
            '--connection' => 'sqlite',
            '--env-label' => 'testing',
        ]);

        $this->assertSame(0, $exit);
        $output = Artisan::output();

        $this->assertStringNotContainsString(self::PII_EMAIL, $output);
        $this->assertStringNotContainsString(self::PII_PHONE, $output);
        $this->assertStringNotContainsString('15551234567', $output);

        $report = json_decode($output, true);
        $this->assertIsArray($report);
        $this->assertSame('crm', $report['system']);
        $this->assertSame(1, $report['report_version']);
        $this->assertSame('testing', $report['environment']);

        $entities = collect($report['entities'])->keyBy('key');
        $this->assertSame(2, $entities['leads']['metrics']['active']);
        $this->assertSame(1, $entities['leads']['metrics']['soft_deleted']);
        $this->assertSame(1, $entities['leads']['metrics']['merged']);
        $this->assertSame(1, $entities['deals']['metrics']['total']);
        $this->assertSame(3, $entities['contact_methods']['metrics']['total']);
        $this->assertSame(0, $entities['mlm_disputes']['metrics']['total']);
        $this->assertSame(2, $entities['custom_fields']['metrics']['definitions_total']);
        $this->assertSame(1, $entities['custom_fields']['metrics']['definitions_with_any_value']);
        $this->assertSame(1, $entities['custom_fields']['metrics']['definitions_empty']);

        $duplicates = collect($report['duplicates'])->keyBy('key');
        $this->assertGreaterThanOrEqual(1, $duplicates['people_by_email']['metrics']['duplicate_groups']);
        $this->assertGreaterThanOrEqual(1, $duplicates['people_by_email']['metrics']['extra_rows']);

        $usageKeys = collect($report['usage'])->pluck('key');
        $this->assertTrue($usageKeys->contains('zero_rows_mlm_disputes'));
        $this->assertTrue($usageKeys->contains('custom_fields_empty'));

        $this->assertSame($leadsBefore, DB::table('leads')->count());
        $this->assertSame($methodsBefore, DB::table('lead_contact_methods')->count());
        $this->assertSame($dealsBefore, DB::table('deals')->count());
    }

    public function test_markdown_format_renders_without_pii(): void
    {
        $exit = Artisan::call('migration:inventory-report', [
            '--format' => 'markdown',
            '--connection' => 'sqlite',
            '--section' => ['entities', 'duplicates'],
        ]);

        $this->assertSame(0, $exit);
        $output = Artisan::output();
        $this->assertStringContainsString('### CRM inventory', $output);
        $this->assertStringContainsString('| `leads` |', $output);
        $this->assertStringNotContainsString(self::PII_EMAIL, $output);
    }

    private function resetSchema(): void
    {
        Schema::dropAllTables();
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
            $table->unsignedInteger('merged_into_lead_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('name')->nullable();
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
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('heading')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('taskables', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->string('taskable_type');
            $table->unsignedInteger('taskable_id');
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->timestamps();
        });

        Schema::create('reminders', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('status')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_notes', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_contact_files', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_files', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_fields', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('label')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('custom_field_id');
            $table->string('model')->nullable();
            $table->unsignedInteger('model_id')->nullable();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_qualifications', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_qualification_answers', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_qualification_id')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('agent_hierarchy', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('ancestor_id');
            $table->unsignedInteger('descendant_id');
            $table->unsignedInteger('depth')->default(0);
            $table->timestamps();
        });

        Schema::create('mlm_levels', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('mlm_cycles', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('mlm_commission_disputes', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('partner_flags', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });

        Schema::create('commissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });
    }

    private function seedInventoryFixture(): void
    {
        DB::table('companies')->insert([
            'id' => 1,
            'company_name' => 'Inventory Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $leadA = (int) DB::table('leads')->insertGetId([
            'company_id' => 1,
            'client_name' => 'Lead A',
            'client_email' => self::PII_EMAIL,
            'mobile' => self::PII_PHONE,
            'merged_into_lead_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $leadB = (int) DB::table('leads')->insertGetId([
            'company_id' => 1,
            'client_name' => 'Lead B',
            'client_email' => self::PII_EMAIL,
            'mobile' => null,
            'merged_into_lead_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('leads')->insert([
            'company_id' => 1,
            'client_name' => 'Lead Merged',
            'client_email' => null,
            'mobile' => null,
            'merged_into_lead_id' => $leadA,
            'deleted_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ([$leadA, $leadB] as $leadId) {
            DB::table('lead_contact_methods')->insert([
                'lead_id' => $leadId,
                'company_id' => 1,
                'type' => 'email',
                'identifier' => self::PII_EMAIL,
                'normalized' => strtolower(self::PII_EMAIL),
                'is_main' => true,
                'source_field' => 'client_email',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('lead_contact_methods')->insert([
            'lead_id' => $leadA,
            'company_id' => 1,
            'type' => 'phone',
            'identifier' => self::PII_PHONE,
            'normalized' => '15551234567',
            'is_main' => true,
            'source_field' => 'mobile',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('deals')->insert([
            'company_id' => 1,
            'lead_id' => $leadA,
            'name' => 'Deal 1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $fieldUsed = (int) DB::table('custom_fields')->insertGetId([
            'company_id' => 1,
            'label' => 'Used Field',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('custom_fields')->insert([
            'company_id' => 1,
            'label' => 'Empty Field',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('custom_fields_data')->insert([
            'custom_field_id' => $fieldUsed,
            'model' => 'App\\Models\\Lead',
            'model_id' => $leadA,
            'value' => 'yes',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
