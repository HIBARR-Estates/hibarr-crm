<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * No-op migration. Foreign keys already exist from the table creation migration
     * (2025_09_27_135046_create_meeting_summary_table.php).
     */
    public function up(): void
    {
        // Foreign keys already exist from the table creation migration.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op: nothing was added in up().
    }
};