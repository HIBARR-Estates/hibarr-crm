<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // `section` makes sections a first-class concept instead of one derived from
        // custom_field_category boundaries; deal_/lead_custom_field allow individual
        // custom fields (not just whole categories) as steps.
        DB::statement("ALTER TABLE pipeline_analysis_script_items MODIFY COLUMN type ENUM('custom_field_category','native_field','hibarr_field','lead_field','question','instruction','section','deal_custom_field','lead_custom_field') NOT NULL");
    }

    public function down(): void
    {
        // Rows using the new types must go first — the column can't hold them afterwards.
        DB::table('pipeline_analysis_script_items')
            ->whereIn('type', ['section', 'deal_custom_field', 'lead_custom_field'])
            ->delete();

        DB::statement("ALTER TABLE pipeline_analysis_script_items MODIFY COLUMN type ENUM('custom_field_category','native_field','hibarr_field','lead_field','question','instruction') NOT NULL");
    }
};
