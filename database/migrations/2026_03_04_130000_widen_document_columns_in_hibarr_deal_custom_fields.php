<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Widen document columns in hibarr_deal_custom_fields to TEXT
 * so they can store full external URLs (which may exceed VARCHAR 255).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hibarr_deal_custom_fields')) {
            Schema::table('hibarr_deal_custom_fields', function (Blueprint $table) {
                // Change from string(255) to text to accommodate external URLs
                if (Schema::hasColumn('hibarr_deal_custom_fields', 'deposit_confirmation')) {
                    $table->text('deposit_confirmation')->nullable()->change();
                }
                if (Schema::hasColumn('hibarr_deal_custom_fields', 'reservation_agreement')) {
                    $table->text('reservation_agreement')->nullable()->change();
                }
                if (Schema::hasColumn('hibarr_deal_custom_fields', 'sales_contract')) {
                    $table->text('sales_contract')->nullable()->change();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('hibarr_deal_custom_fields')) {
            Schema::table('hibarr_deal_custom_fields', function (Blueprint $table) {
                if (Schema::hasColumn('hibarr_deal_custom_fields', 'deposit_confirmation')) {
                    $table->string('deposit_confirmation')->nullable()->change();
                }
                if (Schema::hasColumn('hibarr_deal_custom_fields', 'reservation_agreement')) {
                    $table->string('reservation_agreement')->nullable()->change();
                }
                if (Schema::hasColumn('hibarr_deal_custom_fields', 'sales_contract')) {
                    $table->string('sales_contract')->nullable()->change();
                }
            });
        }
    }
};
