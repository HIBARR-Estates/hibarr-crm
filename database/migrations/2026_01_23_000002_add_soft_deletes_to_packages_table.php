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
        // Check for column existence outside the Schema::table() closure
        $needsSoftDeletes = !Schema::hasColumn('packages', 'deleted_at');
        
        // Only modify the table if column needs to be added
        if ($needsSoftDeletes) {
            Schema::table('packages', function (Blueprint $table) {
                $table->softDeletes();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Check for column existence outside the Schema::table() closure
        $hasSoftDeletes = Schema::hasColumn('packages', 'deleted_at');
        
        // Only modify the table if column needs dropping
        if ($hasSoftDeletes) {
            Schema::table('packages', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};
