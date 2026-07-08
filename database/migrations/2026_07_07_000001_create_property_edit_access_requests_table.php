<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_edit_access_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
            $table->unsignedInteger('requesting_agent_id');
            $table->unsignedInteger('responsible_agent_id');
            $table->unsignedInteger('company_id');

            $table->string('status', 20)->default('pending');
            $table->text('message')->nullable();
            $table->text('response_message')->nullable();
            $table->unsignedInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->foreign('property_id')->references('id')->on('properties')->cascadeOnDelete();
            $table->foreign('requesting_agent_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('responsible_agent_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['property_id', 'status']);
            $table->index(['requesting_agent_id']);
            $table->index(['responsible_agent_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_edit_access_requests');
    }
};
