<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Checkout collects the net amount. Only when the customer asks for an
     * invoice or receipt does KDV come on top, so documents are not made
     * until someone records that request here.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->timestamp('documents_requested_at')->nullable();
            $table->unsignedInteger('documents_requested_by_user_id')->nullable();
        });

        // Payments whose documents were already issued count as requested, so
        // their frozen invoice and receipt stay reachable.
        if (Schema::hasTable('payment_documents')) {
            DB::table('payments')
                ->whereIn('id', DB::table('payment_documents')->select('payment_id'))
                ->update(['documents_requested_at' => DB::raw('CURRENT_TIMESTAMP')]);
        }
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['documents_requested_at', 'documents_requested_by_user_id']);
        });
    }
};
