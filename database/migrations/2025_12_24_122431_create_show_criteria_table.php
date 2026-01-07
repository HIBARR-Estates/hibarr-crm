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
        Schema::create('show_criteria', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('group_id');
            $table->unsignedInteger('reference_field_id');
            $table->enum('operator', ['equals', 'exists', 'boolean', '>', '<', '>=', '<=', 'in', 'not_in']);
            $table->text('reference_value')->nullable();
            $table->boolean('negate')->default(false);
            $table->timestamps();
            
            $table->foreign('group_id')->references('id')->on('show_rule_groups')->onDelete('cascade');
            $table->foreign('reference_field_id')->references('id')->on('custom_fields')->onDelete('cascade');
            $table->index('group_id', 'idx_group');
            $table->index('reference_field_id', 'idx_reference_field');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('show_criteria');
    }
};
