<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('checkout_url', 2048)->nullable()->after('external_reference');
            $table->timestamp('expires_at')->nullable()->after('checkout_url');
            $table->string('ol_status', 64)->nullable()->after('status');
            $table->string('ol_payment_type', 32)->nullable()->after('ol_status');
            $table->unsignedBigInteger('verified_by_user_id')->nullable()->after('ol_payment_type');
            $table->timestamp('verified_at')->nullable()->after('verified_by_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn([
                'checkout_url',
                'expires_at',
                'ol_status',
                'ol_payment_type',
                'verified_by_user_id',
                'verified_at',
            ]);
        });
    }
};
