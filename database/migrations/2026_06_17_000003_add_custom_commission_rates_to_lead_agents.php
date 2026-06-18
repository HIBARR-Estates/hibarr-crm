<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_agents', function (Blueprint $table) {
            $table->unsignedDecimal('custom_direct_rate', 5, 2)->nullable()->after('parent_agent_id');
            $table->unsignedDecimal('custom_override_rate', 5, 2)->nullable()->after('custom_direct_rate');
        });
    }

    public function down(): void
    {
        Schema::table('lead_agents', function (Blueprint $table) {
            $table->dropColumn(['custom_direct_rate', 'custom_override_rate']);
        });
    }
};
