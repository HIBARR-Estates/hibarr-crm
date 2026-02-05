<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This migration fixes the partial state from 2026_02_04_000001_refactor_properties_table
     * by adding missing foreign keys and indexes, then marking the original migration as complete.
     */
    public function up(): void
    {
        // Add foreign keys that failed in the original migration
        Schema::table('properties', function (Blueprint $table) {
            // Check and add foreign key for project_location_id
            if (!$this->foreignKeyExists('properties', 'properties_project_location_id_foreign')) {
                $table->foreign('project_location_id')
                    ->references('id')
                    ->on('project_locations')
                    ->nullOnDelete();
            }

            // Check and add foreign key for added_by
            if (!$this->foreignKeyExists('properties', 'properties_added_by_foreign')) {
                $table->foreign('added_by')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            }

            // Check and add foreign key for responsible_agent_id
            if (!$this->foreignKeyExists('properties', 'properties_responsible_agent_id_foreign')) {
                $table->foreign('responsible_agent_id')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            }
        });

        // Add indexes that might be missing
        Schema::table('properties', function (Blueprint $table) {
            if (!$this->indexExists('properties', 'properties_primary_category_index')) {
                $table->index('primary_category');
            }
            if (!$this->indexExists('properties', 'properties_unit_style_index')) {
                $table->index('unit_style');
            }
            if (!$this->indexExists('properties', 'properties_construction_status_index')) {
                $table->index('construction_status');
            }
            if (!$this->indexExists('properties', 'properties_is_published_index')) {
                $table->index('is_published');
            }
            if (!$this->indexExists('properties', 'properties_is_published_status_index')) {
                $table->index(['is_published', 'status']);
            }
            if (!$this->indexExists('properties', 'properties_current_occupancy_index')) {
                $table->index('current_occupancy');
            }
        });

        // Run the backfill operations from the original migration
        // Set all existing properties as published (backward compatibility)
        DB::table('properties')
            ->whereNull('is_published')
            ->orWhere('is_published', false)
            ->update([
                'is_published' => true,
                'published_at' => DB::raw('created_at'),
            ]);

        // Backfill added_by from products.added_by
        DB::statement('
            UPDATE properties p
            JOIN products prod ON p.product_id = prod.id
            SET p.added_by = prod.added_by
            WHERE p.added_by IS NULL
        ');

        // Set responsible_agent_id to added_by if not set
        DB::statement('
            UPDATE properties
            SET responsible_agent_id = added_by
            WHERE responsible_agent_id IS NULL AND added_by IS NOT NULL
        ');

        // Mark the original migration as ran so it doesn't run again
        DB::table('migrations')->insertOrIgnore([
            'migration' => '2026_02_04_000001_refactor_properties_table',
            'batch' => DB::table('migrations')->max('batch') ?? 1,
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            // Drop foreign keys
            if ($this->foreignKeyExists('properties', 'properties_project_location_id_foreign')) {
                $table->dropForeign(['project_location_id']);
            }
            if ($this->foreignKeyExists('properties', 'properties_added_by_foreign')) {
                $table->dropForeign(['added_by']);
            }
            if ($this->foreignKeyExists('properties', 'properties_responsible_agent_id_foreign')) {
                $table->dropForeign(['responsible_agent_id']);
            }
        });
    }

    private function foreignKeyExists(string $table, string $keyName): bool
    {
        $database = config('database.connections.mysql.database');
        $result = DB::select("
            SELECT COUNT(*) as cnt FROM information_schema.TABLE_CONSTRAINTS 
            WHERE CONSTRAINT_SCHEMA = ? 
            AND TABLE_NAME = ? 
            AND CONSTRAINT_NAME = ? 
            AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        ", [$database, $table, $keyName]);
        
        return $result[0]->cnt > 0;
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $database = config('database.connections.mysql.database');
        $result = DB::select("
            SELECT COUNT(*) as cnt FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = ? 
            AND INDEX_NAME = ?
        ", [$database, $table, $indexName]);
        
        return $result[0]->cnt > 0;
    }
};
