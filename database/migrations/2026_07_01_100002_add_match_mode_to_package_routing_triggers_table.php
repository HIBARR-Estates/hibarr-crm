<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('package_routing_triggers') && !Schema::hasColumn('package_routing_triggers', 'match_mode')) {
            Schema::table('package_routing_triggers', function (Blueprint $table) {
                $table->string('match_mode', 20)->default('exact')->after('field_key');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('package_routing_triggers', 'match_mode')) {
            Schema::table('package_routing_triggers', function (Blueprint $table) {
                $table->dropColumn('match_mode');
            });
        }
    }
};
