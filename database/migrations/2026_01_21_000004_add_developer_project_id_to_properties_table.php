<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds developer_project_id foreign key to the properties table.
     * This establishes a one-to-many relationship where:
     * - A DeveloperProject can have many Properties
     * - A Property can belong to only ONE project at a time
     * 
     * The column is nullable because properties can exist without
     * being assigned to a project.
     */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            // Add the foreign key column after company_id for logical grouping
            $table->unsignedBigInteger('developer_project_id')
                ->nullable()
                ->after('company_id');
            
            // Foreign key constraint - set null if project is deleted
            // This prevents orphaned properties
            $table->foreign('developer_project_id')
                ->references('id')
                ->on('developer_projects')
                ->onDelete('set null');
            
            // Index for faster lookups when querying properties by project
            $table->index('developer_project_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dropForeign(['developer_project_id']);
            $table->dropIndex(['developer_project_id']);
            $table->dropColumn('developer_project_id');
        });
    }
};
