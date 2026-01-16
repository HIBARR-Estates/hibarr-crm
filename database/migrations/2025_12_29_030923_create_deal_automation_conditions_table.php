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
        Schema::create('deal_automation_conditions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_automation_id');
            $table->string('field');
            $table->string('operator');
            $table->json('value')->nullable();
            $table->timestamps();

            $table->foreign('deal_automation_id')->references('id')->on('deal_automations')->onDelete('cascade');
            $table->index(['deal_automation_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deal_automation_conditions');
    }
};
