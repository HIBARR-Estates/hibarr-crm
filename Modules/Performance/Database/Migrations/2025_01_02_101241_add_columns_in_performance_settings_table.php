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
            $table->text('create_meeting_roles')->nullable()->after('send_notification');
            $table->boolean('create_meeting_manager')->default(false)->after('create_meeting_roles');
            $table->text('view_meeting_roles')->nullable()->after('create_meeting_manager');
            $table->boolean('view_meeting_manager')->default(false)->after('view_meeting_roles');
            $table->boolean('view_meeting_participant')->default(false)->after('view_meeting_manager');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('performance_settings', function (Blueprint $table) {
            $table->dropColumn(['create_meeting_roles', 'create_meeting_manager', 'view_meeting_roles', 'view_meeting_manager', 'view_meeting_participant']);
        });
    }

};
