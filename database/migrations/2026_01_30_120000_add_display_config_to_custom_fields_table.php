<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds display_config for default/aggregate display of custom fields (e.g. repeatable).
     */
    public function up(): void
    {
        Schema::table('custom_fields', function (Blueprint $table) {
            $table->json('display_config')->nullable()->after('values');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('custom_fields', function (Blueprint $table) {
            $table->dropColumn('display_config');
        });
    }
};
