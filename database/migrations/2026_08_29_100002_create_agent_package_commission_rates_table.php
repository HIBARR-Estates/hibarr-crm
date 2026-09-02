<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('agent_package_commission_rates')) {
            return;
        }

        Schema::create('agent_package_commission_rates', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('package_id');
            // Not null: an override always states its own shape, it never
            // half-inherits the package default.
            $table->string('commission_type', 12);
            $table->decimal('commission_value', 15, 2);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('agent_id')->references('id')->on('lead_agents')->cascadeOnDelete();
            $table->foreign('package_id')->references('id')->on('packages')->cascadeOnDelete();

            $table->unique(['agent_id', 'package_id']);
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_package_commission_rates');
    }
};
