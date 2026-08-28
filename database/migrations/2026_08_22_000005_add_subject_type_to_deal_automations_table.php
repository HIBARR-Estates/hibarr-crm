<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automations', function (Blueprint $table) {
            // Existing rows default to 'deal' — behavior for them is unchanged.
            // 'lead' automations aren't pipeline-scoped (pipeline_id stays null for them).
            $table->string('subject_type', 10)->default('deal')->after('pipeline_id');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automations', function (Blueprint $table) {
            $table->dropColumn('subject_type');
        });
    }
};
