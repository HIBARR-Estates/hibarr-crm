<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // Durable once-per-payment marker for the deal_payment_received
            // automations (e.g. the Meta Purchase conversion). Claimed
            // atomically; cleared again if the dispatch fails so it can retry.
            $table->timestamp('automations_dispatched_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('automations_dispatched_at');
        });
    }
};
