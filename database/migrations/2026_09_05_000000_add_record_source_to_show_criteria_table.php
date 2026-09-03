<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Widening a MySQL enum needs raw SQL — Schema::table()->change() on an
        // enum column requires doctrine/dbal to introspect it and doesn't
        // reliably round-trip enum definitions.
        DB::statement("ALTER TABLE show_criteria MODIFY reference_source ENUM('custom_field', 'pipeline', 'pipeline_stage', 'deal_package', 'record') NOT NULL DEFAULT 'custom_field'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE show_criteria MODIFY reference_source ENUM('custom_field', 'pipeline', 'pipeline_stage', 'deal_package') NOT NULL DEFAULT 'custom_field'");
    }
};
