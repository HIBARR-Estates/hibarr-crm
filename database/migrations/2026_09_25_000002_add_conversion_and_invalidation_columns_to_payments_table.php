<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Deal payment requests are issued in a chosen currency, converted from the
 * deal's value in company currency, and can be invalidated when that value
 * changes before the client pays.
 *
 * The conversion itself reuses Worksuite's existing columns — currency_id (the
 * request's currency), default_currency_id (company currency) and
 * exchange_rate (amount × exchange_rate = company amount) — so
 * Payment::defaultCurrencyPrice keeps working. base_amount records the exact
 * company-currency figure the request was converted from, rather than
 * re-deriving it from a rounded amount and an inverted rate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasColumn('payments', 'base_amount')) {
                $table->decimal('base_amount', 16, 2)->nullable()->after('amount');
            }
            if (! Schema::hasColumn('payments', 'invalidated_at')) {
                $table->timestamp('invalidated_at')->nullable()->after('verified_at');
            }
            if (! Schema::hasColumn('payments', 'invalidated_by_user_id')) {
                $table->unsignedBigInteger('invalidated_by_user_id')->nullable()->after('invalidated_at');
            }
            if (! Schema::hasColumn('payments', 'invalidation_reason')) {
                $table->string('invalidation_reason', 255)->nullable()->after('invalidated_by_user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            foreach (['invalidation_reason', 'invalidated_by_user_id', 'invalidated_at', 'base_amount'] as $column) {
                if (Schema::hasColumn('payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
