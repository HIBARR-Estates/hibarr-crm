<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Creates the developer_project_expose_configs table which stores all
     * configuration data needed to generate expose PDFs for a project.
     * 
     * This has a 1:1 relationship with DeveloperProject, enforced by
     * the unique constraint on developer_project_id.
     * 
     * All complex fields are stored as JSON for flexibility and to match
     * the ExposeProjectConfigData TypeScript interface.
     */
    public function up(): void
    {
        Schema::create('developer_project_expose_configs', function (Blueprint $table) {
            $table->id();
            
            // One-to-one relationship with DeveloperProject
            // The unique constraint ensures only one config per project
            $table->unsignedBigInteger('developer_project_id')->unique();
            
            // Logo configuration: {dark: string, light: string}
            $table->json('logo')->nullable();
            
            // Project overview: {city, propertyTypes[], completionDate, facilities[], propertyOverviewImage}
            $table->json('project_overview')->nullable();
            
            // Grouped images by category: Record<GroupedImageKey, string[]>
            // Keys: '3-block-images', 'floor-plans', 'site-images', 'other-images'
            $table->json('grouped_images')->nullable();
            
            // Generic images array: string[]
            $table->json('generic_images')->nullable();
            
            // Info blocks: Record<InfoBlockKey, {title, subTitle, content[]}>
            // Keys: 'garden-serenity' (extensible)
            $table->json('info_blocks')->nullable();
            
            // Monetary evaluation: {cost, expectedRentalIncome, expectedCapitalGrowth}
            $table->json('monetary_evaluation')->nullable();
            
            // Contact details: {agent, phones[], emails[], websites[], addresses[]}
            $table->json('contact_details')->nullable();
            
            $table->timestamps();
            
            // Foreign key with cascade delete - if project is deleted, config goes too
            $table->foreign('developer_project_id')
                ->references('id')
                ->on('developer_projects')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('developer_project_expose_configs');
    }
};
