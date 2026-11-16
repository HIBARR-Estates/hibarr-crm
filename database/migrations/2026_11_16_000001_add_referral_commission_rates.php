<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A partner's share of the commission pool on deals from leads they referred.
 *
 * The partner default is a percent of the pool. A deal can set its own percent,
 * and an agreed amount on the deal replaces that percent when it is filled in.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_agents', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_agents', 'referral_pool_rate')) {
                $table->decimal('referral_pool_rate', 5, 2)->nullable()->after('custom_override_rate');
            }
        });

        Schema::table('deals', function (Blueprint $table) {
            if (! Schema::hasColumn('deals', 'referral_pool_rate')) {
                $table->decimal('referral_pool_rate', 5, 2)->nullable();
            }
            if (! Schema::hasColumn('deals', 'referral_fixed_amount')) {
                $table->decimal('referral_fixed_amount', 15, 2)->nullable();
            }
        });

        Schema::table('agent_commission_rate_audit_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('agent_commission_rate_audit_logs', 'previous_referral_pool_rate')) {
                $table->decimal('previous_referral_pool_rate', 5, 2)->nullable()->after('new_override_rate');
                $table->decimal('new_referral_pool_rate', 5, 2)->nullable()->after('previous_referral_pool_rate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('lead_agents', function (Blueprint $table) {
            if (Schema::hasColumn('lead_agents', 'referral_pool_rate')) {
                $table->dropColumn('referral_pool_rate');
            }
        });

        Schema::table('deals', function (Blueprint $table) {
            foreach (['referral_fixed_amount', 'referral_pool_rate'] as $column) {
                if (Schema::hasColumn('deals', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('agent_commission_rate_audit_logs', function (Blueprint $table) {
            foreach (['new_referral_pool_rate', 'previous_referral_pool_rate'] as $column) {
                if (Schema::hasColumn('agent_commission_rate_audit_logs', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
