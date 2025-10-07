<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Note: This migration only adds the foreign key constraint.
     * The columns (meeting_type_id, location, meeting_link) already exist
     * from a previous migration.
     */
    public function up(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            // Add foreign key constraint with explicit naming
            // Note: Columns already exist from previous migration
            $table->foreign('meeting_type_id', 'fk_lead_follow_up_meeting_type_id')
                  ->references('id')
                  ->on('meeting_types')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            // Drop foreign key constraint only
            // Note: Don't drop columns as they were added by previous migration
            $table->dropForeign('fk_lead_follow_up_meeting_type_id');
        });
    }
};
