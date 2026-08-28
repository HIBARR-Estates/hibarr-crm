<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            // send_email recipient targeting. Null recipient_types means "not
            // configured yet" — DealAutomationService falls back to ['client']
            // so existing send_email actions keep their old behavior untouched.
            $table->json('recipient_types')->nullable()->after('email_template_id');
            $table->json('recipient_user_ids')->nullable()->after('recipient_types');
            $table->text('recipient_emails')->nullable()->after('recipient_user_ids');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->dropColumn(['recipient_types', 'recipient_user_ids', 'recipient_emails']);
        });
    }
};
