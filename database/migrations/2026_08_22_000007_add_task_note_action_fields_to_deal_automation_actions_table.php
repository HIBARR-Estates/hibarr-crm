<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->string('title')->nullable()->after('email_template_id');
            $table->text('content')->nullable()->after('title');

            // 'specific_user' | 'lead_owner' — resolved at execution time.
            $table->string('assignee_type', 20)->nullable()->after('content');
            $table->unsignedInteger('assignee_user_id')->nullable()->after('assignee_type');

            $table->string('assigner_type', 20)->nullable()->after('assignee_user_id');
            $table->unsignedInteger('assigner_user_id')->nullable()->after('assigner_type');

            $table->foreign('assignee_user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('assigner_user_id')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('deal_automation_actions', function (Blueprint $table) {
            $table->dropForeign(['assignee_user_id']);
            $table->dropForeign(['assigner_user_id']);
            $table->dropColumn(['title', 'content', 'assignee_type', 'assignee_user_id', 'assigner_type', 'assigner_user_id']);
        });
    }
};
