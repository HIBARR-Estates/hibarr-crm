<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A "none" override (an agent who earns nothing on a specific package, even
 * though the package or its default pays a rate) has no value to store —
 * mirrors packages.commission_value, which is already nullable for the same
 * "none"/unset reason.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agent_package_commission_rates', function (Blueprint $table) {
            $table->decimal('commission_value', 15, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('agent_package_commission_rates', function (Blueprint $table) {
            $table->decimal('commission_value', 15, 2)->nullable(false)->change();
        });
    }
};
