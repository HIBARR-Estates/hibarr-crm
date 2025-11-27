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
        Schema::table('custom_fields', function (Blueprint $table) {
            if (!Schema::hasColumn('custom_fields', 'important')) {
                // Add important column after visible column if it exists, otherwise after export
                if (Schema::hasColumn('custom_fields', 'visible')) {
                    $table->boolean('important')->default(0)->after('visible');
                } else {
                    $table->boolean('important')->default(0)->after('export');
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('custom_fields', function (Blueprint $table) {
            if (Schema::hasColumn('custom_fields', 'important')) {
                $table->dropColumn('important');
            }
        });
    }
};
