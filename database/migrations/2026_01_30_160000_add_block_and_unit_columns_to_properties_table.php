<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds block_name and unit_number columns for property duplicate detection.
     * These columns are used to build a composite fingerprint:
     * - With project: {company_id}|{project_id}|{property_type}|{block}|{unit}
     * - Standalone:   {company_id}|{city}|{area}|{property_type}|{block}|{unit}
     */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->string('block_name')->nullable()->after('within_site')
                ->comment('Block/building identifier (e.g., Block B, Tower 1, Phase 2)');
            $table->string('unit_number')->nullable()->after('block_name')
                ->comment('Unit/apartment/house number within the block');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn(['block_name', 'unit_number']);
        });
    }
};
