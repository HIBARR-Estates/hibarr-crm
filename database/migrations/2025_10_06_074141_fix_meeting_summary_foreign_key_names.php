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
        Schema::table('meeting_summary', function (Blueprint $table) {
            // Drop existing foreign keys (Laravel's default naming)
            $table->dropForeign(['meeting_type_id']);
            $table->dropForeign(['deal_id']);
            
            // Recreate with explicit names
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
            
            // Recreate with Laravel's default naming (for rollback)
            $table->foreign('meeting_type_id')
                  ->references('id')
                  ->on('meeting_types')
                  ->onDelete('set null');
                  
            $table->foreign('deal_id')
                  ->references('id')
                  ->on('deals')
                  ->onDelete('cascade');
        });
    }
};