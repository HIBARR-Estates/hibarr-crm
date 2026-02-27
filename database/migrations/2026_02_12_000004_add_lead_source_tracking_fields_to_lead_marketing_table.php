<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds lead source tracking fields: facebook_browser_id, user_agent, ip_address.
     * 
     * @return void
     */
    public function up(): void
    {
        Schema::table('lead_marketing', function (Blueprint $table) {
            $table->string('facebook_browser_id')->nullable()->after('facebook_lead_id');
            $table->text('user_agent')->nullable()->after('facebook_browser_id');
            $table->string('ip_address', 45)->nullable()->after('user_agent');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_marketing', function (Blueprint $table) {
            $table->dropColumn([
                'facebook_browser_id',
                'user_agent',
                'ip_address',
            ]);
        });
    }
};
