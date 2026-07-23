<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            if (!Schema::hasColumn('companies', 'package_pipeline_routing_enabled')) {
                $table->boolean('package_pipeline_routing_enabled')->default(false)->after('enable_data_quality_monitor');
            }
            if (!Schema::hasColumn('companies', 'deal_package_mode')) {
                $table->string('deal_package_mode', 20)->default('multiple')->after('package_pipeline_routing_enabled');
            }
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            if (Schema::hasColumn('companies', 'deal_package_mode')) {
                $table->dropColumn('deal_package_mode');
            }
            if (Schema::hasColumn('companies', 'package_pipeline_routing_enabled')) {
                $table->dropColumn('package_pipeline_routing_enabled');
            }
        });
    }
};
