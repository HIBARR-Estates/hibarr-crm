<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_hierarchy', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('ancestor_id');
            $table->unsignedBigInteger('descendant_id');
            $table->unsignedInteger('depth');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('ancestor_id')->references('id')->on('lead_agents')->onDelete('cascade');
            $table->foreign('descendant_id')->references('id')->on('lead_agents')->onDelete('cascade');

            $table->unique(['ancestor_id', 'descendant_id']);
            $table->index('ancestor_id');
            $table->index('descendant_id');
            $table->index('depth');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_hierarchy');
    }
};
