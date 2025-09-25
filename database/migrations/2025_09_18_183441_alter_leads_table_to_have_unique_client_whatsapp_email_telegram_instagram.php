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
        Schema::table('leads', function (Blueprint $table) {
        
            //
            $table->unique('client_whatsapp', 'leads_client_whatsapp_unique');
            $table->unique('client_email', 'leads_client_email_unique');
            $table->unique('client_telegram', 'leads_client_telegram_unique');
            $table->unique('client_instagram', 'leads_client_instagram_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            //
            $table->dropUnique('leads_client_whatsapp_unique');
            $table->dropUnique('leads_client_email_unique');
            $table->dropUnique('leads_client_telegram_unique');
            $table->dropUnique('leads_client_instagram_unique');
        });
    }
};
