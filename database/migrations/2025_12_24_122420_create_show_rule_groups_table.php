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
        Schema::create('show_rule_groups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('rule_set_id');
            $table->enum('group_operator', ['AND', 'OR'])->default('AND');
            $table->timestamps();
            
            $table->foreign('rule_set_id')->references('id')->on('show_rule_sets')->onDelete('cascade');
            $table->index('rule_set_id', 'idx_rule_set');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('show_rule_groups');
    }
};
