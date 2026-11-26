<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_pipelines', function (Blueprint $table) {
            $table->string('offering_type', 20)->default('property')->after('hidden_from_system');
        });

        // Pipelines that already sell packages via package_pipeline stay package-type.
        if (Schema::hasTable('package_pipeline')) {
            $packagePipelineIds = DB::table('package_pipeline')
                ->distinct()
                ->pluck('pipeline_id');

            if ($packagePipelineIds->isNotEmpty()) {
                DB::table('lead_pipelines')
                    ->whereIn('id', $packagePipelineIds)
                    ->update(['offering_type' => 'package']);
            }
        }
    }

    public function down(): void
    {
        Schema::table('lead_pipelines', function (Blueprint $table) {
            $table->dropColumn('offering_type');
        });
    }
};
