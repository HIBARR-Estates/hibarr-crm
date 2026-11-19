<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['documents_requested_at', 'documents_requested_by_user_id']);
        });
    }
};
