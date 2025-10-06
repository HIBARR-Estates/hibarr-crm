<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Add foreign key constraints to meeting_summary table with explicit naming.
     * Note: The table was created without foreign keys, so we just add them.
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