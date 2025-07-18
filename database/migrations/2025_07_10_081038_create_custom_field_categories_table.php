<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Creates the 'custom_field_categories' table with columns for ID, name, and model.
     */
    public function up(): void
    {
        Schema::create('custom_field_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('model');
        
        });
    }

    /**
     * Drops the `custom_field_categories` table if it exists, reversing the migration.
     */
    public function down(): void
    {
        Schema::dropIfExists('custom_field_categories');
    }
};