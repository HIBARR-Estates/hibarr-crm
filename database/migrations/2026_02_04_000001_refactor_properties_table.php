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
     * This migration refactors the properties table to support:
     * - Dynamic reference codes (computed from type/subtype/rooms/id)
     * - Direct location relationships (project_location_id)
     * - Publishing workflow (is_published, published_at)
     * - Responsible agent & creator tracking
     * - Enhanced property details (unit_style, construction_status, etc.)
     * - Owner information (JSON for flexibility)
     * - Land-specific details (JSON for flexibility)
     */
    public function up(): void
    {
        // Make title and description nullable
        Schema::table('properties', function (Blueprint $table) {
            $table->string('title')->nullable()->change();
            $table->text('description')->nullable()->change();
        });

        // Add columns only if they don't exist
        $this->addColumnIfNotExists('properties', 'primary_category', fn(Blueprint $table) => 
            $table->string('primary_category')->nullable()->after('property_type'));
        
        $this->addColumnIfNotExists('properties', 'unit_style', fn(Blueprint $table) => 
            $table->string('unit_style')->nullable()->after('primary_category'));
        
        $this->addColumnIfNotExists('properties', 'construction_status', fn(Blueprint $table) => 
            $table->string('construction_status')->nullable()->after('unit_style'));
        
        $this->addColumnIfNotExists('properties', 'view_types', fn(Blueprint $table) => 
            $table->json('view_types')->nullable()->after('construction_status'));
        
        $this->addColumnIfNotExists('properties', 'current_occupancy', fn(Blueprint $table) => 
            $table->string('current_occupancy')->nullable()->after('furniture_status'));
        
        $this->addColumnIfNotExists('properties', 'project_location_id', fn(Blueprint $table) => 
            $table->unsignedBigInteger('project_location_id')->nullable()->after('developer_project_id'));
        
        $this->addColumnIfNotExists('properties', 'is_published', fn(Blueprint $table) => 
            $table->boolean('is_published')->default(false)->after('status'));
        
        $this->addColumnIfNotExists('properties', 'published_at', fn(Blueprint $table) => 
            $table->timestamp('published_at')->nullable()->after('is_published'));
        
        // Using unsignedInteger to match users.id column type (int unsigned)
        $this->addColumnIfNotExists('properties', 'added_by', fn(Blueprint $table) => 
            $table->unsignedInteger('added_by')->nullable()->after('product_id'));
        
        $this->addColumnIfNotExists('properties', 'responsible_agent_id', fn(Blueprint $table) => 
            $table->unsignedInteger('responsible_agent_id')->nullable()->after('added_by'));

        // Fix column types if they exist but are wrong type (bigint instead of int)
        $this->fixColumnTypeIfNeeded('properties', 'added_by', 'int unsigned');
        $this->fixColumnTypeIfNeeded('properties', 'responsible_agent_id', 'int unsigned');
        
        $this->addColumnIfNotExists('properties', 'open_to_swap', fn(Blueprint $table) => 
            $table->boolean('open_to_swap')->default(false)->after('furniture_status'));
        
        $this->addColumnIfNotExists('properties', 'swap_notes', fn(Blueprint $table) => 
            $table->text('swap_notes')->nullable()->after('open_to_swap'));
        
        $this->addColumnIfNotExists('properties', 'distances', fn(Blueprint $table) => 
            $table->json('distances')->nullable()->after('map'));
        
        $this->addColumnIfNotExists('properties', 'living_area_sqm', fn(Blueprint $table) => 
            $table->decimal('living_area_sqm', 10, 2)->nullable()->after('land_size'));
        
        $this->addColumnIfNotExists('properties', 'terrace_area_sqm', fn(Blueprint $table) => 
            $table->decimal('terrace_area_sqm', 10, 2)->nullable()->after('living_area_sqm'));
        
        $this->addColumnIfNotExists('properties', 'completion_date', fn(Blueprint $table) => 
            $table->date('completion_date')->nullable()->after('building_age'));
        
        $this->addColumnIfNotExists('properties', 'outside_features', fn(Blueprint $table) => 
            $table->json('outside_features')->nullable()->after('location_features'));
        
        $this->addColumnIfNotExists('properties', 'inside_features', fn(Blueprint $table) => 
            $table->json('inside_features')->nullable()->after('outside_features'));
        
        $this->addColumnIfNotExists('properties', 'owner_info', fn(Blueprint $table) => 
            $table->json('owner_info')->nullable()->after('add_ons'));
        
        $this->addColumnIfNotExists('properties', 'legal_info', fn(Blueprint $table) => 
            $table->json('legal_info')->nullable()->after('owner_info'));
        
        $this->addColumnIfNotExists('properties', 'financial_info', fn(Blueprint $table) => 
            $table->json('financial_info')->nullable()->after('legal_info'));
        
        $this->addColumnIfNotExists('properties', 'documents_checklist', fn(Blueprint $table) => 
            $table->json('documents_checklist')->nullable()->after('financial_info'));
        
        $this->addColumnIfNotExists('properties', 'allow_101evler', fn(Blueprint $table) => 
            $table->boolean('allow_101evler')->default(false)->after('documents_checklist'));
        
        $this->addColumnIfNotExists('properties', 'allow_hangiev', fn(Blueprint $table) => 
            $table->boolean('allow_hangiev')->default(false)->after('allow_101evler'));
        
        $this->addColumnIfNotExists('properties', 'land_details', fn(Blueprint $table) => 
            $table->json('land_details')->nullable()->after('allow_hangiev'));

        // Add foreign keys if they don't exist
        $this->addForeignKeyIfNotExists('properties', 'properties_project_location_id_foreign', function (Blueprint $table) {
            $table->foreign('project_location_id')->references('id')->on('project_locations')->nullOnDelete();
        });
        
        $this->addForeignKeyIfNotExists('properties', 'properties_added_by_foreign', function (Blueprint $table) {
            $table->foreign('added_by')->references('id')->on('users')->nullOnDelete();
        });
        
        $this->addForeignKeyIfNotExists('properties', 'properties_responsible_agent_id_foreign', function (Blueprint $table) {
            $table->foreign('responsible_agent_id')->references('id')->on('users')->nullOnDelete();
        });

        // Add indexes if they don't exist
        $this->addIndexIfNotExists('properties', 'properties_primary_category_index', fn(Blueprint $table) => 
            $table->index('primary_category'));
        $this->addIndexIfNotExists('properties', 'properties_unit_style_index', fn(Blueprint $table) => 
            $table->index('unit_style'));
        $this->addIndexIfNotExists('properties', 'properties_construction_status_index', fn(Blueprint $table) => 
            $table->index('construction_status'));
        $this->addIndexIfNotExists('properties', 'properties_is_published_index', fn(Blueprint $table) => 
            $table->index('is_published'));
        $this->addIndexIfNotExists('properties', 'properties_is_published_status_index', fn(Blueprint $table) => 
            $table->index(['is_published', 'status']));
        $this->addIndexIfNotExists('properties', 'properties_current_occupancy_index', fn(Blueprint $table) => 
            $table->index('current_occupancy'));

        // ================================================================
        // Backfill existing data
        // ================================================================
        
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
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex(['primary_category']);
            $table->dropIndex(['unit_style']);
            $table->dropIndex(['construction_status']);
            $table->dropIndex(['is_published']);
            $table->dropIndex(['is_published', 'status']);
            $table->dropIndex(['current_occupancy']);

            // Drop foreign key constraints
            $table->dropConstrainedForeignId('project_location_id');
            $table->dropForeign(['added_by']);
            $table->dropColumn('added_by');
            $table->dropForeign(['responsible_agent_id']);
            $table->dropColumn('responsible_agent_id');

            // Drop columns
            $table->dropColumn([
                'primary_category',
                'unit_style',
                'construction_status',
                'view_types',
                'current_occupancy',
                'is_published',
                'published_at',
                'open_to_swap',
                'swap_notes',
                'distances',
                'living_area_sqm',
                'terrace_area_sqm',
                'completion_date',
                'outside_features',
                'inside_features',
                'owner_info',
                'legal_info',
                'financial_info',
                'documents_checklist',
                'allow_101evler',
                'allow_hangiev',
                'land_details',
            ]);

            // Revert title to non-nullable (may fail if null values exist)
            $table->string('title')->nullable(false)->change();
            $table->text('description')->nullable(false)->change();
        });
    }

    private function addColumnIfNotExists(string $table, string $column, callable $callback): void
    {
        if (!Schema::hasColumn($table, $column)) {
            Schema::table($table, $callback);
        }
    }

    private function addForeignKeyIfNotExists(string $table, string $keyName, callable $callback): void
    {
        if (!$this->foreignKeyExists($table, $keyName)) {
            Schema::table($table, $callback);
        }
    }

    private function addIndexIfNotExists(string $table, string $indexName, callable $callback): void
    {
        if (!$this->indexExists($table, $indexName)) {
            Schema::table($table, $callback);
        }
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

    private function fixColumnTypeIfNeeded(string $table, string $column, string $expectedType): void
    {
        if (!Schema::hasColumn($table, $column)) {
            return;
        }

        $database = config('database.connections.mysql.database');
        $result = DB::select("
            SELECT COLUMN_TYPE FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = ? 
            AND COLUMN_NAME = ?
        ", [$database, $table, $column]);

        if (!empty($result) && $result[0]->COLUMN_TYPE !== $expectedType) {
            // Column exists with wrong type, need to alter it
            DB::statement("ALTER TABLE `{$table}` MODIFY `{$column}` INT UNSIGNED NULL");
        }
    }
};
