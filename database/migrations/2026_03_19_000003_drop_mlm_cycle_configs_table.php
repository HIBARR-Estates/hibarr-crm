<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('mlm_cycle_configs');
    }

    public function down(): void
    {
        Schema::create('mlm_cycle_configs', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('duration_type', 20)->default('monthly');
            $table->unsignedInteger('duration_days')->nullable();
            $table->date('anchor_date');
            $table->decimal('max_overflow_multiplier', 3, 2)->default(1.00);
            $table->boolean('auto_generate')->default(true);
            $table->timestamps();

            $table->unique('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
    }
};
