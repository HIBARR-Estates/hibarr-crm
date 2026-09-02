<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Package-sourced commission legs.
 *
 * A fixed-fee leg has no meaningful percentage, so `percentage` becomes
 * nullable rather than storing a derived figure that would stop being true the
 * moment the package's value changed. `package_id IS NOT NULL` marks a package
 * leg; `percentage IS NULL` marks a fixed one.
 *
 * Deliberately no currency column: commissions stay denominated in the deal's
 * currency falling back to the company's, which is what keeps the existing
 * SUM(amount) totals meaningful.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mlm_commissions', function (Blueprint $table) {
            $table->decimal('percentage', 5, 2)->unsigned()->nullable()->change();
        });

        Schema::table('mlm_commissions', function (Blueprint $table) {
            if (! Schema::hasColumn('mlm_commissions', 'package_id')) {
                $table->unsignedBigInteger('package_id')->nullable()->after('level_id');
                $table->foreign('package_id')->references('id')->on('packages')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('mlm_commissions', function (Blueprint $table) {
            if (Schema::hasColumn('mlm_commissions', 'package_id')) {
                $table->dropForeign(['package_id']);
                $table->dropColumn('package_id');
            }
        });

        Schema::table('mlm_commissions', function (Blueprint $table) {
            $table->decimal('percentage', 5, 2)->unsigned()->nullable(false)->change();
        });
    }
};
