<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            // meta_conversion action: where the conversion value comes from.
            // NULL / 'fixed' = the action's own meta_event_value (the historical
            // behaviour, so every existing action is untouched); 'deal_value' =
            // the triggering deal's current value, read when the event is sent.
            $table->string('meta_event_value_source', 20)->nullable()->after('meta_event_value');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->dropColumn('meta_event_value_source');
        });
    }
};
