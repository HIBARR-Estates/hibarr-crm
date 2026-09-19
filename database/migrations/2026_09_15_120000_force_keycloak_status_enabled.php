<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Keycloak is the only supported sign-in method and the app no longer
     * reads keycloak_status to gate it (LoginController, SocialAuthSettingController
     * both force it on) — this backfills existing rows and flips the column
     * default so a fresh install starts consistent with that too.
     */
    public function up(): void
    {
        DB::table('social_auth_settings')->update(['keycloak_status' => 'enable']);

        DB::statement("ALTER TABLE social_auth_settings MODIFY keycloak_status ENUM('enable', 'disable') NOT NULL DEFAULT 'enable'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE social_auth_settings MODIFY keycloak_status ENUM('enable', 'disable') NOT NULL DEFAULT 'disable'");
    }
};
