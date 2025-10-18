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
        Schema::dropIfExists('meeting_types');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This migration is only for cleanup, no rollback needed
    }
};
