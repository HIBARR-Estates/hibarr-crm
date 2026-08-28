<?php

namespace Tests;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Isolated sqlite :memory: harness for Lead automation tests.
 * Never connects to or mutates the developer MySQL/Postgres database.
 * Fresh :memory: reconnect each setUp — no Schema::drop* required.
 */
abstract class LeadAutomationTestCase extends TestCase
{
    use Concerns\SetsFeatureFlags;

    protected int $companyId = 1;

    protected int $userId = 1;

    protected int $leadId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('database.connections.sqlite.prefix', '');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->createMinimalSchema();
        $this->seedBaseData();
    }

    protected function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->string('date_format')->default('Y-m-d');
            $table->string('time_format')->default('H:i:s');
            $table->string('timezone')->default('UTC');
            $table->string('header_color')->nullable();
            $table->timestamps();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedInteger('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->text('payload')->nullable();
            $table->integer('last_activity')->nullable();
        });

        Schema::create('client_contacts', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('image')->nullable();
            $table->string('status')->default('active');
            $table->boolean('email_notifications')->default(true);
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->string('client_email')->nullable();
            $table->string('mobile')->nullable();
            $table->string('temperature')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->string('hash')->nullable();
            $table->string('next_follow_up')->default('yes');
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('lead_automations', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('name');
            $table->string('trigger')->nullable();
            $table->boolean('active')->default(false);
            $table->integer('priority')->default(0);
            $table->timestamps();
        });

        Schema::create('lead_automation_conditions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_automation_id');
            $table->string('field');
            $table->string('operator');
            $table->json('value')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_automation_actions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_automation_id');
            $table->string('action_type', 30);
            $table->json('payload')->nullable();
            $table->integer('priority')->default(0);
            $table->timestamps();
        });

        Schema::create('lead_automation_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id');
            $table->unsignedBigInteger('automation_id');
            $table->string('action');
            $table->string('result', 20);
            $table->json('details')->nullable();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('title')->nullable();
            $table->text('details')->nullable();
            $table->integer('type')->default(0);
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('taskboard_columns', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('column_name')->nullable();
            $table->string('slug')->nullable();
            $table->string('label_color')->nullable();
            $table->integer('priority')->default(0);
            $table->timestamps();
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('heading');
            $table->mediumText('description')->nullable();
            $table->dateTime('due_date')->nullable();
            $table->dateTime('start_date')->nullable();
            $table->unsignedInteger('project_id')->nullable();
            $table->unsignedInteger('task_category_id')->nullable();
            $table->string('priority')->default('medium');
            $table->string('status')->default('incomplete');
            $table->unsignedInteger('board_column_id')->nullable();
            $table->integer('is_private')->default(0);
            $table->integer('billable')->default(0);
            $table->integer('estimate_hours')->default(0);
            $table->integer('estimate_minutes')->default(0);
            $table->integer('repeat')->default(0);
            $table->unsignedInteger('dependent_task_id')->nullable();
            $table->unsignedInteger('milestone_id')->nullable();
            $table->integer('approval_send')->default(0);
            $table->boolean('is_next_step')->default(false);
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->string('task_short_code')->nullable();
            $table->string('hash')->nullable();
            $table->json('reminders')->nullable();
            $table->dateTime('remind_at')->nullable();
            $table->string('integration_origin')->nullable();
            $table->timestamps();
        });

        Schema::create('taskables', function (Blueprint $table) {
            $table->unsignedInteger('task_id');
            $table->string('taskable_type');
            $table->unsignedInteger('taskable_id');
        });

        Schema::create('task_users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->unsignedInteger('user_id');
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('meeting_type_id')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->longText('remark')->nullable();
            $table->enum('send_reminder', ['yes', 'no'])->nullable();
            $table->string('remind_time')->nullable();
            $table->string('remind_type')->nullable();
            $table->string('status')->nullable();
            $table->string('location')->nullable();
            $table->string('meeting_link')->nullable();
            $table->integer('duration')->nullable();
            $table->json('participants')->nullable();
            $table->json('reminders')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->string('integration_origin')->nullable();
            $table->timestamps();
        });

        Schema::create('reminder_email_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type');
            $table->string('plunk_template_id')->nullable();
            $table->timestamps();
        });

        Schema::create('custom_fields_data', function (Blueprint $table) {
            $table->increments('id');
            $table->string('model')->nullable();
            $table->unsignedInteger('model_id')->nullable();
            $table->unsignedInteger('custom_field_id')->nullable();
            $table->text('value')->nullable();
        });

        Schema::create('custom_fields', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('label')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_automations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedBigInteger('pipeline_id')->nullable();
            $table->string('trigger')->nullable();
            $table->boolean('active')->default(true);
            $table->integer('priority')->default(0);
            $table->timestamps();
        });

        Schema::create('deal_automation_actions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_automation_id');
            $table->string('action_type', 30)->default('stage_transition');
            $table->unsignedInteger('target_stage_id')->nullable();
            $table->unsignedInteger('target_pipeline_id')->nullable();
            $table->boolean('forward_only')->default(true);
            $table->string('field_name')->nullable();
            $table->string('field_value')->nullable();
            $table->json('payload')->nullable();
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

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('slug');
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('google_calendar_modules', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->boolean('lead_status')->default(false);
            $table->boolean('leave_status')->default(false);
            $table->boolean('invoice_status')->default(false);
            $table->boolean('contract_status')->default(false);
            $table->boolean('task_status')->default(false);
            $table->boolean('event_status')->default(false);
            $table->boolean('holiday_status')->default(false);
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    protected function seedBaseData(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i:s',
            'timezone' => 'UTC',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->insert([
            'id' => $this->userId,
            'company_id' => $this->companyId,
            'name' => 'Agent One',
            'email' => 'owner@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('leads')->insert([
            'id' => $this->leadId,
            'company_id' => $this->companyId,
            'client_name' => 'Jane Lead',
            'client_email' => 'jane@example.com',
            'lead_owner' => $this->userId,
            'added_by' => $this->userId,
            'hash' => md5('test'),
            'next_follow_up' => 'yes',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('taskboard_columns')->insert([
            'id' => 1,
            'company_id' => $this->companyId,
            'column_name' => 'To Do',
            'slug' => 'to_do',
            'priority' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function makeAutomation(array $attrs = []): \App\Models\LeadAutomation
    {
        return \App\Models\LeadAutomation::withoutGlobalScopes()->create(array_merge([
            'company_id' => $this->companyId,
            'name' => 'Test automation',
            'trigger' => 'lead_updated',
            'active' => true,
            'priority' => 10,
        ], $attrs));
    }
}
