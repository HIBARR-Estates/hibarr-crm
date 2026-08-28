<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_automations', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('name');
            $table->string('trigger')->nullable();
            $table->boolean('active')->default(false);
            $table->integer('priority')->default(0);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->index(['company_id', 'active', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_automations');
    }
};
