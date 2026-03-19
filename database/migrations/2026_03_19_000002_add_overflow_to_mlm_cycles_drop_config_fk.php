<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mlm_cycles', function (Blueprint $table) {
            // Add per-cycle overflow multiplier
            $table->decimal('max_overflow_multiplier', 3, 2)->default(1.00)->after('status');

            // Drop the foreign key and column linking to cycle_configs
            $table->dropForeign(['cycle_config_id']);
            $table->dropColumn('cycle_config_id');
        });
    }

    public function down(): void
    {
        Schema::table('mlm_cycles', function (Blueprint $table) {
            $table->dropColumn('max_overflow_multiplier');

            $table->unsignedBigInteger('cycle_config_id')->after('company_id');
            $table->foreign('cycle_config_id')->references('id')->on('mlm_cycle_configs')->cascadeOnDelete();
        });
    }
};
