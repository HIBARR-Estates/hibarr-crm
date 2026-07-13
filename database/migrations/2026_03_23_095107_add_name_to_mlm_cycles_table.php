<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Idempotent: skip when the column already exists so re-running or a
        // partial rollback state doesn't fail with a duplicate column error.
        if (Schema::hasColumn('mlm_cycles', 'name')) {
            return;
        }

        Schema::table('mlm_cycles', function (Blueprint $table) {
            $table->string('name', 100)->nullable()->after('cycle_number');
        });

        // Backfill existing cycles with a default name
        DB::table('mlm_cycles')
            ->whereNull('name')
            ->update(['name' => DB::raw("CONCAT('Cycle #', cycle_number)")]);

        Schema::table('mlm_cycles', function (Blueprint $table) {
            $table->string('name', 100)->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mlm_cycles', function (Blueprint $table) {
            $table->dropColumn('name');
        });
    }
};
