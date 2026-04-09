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
        Schema::table('social_auth_settings', function (Blueprint $table) {
            $table->string('keycloak_client_id')->nullable();
            $table->string('keycloak_secret_id')->nullable();
            $table->string('keycloak_base_url')->nullable();
            $table->string('keycloak_realm')->nullable();
            $table->enum('keycloak_status', ['enable', 'disable'])->default('disable');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('social_auth_settings', function (Blueprint $table) {
            $table->dropColumn([
                'keycloak_client_id',
                'keycloak_secret_id',
                'keycloak_base_url',
                'keycloak_realm',
                'keycloak_status',
            ]);
        });
    }
};
