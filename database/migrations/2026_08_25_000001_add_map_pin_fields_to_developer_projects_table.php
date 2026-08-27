<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Move authoritative map pins onto developer_projects so projects in the
     * same city+area can keep distinct addresses / map URLs.
     *
     * Shared project_locations retain city/area + expose blobs and may still
     * hold default pin values (edited via Project Locations admin).
     */
    public function up(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->string('map_url', 2048)->nullable()->after('project_location_id');
            $table->decimal('latitude', 10, 7)->nullable()->after('map_url');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->json('address')->nullable()->after('longitude');
        });

        if (!Schema::hasTable('project_locations')) {
            return;
        }

        $projects = DB::table('developer_projects')
            ->whereNotNull('project_location_id')
            ->select(['id', 'project_location_id'])
            ->get();

        foreach ($projects as $project) {
            $location = DB::table('project_locations')
                ->where('id', $project->project_location_id)
                ->first();

            if (!$location) {
                continue;
            }

            DB::table('developer_projects')
                ->where('id', $project->id)
                ->update([
                    'map_url' => $location->map_url,
                    'latitude' => $location->latitude ?? null,
                    'longitude' => $location->longitude ?? null,
                    'address' => $location->address ?? null,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->dropColumn(['map_url', 'latitude', 'longitude', 'address']);
        });
    }
};
