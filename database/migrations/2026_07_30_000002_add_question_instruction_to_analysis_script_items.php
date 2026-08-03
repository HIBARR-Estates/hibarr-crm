<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE pipeline_analysis_script_items MODIFY COLUMN type ENUM('custom_field_category','native_field','hibarr_field','lead_field','question','instruction') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE pipeline_analysis_script_items MODIFY COLUMN type ENUM('custom_field_category','native_field','hibarr_field','lead_field') NOT NULL");
    }
};
