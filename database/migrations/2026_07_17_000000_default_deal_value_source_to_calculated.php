<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->string('value_source', 20)->default('calculated')->change();
        });

        // Deals that were never given an explicit manual value are still on the
        // old default — move them onto the new "calculated by default" policy
        // and recompute their stored value from live products/packages/discounts,
        // since deals.value (unlike value_breakdown.calculated_value) isn't
        // derived on the fly.
        $dealIds = DB::table('deals')
            ->where('value_source', 'manual')
            ->whereNull('manual_value')
            ->pluck('id');

        foreach ($dealIds as $dealId) {
            $productsTotal = (float) DB::table('lead_products')
                ->join('products', 'products.id', '=', 'lead_products.product_id')
                ->where('lead_products.deal_id', $dealId)
                ->sum('products.price');

            $packagesTotal = (float) DB::table('deal_package')
                ->join('packages', 'packages.id', '=', 'deal_package.package_id')
                ->where('deal_package.deal_id', $dealId)
                ->sum('packages.value');

            $discountTotal = (float) DB::table('deal_offer_applications')
                ->where('deal_id', $dealId)
                ->sum('discount_amount');

            $calculatedValue = max(0, round($productsTotal + $packagesTotal - $discountTotal, 2));

            DB::table('deals')->where('id', $dealId)->update([
                'value_source' => 'calculated',
                'calculated_value' => $calculatedValue,
                'value' => $calculatedValue,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            $table->string('value_source', 20)->default('manual')->change();
        });
    }
};
