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
            $table->string('client_whatsapp')->nullable()->after('client_email');
            $table->string('client_instagram')->nullable()->after('client_whatsapp');
            $table->string('client_telegram')->nullable()->after('client_instagram');
            
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            //
            $table->dropColumn(['client_whatsapp', 'client_instagram', 'client_telegram']);
        });
    }
};
