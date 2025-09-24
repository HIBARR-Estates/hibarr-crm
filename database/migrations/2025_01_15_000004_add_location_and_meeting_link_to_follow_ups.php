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
        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->enum('location', ['office', 'zoom', 'zoho_meet', 'google_meet'])->default('office')->after('meeting_type_id');
            $table->text('meeting_link')->nullable()->after('location');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->dropColumn(['location', 'meeting_link']);
        });
    }
};
