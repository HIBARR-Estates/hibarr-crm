<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_saved_views')) {
            return;
        }

        Schema::create('project_saved_views', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->string('name');
            // The applied filter query params, exactly as ProjectSavedView::sanitizeFilters whitelists them.
            $table->json('filters');
            // 'private' = owner only, 'team' = everyone in the company.
            $table->string('visibility')->default('private');
            $table->boolean('pinned')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'visibility']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_saved_views');
    }
};
