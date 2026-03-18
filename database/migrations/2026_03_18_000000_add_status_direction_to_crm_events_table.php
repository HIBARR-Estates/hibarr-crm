<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * V2: Add status and direction columns to the crm_events table.
     *
     * - status: completed | error_occurred | missed | rejected
     * - direction: inbound | outbound (nullable — not all events have a direction)
     */
    public function up(): void
    {
        Schema::table('crm_events', function (Blueprint $table) {
            $table->string('status', 20)->default('completed')
                ->after('generation_type')
                ->comment('completed | error_occurred | missed | rejected');

            $table->string('direction', 10)->nullable()
                ->after('status')
                ->comment('inbound | outbound (nullable)');

            // Composite indexes for common filter patterns
            $table->index(['company_id', 'status'], 'crm_evt_company_status');
            $table->index(['company_id', 'direction'], 'crm_evt_company_direction');
        });

        // Mirror columns in archive table (no indexes needed)
        Schema::table('crm_events_archive', function (Blueprint $table) {
            $table->string('status', 20)->default('completed')
                ->after('generation_type');

            $table->string('direction', 10)->nullable()
                ->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('crm_events', function (Blueprint $table) {
            $table->dropIndex('crm_evt_company_status');
            $table->dropIndex('crm_evt_company_direction');
            $table->dropColumn(['status', 'direction']);
        });

        Schema::table('crm_events_archive', function (Blueprint $table) {
            $table->dropColumn(['status', 'direction']);
        });
    }
};
