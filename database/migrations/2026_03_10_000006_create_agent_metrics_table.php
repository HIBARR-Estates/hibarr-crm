<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_metrics', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('agent_id');
            $table->unsignedInteger('nsa')->default(0); // Number of Sales by Agent
            $table->unsignedInteger('nsd')->default(0); // Number of Sales by Downlines
            $table->unsignedDecimal('vsa', 15, 2)->default(0); // Value of Sales by Agent
            $table->unsignedDecimal('vsd', 15, 2)->default(0); // Value of Sales by Downlines
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('agent_id')->references('id')->on('lead_agents')->onDelete('cascade');

            $table->unique('agent_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_metrics');
    }
};
