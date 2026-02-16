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
        Schema::table('developers', function (Blueprint $table) {
            $table->json('project_list')->nullable()->after('description')
                ->comment('JSON array of project name strings for this construction company');
            $table->string('whatsapp_group_link', 500)->nullable()->after('project_list')
                ->comment('WhatsApp group invite link shared across all projects of this company');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('developers', function (Blueprint $table) {
            $table->dropColumn(['project_list', 'whatsapp_group_link']);
        });
    }
};
