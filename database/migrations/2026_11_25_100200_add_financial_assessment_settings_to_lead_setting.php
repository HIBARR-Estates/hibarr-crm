<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-company financial assessment defaults, kept on the existing lead
 * settings row: the reporting currency (null = the company's own currency)
 * and how many days until an assessment is due for a refresh.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lead_setting')) {
            return;
        }

        Schema::table('lead_setting', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_setting', 'financial_reporting_currency')) {
                $table->char('financial_reporting_currency', 3)->nullable();
            }
            if (! Schema::hasColumn('lead_setting', 'financial_refresh_after_days')) {
                $table->unsignedSmallInteger('financial_refresh_after_days')->default(90);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('lead_setting')) {
            return;
        }

        Schema::table('lead_setting', function (Blueprint $table) {
            foreach (['financial_reporting_currency', 'financial_refresh_after_days'] as $column) {
                if (Schema::hasColumn('lead_setting', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
