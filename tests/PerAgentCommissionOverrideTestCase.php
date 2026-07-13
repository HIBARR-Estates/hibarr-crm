<?php

namespace Tests;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

abstract class PerAgentCommissionOverrideTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    protected function resetSchema(): void
    {
        Schema::dropIfExists('agent_commission_rate_audit_logs');
        Schema::dropIfExists('mlm_commissions');
        Schema::dropIfExists('agent_level_history');
        Schema::dropIfExists('agent_hierarchy');
        Schema::dropIfExists('agent_cycle_enrollments');
        Schema::dropIfExists('mlm_cycle_level_snapshots');
        Schema::dropIfExists('mlm_cycles');
        Schema::dropIfExists('mlm_settings');
        Schema::dropIfExists('mlm_levels');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('users');
        Schema::dropIfExists('api_tokens');
        Schema::dropIfExists('companies');
    }

    protected function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->unsignedBigInteger('parent_agent_id')->nullable();
            $table->decimal('custom_direct_rate', 5, 2)->nullable();
            $table->decimal('custom_override_rate', 5, 2)->nullable();
            $table->string('status')->default('enabled');
            $table->timestamps();
        });

        Schema::create('mlm_levels', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->unsignedInteger('rank')->default(0);
            $table->decimal('commission_percentage', 5, 2)->default(0);
            $table->decimal('direct_rate', 5, 2)->default(0);
            $table->decimal('override_rate', 5, 2)->default(0);
            $table->boolean('is_hidden')->default(false);
            $table->timestamps();
        });

        Schema::create('mlm_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->decimal('max_commission_percentage', 5, 2)->default(10);
            $table->boolean('auto_evaluate_ancestors')->default(true);
            $table->boolean('enable_commission_reversal')->default(true);
            $table->boolean('auto_generate_cycles')->default(true);
            $table->string('default_cycle_duration_type')->default('monthly');
            $table->unsignedInteger('default_cycle_duration_days')->nullable();
            $table->decimal('default_overflow_multiplier', 5, 2)->default(1);
            $table->timestamps();
        });

        Schema::create('agent_level_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('level_id');
            $table->unsignedBigInteger('cycle_level_snapshot_id')->nullable();
            $table->timestamp('assigned_at')->useCurrent();
            $table->unsignedInteger('assigned_by')->nullable();
            $table->boolean('system_assigned')->default(false);
            $table->unsignedBigInteger('trigger_deal_id')->nullable();
            $table->timestamps();
        });

        Schema::create('agent_cycle_enrollments', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('cycle_id')->nullable();
            $table->string('status')->default('active');
            $table->date('effective_start_date')->nullable();
            $table->date('effective_end_date')->nullable();
            $table->timestamps();
        });

        Schema::create('agent_hierarchy', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ancestor_id');
            $table->unsignedBigInteger('descendant_id');
            $table->unsignedInteger('depth');
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('agent_id')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->decimal('max_commission_percentage', 5, 2)->nullable();
            $table->string('outcome_status')->nullable();
            $table->timestamps();
        });

        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('deal_id');
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('source_agent_id');
            $table->unsignedBigInteger('level_id')->nullable();
            $table->unsignedBigInteger('cycle_level_snapshot_id')->nullable();
            $table->decimal('percentage', 5, 2);
            $table->decimal('amount', 15, 2);
            $table->string('type', 20);
            $table->string('status', 20)->default('pending');
            $table->timestamps();
        });

        Schema::create('agent_commission_rate_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('agent_id');
            $table->unsignedInteger('changed_by_user_id')->nullable();
            $table->decimal('previous_direct_rate', 5, 2)->nullable();
            $table->decimal('new_direct_rate', 5, 2)->nullable();
            $table->decimal('previous_override_rate', 5, 2)->nullable();
            $table->decimal('new_override_rate', 5, 2)->nullable();
            $table->timestamp('changed_at');
            $table->text('reason')->nullable();
            $table->timestamps();
        });

        Schema::create('mlm_cycles', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('cycle_number')->default(1);
            $table->string('status')->default('active');
            $table->decimal('max_commission_snapshot', 5, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('mlm_cycle_level_snapshots', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('cycle_id');
            $table->unsignedBigInteger('source_level_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->unsignedInteger('rank')->default(0);
            $table->decimal('commission_percentage', 5, 2)->default(0);
            $table->decimal('direct_rate', 5, 2)->default(0);
            $table->decimal('override_rate', 5, 2)->default(0);
            $table->boolean('is_hidden')->default(false);
            $table->timestamps();
        });

        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('token');
            $table->unsignedInteger('company_id')->nullable();
            $table->boolean('revoked')->default(false);
            $table->timestamps();
        });
    }

    protected function seedCompany(): int
    {
        return DB::table('companies')->insertGetId([
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function seedUser(int $companyId, string $name = 'Test User'): int
    {
        return DB::table('users')->insertGetId([
            'name' => $name,
            'email' => strtolower(str_replace(' ', '.', $name)) . '@test.com',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function seedAgent(int $companyId, int $userId, ?int $parentId = null, array $extra = []): int
    {
        return DB::table('lead_agents')->insertGetId(array_merge([
            'company_id' => $companyId,
            'user_id' => $userId,
            'parent_agent_id' => $parentId,
            'status' => 'enabled',
            'created_at' => now(),
            'updated_at' => now(),
        ], $extra));
    }

    protected function seedLevel(int $companyId, string $name, int $rank, float $commissionPct, array $extra = []): int
    {
        return DB::table('mlm_levels')->insertGetId(array_merge([
            'company_id' => $companyId,
            'name' => $name,
            'slug' => strtolower($name),
            'rank' => $rank,
            'commission_percentage' => $commissionPct,
            'direct_rate' => $commissionPct,
            'override_rate' => $commissionPct,
            'is_hidden' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ], $extra));
    }

    protected function seedLevelHistory(int $companyId, int $agentId, int $levelId): void
    {
        DB::table('agent_level_history')->insert([
            'company_id' => $companyId,
            'agent_id' => $agentId,
            'level_id' => $levelId,
            'assigned_at' => now(),
            'system_assigned' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function seedHierarchyLink(int $ancestorId, int $descendantId, int $depth): void
    {
        DB::table('agent_hierarchy')->insert([
            'ancestor_id' => $ancestorId,
            'descendant_id' => $descendantId,
            'depth' => $depth,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function seedMlmSettings(int $companyId, float $maxCommission = 10): void
    {
        DB::table('mlm_settings')->insert([
            'company_id' => $companyId,
            'max_commission_percentage' => $maxCommission,
            'auto_evaluate_ancestors' => true,
            'enable_commission_reversal' => true,
            'auto_generate_cycles' => true,
            'default_cycle_duration_type' => 'monthly',
            'default_overflow_multiplier' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function seedDeal(int $companyId, int $agentId, float $value): int
    {
        return DB::table('deals')->insertGetId([
            'company_id' => $companyId,
            'agent_id' => $agentId,
            'value' => $value,
            'outcome_status' => 'won',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function seedApiToken(int $companyId, string $token = 'test-token'): void
    {
        DB::table('api_tokens')->insert([
            'token' => $token,
            'company_id' => $companyId,
            'revoked' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
