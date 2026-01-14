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
        // Drop tables in reverse order of dependencies
        Schema::dropIfExists('show_criteria');
        Schema::dropIfExists('show_rule_groups');
        Schema::dropIfExists('show_rule_sets');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This migration only drops tables, so down() does nothing
    }
};
