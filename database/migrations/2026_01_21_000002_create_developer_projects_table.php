<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Creates the developer_projects table. This is the main entity that:
     * - Has a name and description
     * - Links to a ProjectLocation (1:1 relationship)
     * - Will have an ExposeConfig attached to it
     * - Can contain multiple Properties
     */
    public function up(): void
    {
        Schema::create('developer_projects', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            
            // Basic project information
            $table->string('name');
            $table->text('description')->nullable();
            
            // One-to-one relationship with ProjectLocation
            // A project is tied to exactly one location
            $table->unsignedBigInteger('project_location_id')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            // Foreign keys
            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade');
            
            $table->foreign('project_location_id')
                ->references('id')
                ->on('project_locations')
                ->onDelete('set null');
            
            // Indexes
            $table->index('company_id');
            $table->index('project_location_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('developer_projects');
    }
};
