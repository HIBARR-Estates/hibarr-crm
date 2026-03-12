<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->string('action_type', 30)->default('stage_transition')->after('deal_automation_id');
            $table->string('field_name')->nullable()->after('forward_only');
            $table->string('field_value')->nullable()->after('field_name');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->dropColumn(['action_type', 'field_name', 'field_value']);
        });
    }
};
