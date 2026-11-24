<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Referral commission becomes a rule of its own instead of a blanket percentage
 * of the commission pool on everything a partner refers.
 *
 * A rule is the same type + value pair packages already use (percentage, fixed or
 * none). It lives where the closer's package commission lives, so the two are
 * handled together:
 *
 * - agent_package_commission_rates: what an agent earns as the REFERRER on one
 *   package, beside what they earn as the closer. The closer columns become
 *   optional, because a row can now exist for the referral terms alone.
 * - lead_agents: the partner's terms on deals with no package, taken from the
 *   deal value.
 * - deals: an override for a single deal.
 *
 * The superseded pool-percentage columns are dropped. They were behind a feature
 * flag that is off by default, and a "percent of the pool" has no faithful
 * equivalent as a percent of a package or deal value, so partner defaults must
 * be set again. A deal's "agreed amount" and "not paid" settings carry over.
 */
return new class extends Migration
{
    public function up(): void
    {
        // An agent can now have a row for referral terms alone.
        Schema::table('agent_package_commission_rates', function (Blueprint $table) {
            $table->string('commission_type', 12)->nullable()->change();
        });

        Schema::table('agent_package_commission_rates', function (Blueprint $table) {
            if (! Schema::hasColumn('agent_package_commission_rates', 'referral_commission_type')) {
                $table->string('referral_commission_type', 12)->nullable()->after('commission_value');
                $table->decimal('referral_commission_value', 15, 2)->nullable()->after('referral_commission_type');
            }
        });

        Schema::table('lead_agents', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_agents', 'referral_commission_type')) {
                $table->string('referral_commission_type', 12)->nullable()->after('custom_override_rate');
                $table->decimal('referral_commission_value', 15, 2)->nullable()->after('referral_commission_type');
            }
        });

        Schema::table('deals', function (Blueprint $table) {
            if (! Schema::hasColumn('deals', 'referral_commission_type')) {
                $table->string('referral_commission_type', 12)->nullable();
                $table->decimal('referral_commission_value', 15, 2)->nullable();
            }
        });

        Schema::table('agent_commission_rate_audit_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('agent_commission_rate_audit_logs', 'previous_referral_commission_type')) {
                $table->string('previous_referral_commission_type', 12)->nullable()->after('new_override_rate');
                $table->decimal('previous_referral_commission_value', 15, 2)->nullable()->after('previous_referral_commission_type');
                $table->string('new_referral_commission_type', 12)->nullable()->after('previous_referral_commission_value');
                $table->decimal('new_referral_commission_value', 15, 2)->nullable()->after('new_referral_commission_type');
            }
        });

        $this->carryOverDealSettings();
        $this->dropSupersededColumns();
    }

    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            if (! Schema::hasColumn('deals', 'referral_pool_rate')) {
                $table->decimal('referral_pool_rate', 5, 2)->nullable();
                $table->decimal('referral_fixed_amount', 15, 2)->nullable();
            }
        });

        Schema::table('lead_agents', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_agents', 'referral_pool_rate')) {
                $table->decimal('referral_pool_rate', 5, 2)->nullable()->after('custom_override_rate');
            }
        });

        Schema::table('agent_commission_rate_audit_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('agent_commission_rate_audit_logs', 'previous_referral_pool_rate')) {
                $table->decimal('previous_referral_pool_rate', 5, 2)->nullable();
                $table->decimal('new_referral_pool_rate', 5, 2)->nullable();
            }
        });

        foreach ([
            'agent_commission_rate_audit_logs' => [
                'new_referral_commission_value', 'new_referral_commission_type',
                'previous_referral_commission_value', 'previous_referral_commission_type',
            ],
            'deals' => ['referral_commission_value', 'referral_commission_type'],
            'lead_agents' => ['referral_commission_value', 'referral_commission_type'],
            'agent_package_commission_rates' => ['referral_commission_value', 'referral_commission_type'],
        ] as $table => $columns) {
            $this->dropColumns($table, $columns);
        }
    }

    /**
     * An agreed amount stays an agreed amount and a deal-level 0% stays "not paid".
     * A deal-level percentage of the pool has no equivalent and is left to inherit.
     */
    private function carryOverDealSettings(): void
    {
        if (! Schema::hasColumn('deals', 'referral_fixed_amount')) {
            return;
        }

        DB::table('deals')
            ->where('referral_fixed_amount', '>', 0)
            ->update([
                'referral_commission_type' => 'fixed',
                'referral_commission_value' => DB::raw('referral_fixed_amount'),
            ]);

        DB::table('deals')
            ->whereNull('referral_commission_type')
            ->where(function ($query) {
                $query->where('referral_fixed_amount', 0)
                    ->orWhere(function ($query) {
                        $query->whereNull('referral_fixed_amount')->where('referral_pool_rate', 0);
                    });
            })
            ->update(['referral_commission_type' => 'none']);
    }

    private function dropSupersededColumns(): void
    {
        foreach ([
            'deals' => ['referral_fixed_amount', 'referral_pool_rate'],
            'lead_agents' => ['referral_pool_rate'],
            'agent_commission_rate_audit_logs' => ['new_referral_pool_rate', 'previous_referral_pool_rate'],
        ] as $table => $columns) {
            $this->dropColumns($table, $columns);
        }
    }

    /**
     * One dropColumn call per table: SQLite refuses several in one modification,
     * and only the columns that are still there are asked for.
     *
     * @param  array<int, string>  $columns
     */
    private function dropColumns(string $table, array $columns): void
    {
        $present = array_values(array_filter($columns, fn (string $column) => Schema::hasColumn($table, $column)));

        if ($present === []) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($present) {
            $blueprint->dropColumn($present);
        });
    }
};
