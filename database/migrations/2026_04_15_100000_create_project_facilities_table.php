<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('project_facilities')) {
            Schema::create('project_facilities', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->string('name');
                $table->string('label');
                $table->text('description')->nullable();
                $table->string('icon')->nullable()->comment('Lucide icon identifier e.g. "waves", "dumbbell"');
                $table->timestamps();

                $table->unique(['company_id', 'name']);
                $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('project_facilities');
    }
};
