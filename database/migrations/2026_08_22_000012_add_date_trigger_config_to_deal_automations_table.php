<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automations', function (Blueprint $table) {
            // Config for trigger = 'date_based' — null for every other trigger.
            $table->string('date_field')->nullable()->after('trigger');
            $table->string('date_recurrence', 20)->nullable()->after('date_field');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automations', function (Blueprint $table) {
            $table->dropColumn(['date_field', 'date_recurrence']);
        });
    }
};
