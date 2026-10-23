<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Suppression decision on the per-message delivery log.
 *
 * `suppression_status` is one of EmailDeliveryLog::SUPPRESSION_*: `blocked`
 * (withheld), `would_have_blocked` (flag off, log-only) or `unavailable`
 * (OL unreachable and the fail-closed fallback held a non-transactional
 * send). `suppression_reason` is the list entry's reason when OL returned
 * one. `suppression_scope` records which category was checked.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('email_delivery_logs')) {
            return;
        }

        Schema::table('email_delivery_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('email_delivery_logs', 'suppression_status')) {
                $table->string('suppression_status', 32)->nullable()->after('fallback_reason');
            }

            if (! Schema::hasColumn('email_delivery_logs', 'suppression_reason')) {
                $table->string('suppression_reason', 32)->nullable()->after('suppression_status');
            }

            if (! Schema::hasColumn('email_delivery_logs', 'suppression_scope')) {
                $table->string('suppression_scope', 32)->nullable()->after('suppression_reason');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('email_delivery_logs')) {
            return;
        }

        Schema::table('email_delivery_logs', function (Blueprint $table) {
            foreach (['suppression_scope', 'suppression_reason', 'suppression_status'] as $column) {
                if (Schema::hasColumn('email_delivery_logs', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
