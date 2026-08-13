<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('qualification_script_settings')) {
            return;
        }

        if (Schema::hasColumn('qualification_script_settings', 'webinar_id')) {
            return;
        }

        Schema::table('qualification_script_settings', function (Blueprint $table) {
            // OL webinar used by the inviteWebinar outcome when the script segment
            // carries no webinarId of its own.
            $table->string('webinar_id', 191)->nullable()->after('auto_write');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('qualification_script_settings', 'webinar_id')) {
            return;
        }

        Schema::table('qualification_script_settings', function (Blueprint $table) {
            $table->dropColumn('webinar_id');
        });
    }
};
