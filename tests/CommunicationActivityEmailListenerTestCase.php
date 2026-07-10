<?php

namespace Tests;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

abstract class CommunicationActivityEmailListenerTestCase extends TestCase
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
        Schema::dropIfExists('communication_activities');
        Schema::dropIfExists('pipeline_stages');
        Schema::dropIfExists('lead_pipelines');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('lead_lifecycle_statuses');
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
    }

    protected function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->unsignedInteger('default_lead_creator_id')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->string('mobile')->nullable();
            $table->string('phone')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->string('status')->default('enabled');
            $table->timestamps();
        });

        Schema::create('lead_lifecycle_statuses', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('key');
            $table->string('label');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('client_id')->nullable();
            $table->unsignedBigInteger('lead_lifecycle_status_id')->nullable();
            $table->string('client_name');
            $table->string('client_email')->nullable();
            $table->string('client_whatsapp')->nullable();
            $table->string('client_instagram')->nullable();
            $table->string('client_telegram')->nullable();
            $table->string('telegram_chat_id')->nullable();
            $table->string('mobile')->nullable();
            $table->string('cell')->nullable();
            $table->string('hash')->nullable();
            $table->unsignedBigInteger('agent_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->integer('column_priority')->default(0);
            $table->string('next_follow_up')->default('yes');
            $table->timestamps();
        });

        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->enum('default', ['0', '1'])->default('0');
            $table->timestamps();
        });

        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_pipeline_id');
            $table->string('name')->nullable();
            $table->enum('default', ['0', '1'])->default('0');
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->unsignedBigInteger('agent_id')->nullable();
            $table->string('name')->nullable();
            $table->decimal('value', 15, 2)->default(0);
            $table->unsignedInteger('currency_id')->nullable();
            $table->date('close_date')->nullable();
            $table->timestamps();
        });

        Schema::create('communication_activities', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('channel_type');
            $table->text('message_content')->nullable();
            $table->json('sender_info')->nullable();
            $table->timestamp('timestamp')->nullable();
            $table->json('metadata')->nullable();
            $table->string('email')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('resolution_status')->nullable();
            $table->unsignedInteger('resolution_attempts')->default(0);
            $table->timestamp('last_resolution_attempt_at')->nullable();
            $table->timestamps();
        });
    }

    protected function seedCompany(int $defaultLeadCreatorId = null): int
    {
        $companyId = (int) DB::table('companies')->insertGetId([
            'company_name' => 'Hibarr',
            'created_at' => now(),
            'updated_at' => now(),
            'default_lead_creator_id' => $defaultLeadCreatorId,
        ]);

        DB::table('lead_lifecycle_statuses')->insert([
            'company_id' => $companyId,
            'key' => 'new',
            'label' => 'New',
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $companyId;
    }

    protected function seedUser(int $companyId, string $email, string $name = 'Agent User'): int
    {
        return (int) DB::table('users')->insertGetId([
            'company_id' => $companyId,
            'name' => $name,
            'email' => $email,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function seedLeadAgent(int $companyId, int $userId): int
    {
        return (int) DB::table('lead_agents')->insertGetId([
            'company_id' => $companyId,
            'user_id' => $userId,
            'status' => 'enabled',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function seedPipeline(int $companyId): array
    {
        $pipelineId = (int) DB::table('lead_pipelines')->insertGetId([
            'company_id' => $companyId,
            'name' => 'Default',
            'default' => '1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $stageId = (int) DB::table('pipeline_stages')->insertGetId([
            'company_id' => $companyId,
            'lead_pipeline_id' => $pipelineId,
            'name' => 'New',
            'default' => '1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return ['pipeline_id' => $pipelineId, 'stage_id' => $stageId];
    }

    protected function seedLead(int $companyId, string $email, ?int $leadOwner = null, ?int $agentId = null): int
    {
        return (int) DB::table('leads')->insertGetId([
            'company_id' => $companyId,
            'client_name' => 'Existing Lead',
            'client_email' => $email,
            'lead_owner' => $leadOwner,
            'agent_id' => $agentId,
            'column_priority' => 0,
            'next_follow_up' => 'yes',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
