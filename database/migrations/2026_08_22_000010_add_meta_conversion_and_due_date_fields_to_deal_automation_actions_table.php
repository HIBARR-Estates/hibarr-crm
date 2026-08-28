<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            // meta_conversion action: event name supports merge tags (rendered
            // at send time), value is the optional conversion value passed to Meta.
            $table->string('meta_event_name')->nullable()->after('recipient_emails');
            $table->decimal('meta_event_value', 10, 2)->nullable()->after('meta_event_name');

            // create_task action: due date as an offset from the moment the
            // automation creates the task (not the triggering deal/lead's own
            // created_at), plus an optional fixed time-of-day for that date.
            // Null delta = no due date, matching today's behavior.
            $table->unsignedInteger('due_date_delta_value')->nullable()->after('assigner_user_id');
            $table->string('due_date_delta_unit', 10)->nullable()->default('days')->after('due_date_delta_value');
            $table->time('due_time')->nullable()->after('due_date_delta_unit');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->dropColumn([
                'meta_event_name',
                'meta_event_value',
                'due_date_delta_value',
                'due_date_delta_unit',
                'due_time',
            ]);
        });
    }
};
