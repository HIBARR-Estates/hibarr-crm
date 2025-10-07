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
        // The meeting_type_id column already exists, so this migration does nothing
        // It's just to mark the previous migration as complete
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Nothing to reverse
    }
};
