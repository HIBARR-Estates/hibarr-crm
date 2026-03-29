<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mlm_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');

            // Commission settings (moved from .env)
            $table->decimal('max_commission_percentage', 5, 2)->default(10.00);
            $table->boolean('auto_evaluate_ancestors')->default(true);
            $table->boolean('enable_commission_reversal')->default(true);

            // Cycle auto-generation defaults
            $table->boolean('auto_generate_cycles')->default(true);
            $table->string('default_cycle_duration_type', 20)->default('monthly'); // monthly, quarterly, custom
            $table->unsignedInteger('default_cycle_duration_days')->nullable(); // only for custom
            $table->decimal('default_overflow_multiplier', 3, 2)->default(1.00);

            $table->timestamps();

            $table->unique('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mlm_settings');
    }
};
