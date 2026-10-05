<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automations', function (Blueprint $table) {
            // meeting_attended trigger scope: the meeting types (meeting_types.id)
            // the automation fires for. NULL / empty = every meeting type, so
            // existing automations are unchanged.
            $table->json('meeting_type_ids')->nullable()->after('date_recurrence');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automations', function (Blueprint $table) {
            $table->dropColumn('meeting_type_ids');
        });
    }
};
