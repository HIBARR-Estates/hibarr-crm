<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entity_ai_summaries', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 16);
            $table->unsignedBigInteger('entity_id');
            $table->json('summary_json');
            $table->string('input_hash', 64);
            $table->string('prompt_version', 32)->default('v1');
            $table->timestamp('generated_at');
            $table->unsignedInteger('generated_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'entity_type', 'entity_id'], 'entity_ai_summaries_entity_unique');
            $table->index(['company_id', 'entity_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_ai_summaries');
    }
};
