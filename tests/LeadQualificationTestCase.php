<?php

namespace Tests;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

abstract class LeadQualificationTestCase extends TestCase
{
    protected int $companyId = 1;

    protected int $userId = 1;

    protected int $leadId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedBaseData();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    protected function resetSchema(): void
    {
        Schema::dropIfExists('crm_events');
        Schema::dropIfExists('qualification_field_mappings');
        Schema::dropIfExists('qualification_script_settings');
        Schema::dropIfExists('lead_qualification_action_runs');
        Schema::dropIfExists('lead_qualification_answers');
        Schema::dropIfExists('lead_qualifications');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('lead_lifecycle_statuses');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('users');
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
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedInteger('user_id')->nullable();
            $table->text('payload')->nullable();
            $table->integer('last_activity')->nullable();
        });

        Schema::create('client_contacts', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_lifecycle_statuses', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('key');
            $table->string('label');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('label_color', 20)->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('lead_lifecycle_status_id')->nullable();
            $table->string('client_name');
            $table->string('client_email')->nullable();
            $table->string('mobile')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_qualifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('lead_id');
            $table->string('template_id');
            $table->unsignedInteger('template_version');
            $table->string('template_name')->nullable();
            $table->unsignedInteger('agent_id');
            $table->enum('status', ['inProgress', 'completed', 'abandoned'])->default('inProgress');
            $table->json('selected_branch_keys')->nullable();
            $table->enum('outcome', ['bookMeeting', 'inviteWebinar', 'callback', 'noFit'])->nullable();
            $table->json('outcomes')->nullable();
            $table->text('outcome_comment')->nullable();
            $table->timestamp('outcome_triggered_at')->nullable();
            $table->string('agent_language', 10)->nullable();
            $table->string('current_segment_key')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_qualification_answers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_qualification_id');
            $table->string('segment_key');
            $table->json('answer_values');
            $table->text('answer_text')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_qualification_action_runs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_qualification_id');
            $table->string('action_type', 64);
            $table->string('status', 32)->default('pending');
            $table->json('config')->nullable();
            $table->json('payload')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('qualification_script_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->string('template_id');
            $table->string('template_name')->nullable();
            $table->boolean('auto_write')->default(true);
            $table->timestamps();
        });

        Schema::create('qualification_field_mappings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('script_setting_id');
            $table->string('segment_key');
            $table->string('lead_field')->nullable();
            $table->string('write_mode', 32)->default('fill_empty');
            $table->json('option_map')->nullable();
            $table->timestamps();
        });

        Schema::create('crm_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('slug');
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    protected function seedBaseData(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->insert([
            'id' => $this->userId,
            'company_id' => $this->companyId,
            'name' => 'Agent One',
            'email' => 'agent@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach (\App\Models\LeadLifecycleStatus::defaultStatusDefinitions() as $status) {
            DB::table('lead_lifecycle_statuses')->insert(array_merge($status, [
                'company_id' => $this->companyId,
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }

        DB::table('leads')->insert([
            'id' => $this->leadId,
            'company_id' => $this->companyId,
            'client_name' => 'Jane Lead',
            'client_email' => 'jane@example.com',
            'lead_owner' => $this->userId,
            'added_by' => $this->userId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function actingAsSessionUser(): void
    {
        $user = \App\Models\User::withoutGlobalScopes()->find($this->userId);
        session(['user' => $user]);
    }
}
