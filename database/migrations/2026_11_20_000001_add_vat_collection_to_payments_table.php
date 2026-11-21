<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Checkout collects the net amount; KDV comes on top once the customer
     * asks for an invoice. It is collected one of three ways: a second
     * payment request for the KDV (vat_for_payment_id points to the payment
     * it belongs to), cash, or outside the CRM. A settled payment records
     * how, when and by whom.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->unsignedInteger('vat_for_payment_id')->nullable()->index();
            $table->timestamp('vat_settled_at')->nullable();
            $table->string('vat_settlement_method', 16)->nullable();
            $table->unsignedInteger('vat_settled_by_user_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['vat_for_payment_id', 'vat_settled_at', 'vat_settlement_method', 'vat_settled_by_user_id']);
        });
    }
};
