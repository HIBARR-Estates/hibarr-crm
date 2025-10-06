<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Add foreign key constraints to meeting_summary table with explicit naming.
     * Note: The table was created without foreign keys, so we just add them.
     */
    public function up(): void
    {
        Schema::table('meeting_summary', function (Blueprint $table) {
            // Add foreign keys with explicit names
            // Note: The table was created without foreign keys, so we just add them
            $table->foreign('meeting_type_id', 'fk_meeting_summary_meeting_type_id')
                  ->references('id')
                  ->on('meeting_types')
                  ->onDelete('set null');
                  
            $table->foreign('deal_id', 'fk_meeting_summary_deal_id')
                  ->references('id')
                  ->on('deals')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('meeting_summary', function (Blueprint $table) {
            // Drop the explicitly named foreign keys
            $table->dropForeign('fk_meeting_summary_meeting_type_id');
            $table->dropForeign('fk_meeting_summary_deal_id');
        });
    }
};