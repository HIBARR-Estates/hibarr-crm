<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('show_rule_sets', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('field_id');
            $table->boolean('default_visibility')->default(true);
            $table->boolean('enabled')->default(true);
            $table->timestamps();
            
            $table->foreign('field_id')->references('id')->on('custom_fields')->onDelete('cascade');
            $table->unique('field_id', 'unique_field_rule_set');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('show_rule_sets');
    }
};
