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
        Schema::table('lead_marketing', function (Blueprint $table) {
            $table->boolean('has_joined_the_whatsapp_group')->default(false)->after('has_joined_the_facebook_group');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_marketing', function (Blueprint $table) {
            $table->dropColumn('has_joined_the_whatsapp_group');
        });
    }
};
