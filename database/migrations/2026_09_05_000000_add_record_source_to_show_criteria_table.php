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
        // Narrowing the enum while 'record' rows exist either errors (strict
        // mode) or silently truncates them to ''. Drop them first: a record
        // criterion has no meaning once the value is gone from the enum, and
        // its reference_field_id is NULL by design — relabelling it
        // 'custom_field' instead would leave a NULL-referenced custom_field
        // criterion behind and break the earlier migration's rollback, which
        // restores reference_field_id to NOT NULL.
        DB::table('show_criteria')->where('reference_source', 'record')->delete();

        DB::statement("ALTER TABLE show_criteria MODIFY reference_source ENUM('custom_field', 'pipeline', 'pipeline_stage', 'deal_package') NOT NULL DEFAULT 'custom_field'");
    }
};
