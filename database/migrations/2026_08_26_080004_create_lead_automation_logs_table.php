<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_automation_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id');
            $table->unsignedBigInteger('automation_id');
            $table->string('action');
            $table->string('result', 20);
            $table->json('details')->nullable();
            $table->timestamp('executed_at')->useCurrent();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('lead_id')->references('id')->on('leads')->onDelete('cascade');
            $table->foreign('automation_id')->references('id')->on('lead_automations')->onDelete('cascade');

            $table->index(['lead_id', 'automation_id']);
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_automation_logs');
    }
};
