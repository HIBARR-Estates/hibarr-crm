<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_automation_conditions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_automation_id');
            $table->string('field');
            $table->string('operator');
            $table->json('value')->nullable();
            $table->timestamps();

            $table->foreign('lead_automation_id')
                ->references('id')
                ->on('lead_automations')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_automation_conditions');
    }
};
