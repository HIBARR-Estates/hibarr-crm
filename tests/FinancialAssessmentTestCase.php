<?php

namespace Tests;

use App\Models\Lead;
use App\Services\FinancialAssessment\FinancialAssessmentDefaults;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Base for financial assessment tests that need a database. The full
 * migration set is MySQL-specific, so (like the qualification tests) this
 * builds just the tables the feature touches and then runs the feature's own
 * migrations on top, which also proves those migrations work on SQLite.
 */
abstract class FinancialAssessmentTestCase extends TestCase
{
    protected int $companyId = 1;

    protected int $userId = 1;

    /** @var list<string> */
    private const FEATURE_MIGRATIONS = [
        '2026_11_25_100000_create_financial_assessment_config_tables.php',
        '2026_11_25_100100_create_financial_assessments_tables.php',
        '2026_11_25_100200_add_financial_assessment_settings_to_lead_setting.php',
        '2026_11_27_100000_add_stale_notified_for_to_lead_financial_summaries.php',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');
        Cache::flush();

        $this->resetSchema();
        $this->createBaseSchema();

        foreach (self::FEATURE_MIGRATIONS as $file) {
            (require base_path('database/migrations/'.$file))->up();
        }

        DB::table('currencies')->insert([
            ['id' => 1, 'company_id' => $this->companyId, 'currency_code' => 'EUR'],
            ['id' => 2, 'company_id' => $this->companyId, 'currency_code' => 'USD'],
            ['id' => 3, 'company_id' => $this->companyId, 'currency_code' => 'GBP'],
        ]);
        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Acme', 'currency_id' => 1]);
        DB::table('users')->insert(['id' => $this->userId, 'company_id' => $this->companyId, 'name' => 'Agent']);

        FinancialAssessmentDefaults::seedForCompany($this->companyId);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    protected function resetSchema(): void
    {
        foreach ([
            'lead_financial_summaries', 'financial_assessment_lines', 'financial_assessments',
            'financial_crypto_assets', 'financial_assessment_line_types', 'financial_assessment_kinds',
            'lead_contact_files', 'lead_setting', 'leads', 'users', 'companies', 'currencies',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }

    protected function createBaseSchema(): void
    {
        Schema::create('currencies', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('currency_code');
            $table->string('is_cryptocurrency')->default('no');
        });

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->string('client_name')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('lead_contact_files', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id');
        });

        // Mirrors the real table: user_id is required, company_id optional.
        Schema::create('lead_setting', function (Blueprint $table) {
            $table->id();
            $table->boolean('status')->default(false);
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('company_id')->nullable();
            $table->timestamps();
        });
    }

    protected function makeLead(string $name = 'Elena'): Lead
    {
        $id = DB::table('leads')->insertGetId([
            'company_id' => $this->companyId,
            'client_name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Lead::withoutGlobalScopes()->findOrFail($id);
    }
}
