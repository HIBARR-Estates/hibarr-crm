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
        Schema::table('hibarr_deal_custom_fields', function (Blueprint $table) {
            if (!Schema::hasColumn('hibarr_deal_custom_fields', 'message')) {
                $table->string('message')->nullable()->after('budget_range');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hibarr_deal_custom_fields', function (Blueprint $table) {
            if (Schema::hasColumn('hibarr_deal_custom_fields', 'message')) {
                $table->dropColumn('message');
            }
        });
    }
};
