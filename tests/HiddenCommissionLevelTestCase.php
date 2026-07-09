<?php

namespace Tests;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

abstract class HiddenCommissionLevelTestCase extends PerAgentCommissionOverrideTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        session(['check_migrate_status' => 'Good']);
    }

    protected function resetSchema(): void
    {
        Schema::dropIfExists('mlm_level_criteria');
        Schema::dropIfExists('agent_metrics');
        parent::resetSchema();
    }

    protected function createMinimalSchema(): void
    {
        parent::createMinimalSchema();

        Schema::create('agent_metrics', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('agent_id');
            $table->unsignedInteger('nsa')->default(0);
            $table->unsignedInteger('nsd')->default(0);
            $table->decimal('vsa', 15, 2)->default(0);
            $table->decimal('vsd', 15, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('mlm_level_criteria', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('mlm_level_id');
            $table->unsignedInteger('logic_group')->default(1);
            $table->string('metric', 20);
            $table->string('operator', 5)->default('>=');
            $table->decimal('threshold', 15, 2)->default(0);
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    protected function seedAgentMetrics(int $companyId, int $agentId, array $metrics = []): void
    {
        DB::table('agent_metrics')->insert(array_merge([
            'company_id' => $companyId,
            'agent_id' => $agentId,
            'nsa' => 0,
            'nsd' => 0,
            'vsa' => 0,
            'vsd' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ], $metrics));
    }

    protected function seedCriterion(int $levelId, string $metric, float $threshold, string $operator = '>='): void
    {
        DB::table('mlm_level_criteria')->insert([
            'mlm_level_id' => $levelId,
            'logic_group' => 1,
            'metric' => $metric,
            'operator' => $operator,
            'threshold' => $threshold,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
