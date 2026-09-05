<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Saved filter views for the redesigned Meetings index.
 *
 * Mirrors `task_saved_views` / `lead_saved_views` column for column — the
 * frontend bar, the save popover and the create/update/delete hook are shared
 * across all three, so the storage has to be the same shape.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('meeting_saved_views')) {
            return;
        }

        Schema::create('meeting_saved_views', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->string('name');
            $table->json('filters');
            $table->string('visibility')->default('private');
            $table->boolean('pinned')->default(true);
            $table->timestamps();

            // The listing query is always "views this company shares, plus
            // mine", so those are the two paths worth indexing.
            $table->index(['company_id', 'visibility']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_saved_views');
    }
};
