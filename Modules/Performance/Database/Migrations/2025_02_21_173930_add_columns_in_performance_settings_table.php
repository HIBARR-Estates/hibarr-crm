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
        Schema::table('performance_settings', function (Blueprint $table) {
            $table->enum('meeting_slack_notification', ['yes', 'no'])->default('no')->after('send_email_notification');
            $table->enum('meeting_push_notification', ['yes', 'no'])->default('no')->after('meeting_slack_notification');
            $table->enum('meeting_email_notification', ['yes', 'no'])->default('no')->after('meeting_push_notification');

            $table->renameColumn('send_slack_notification', 'objective_slack_notification');
            $table->renameColumn('send_push_notification', 'objective_push_notification');
            $table->renameColumn('send_email_notification', 'objective_email_notification');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('performance_settings', function (Blueprint $table) {
            $table->renameColumn('objective_slack_notification', 'send_slack_notification');
            $table->renameColumn('objective_push_notification', 'send_push_notification');
            $table->renameColumn('objective_email_notification', 'send_email_notification');

            $table->dropColumn('meeting_slack_notification');
            $table->dropColumn('meeting_push_notification');
            $table->dropColumn('meeting_email_notification');
        });
    }

};
