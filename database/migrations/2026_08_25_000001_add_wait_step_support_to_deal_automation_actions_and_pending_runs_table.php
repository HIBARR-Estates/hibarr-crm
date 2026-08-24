<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->unsignedInteger('wait_duration_value')->nullable()->after('meta_event_value');
            $table->string('wait_duration_unit', 20)->nullable()->after('wait_duration_value');
        });

        Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
            $table->foreignId('resume_action_id')->nullable()->after('trigger')
                ->constrained('deal_automation_actions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('deal_automation_pending_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('resume_action_id');
        });

        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->dropColumn(['wait_duration_value', 'wait_duration_unit']);
        });
    }
};
