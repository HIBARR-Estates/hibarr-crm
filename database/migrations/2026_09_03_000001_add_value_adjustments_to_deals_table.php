<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Manual adjustments to a deal's calculated value, edited together in the deal
 * value modal.
 *
 * Distinct from offer discounts (offer_applications.discount_amount), which are
 * derived from an applied offer and must stay traceable to it. These are the
 * ad-hoc figures a salesperson negotiates on the deal itself, so they live on
 * the deal rather than pretending to be an offer.
 *
 * discount_type/discount_value are a pair: 'percent' applies against the gross,
 * 'fixed' is a flat amount in the deal's own currency. Kept as type+value rather
 * than a resolved amount so a repriced deal recomputes an agreed "10% off"
 * instead of silently keeping the old money figure.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            if (! Schema::hasColumn('deals', 'discount_type')) {
                $table->string('discount_type', 10)->nullable()->after('value_source');
            }
            if (! Schema::hasColumn('deals', 'discount_value')) {
                $table->decimal('discount_value', 20, 2)->nullable()->after('discount_type');
            }
            if (! Schema::hasColumn('deals', 'deduction_amount')) {
                $table->decimal('deduction_amount', 20, 2)->nullable()->after('discount_value');
            }
            if (! Schema::hasColumn('deals', 'deduction_note')) {
                $table->string('deduction_note')->nullable()->after('deduction_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            foreach (['deduction_note', 'deduction_amount', 'discount_value', 'discount_type'] as $column) {
                if (Schema::hasColumn('deals', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
