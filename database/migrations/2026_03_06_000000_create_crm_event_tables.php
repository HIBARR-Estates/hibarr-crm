<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Event Categories — top-level groupings (Deal, Lead, Property, System, etc.)
        Schema::create('crm_event_categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable()->index();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'slug'], 'crm_evt_cat_company_slug_unique');
        });

        // 2. Business Rules — named rules that event types can reference
        Schema::create('crm_business_rules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable()->index();
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->json('rule_config')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'slug'], 'crm_biz_rule_company_slug_unique');
        });

        // 3. Event Types — specific event types within a category
        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable()->index();
            $table->unsignedBigInteger('category_id');
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->string('model_type')->nullable()->comment('Fully qualified model class, e.g. App\\Models\\Deal');
            $table->unsignedBigInteger('business_rule_id')->nullable();
            $table->boolean('is_system')->default(false)->comment('System-seeded types protected from deletion');
            $table->boolean('is_active')->default(true);
            $table->boolean('sync_processing')->default(true)->comment('false = dispatched to queue for async processing');
            $table->json('metadata_schema')->nullable()->comment('Optional JSON Schema for validating event metadata');
            $table->timestamps();

            $table->unique(['company_id', 'category_id', 'slug'], 'crm_evt_type_company_cat_slug_unique');

            $table->foreign('category_id')
                ->references('id')
                ->on('crm_event_categories')
                ->onDelete('cascade');

            $table->foreign('business_rule_id')
                ->references('id')
                ->on('crm_business_rules')
                ->onDelete('set null');
        });

        // 4. Events — the core event log table (high-volume, optimized)
        Schema::create('crm_events', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->char('uuid', 36)->unique();
            $table->unsignedBigInteger('company_id')->index();
            $table->unsignedBigInteger('event_type_id');
            $table->string('generation_type', 20)->default('user_generated')->comment('user_generated | system_generated');
            $table->unsignedInteger('user_id')->nullable()->comment('NULL for system-generated events');
            $table->string('model_type')->nullable()->comment('Polymorphic model class');
            $table->unsignedBigInteger('model_id')->nullable()->comment('Polymorphic model ID');
            $table->char('correlation_id', 36)->nullable()->comment('Groups events in a saga/chain');
            $table->unsignedBigInteger('causation_id')->nullable()->comment('Direct parent event FK');
            $table->string('source', 20)->comment('api, grpc, observer, controller, job, middleware, system');
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->json('metadata')->nullable()->comment('Free-form event payload');
            $table->timestamp('occurred_at')->comment('When the event actually happened');
            $table->timestamps();

            // Composite indexes for common query patterns
            $table->index(['company_id', 'event_type_id', 'created_at'], 'crm_evt_company_type_created');
            $table->index(['company_id', 'model_type', 'model_id'], 'crm_evt_company_model');
            $table->index(['correlation_id'], 'crm_evt_correlation');
            $table->index(['company_id', 'generation_type'], 'crm_evt_company_generation');
            $table->index(['company_id', 'created_at'], 'crm_evt_company_created');
            $table->index(['company_id', 'source'], 'crm_evt_company_source');

            $table->foreign('event_type_id')
                ->references('id')
                ->on('crm_event_types')
                ->onDelete('cascade');

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('set null');

            $table->foreign('causation_id')
                ->references('id')
                ->on('crm_events')
                ->onDelete('set null');
        });

        // 5. Retention Policies — per-company archival configuration
        Schema::create('crm_event_retention_policies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->unique();
            $table->integer('max_age_days')->default(365);
            $table->integer('max_row_count')->default(5000000);
            $table->string('archive_storage', 20)->default('database')->comment('database | s3 (future)');
            $table->string('archive_table')->default('crm_events_archive');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_archived_at')->nullable();
            $table->timestamps();
        });

        // 6. Events Archive — identical schema to crm_events, no FKs (cold storage)
        Schema::create('crm_events_archive', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->char('uuid', 36)->index();
            $table->unsignedBigInteger('company_id')->index();
            $table->unsignedBigInteger('event_type_id');
            $table->string('generation_type', 20);
            $table->unsignedInteger('user_id')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->char('correlation_id', 36)->nullable()->index();
            $table->unsignedBigInteger('causation_id')->nullable();
            $table->string('source', 20);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->timestamp('archived_at')->useCurrent();

            // Minimal indexes for archive queries
            $table->index(['company_id', 'created_at'], 'crm_evt_arch_company_created');
            $table->index(['company_id', 'model_type', 'model_id'], 'crm_evt_arch_company_model');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('crm_events_archive');
        Schema::dropIfExists('crm_event_retention_policies');
        Schema::dropIfExists('crm_events');
        Schema::dropIfExists('crm_event_types');
        Schema::dropIfExists('crm_business_rules');
        Schema::dropIfExists('crm_event_categories');
    }
};
