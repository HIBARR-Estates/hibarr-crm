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


            // check wether the column(meeting_type_id) exists, if it does not add the column
            if (!Schema::hasColumn('lead_follow_up', 'meeting_type_id')) {
                $table->unsignedBigInteger('meeting_type_id')->nullable();
            }

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
            // Drop foreign key constraint first
            $table->dropForeign('fk_lead_follow_up_meeting_type_id');
            
            // Drop the column if it exists (only drop what we added)
            if (Schema::hasColumn('lead_follow_up', 'meeting_type_id')) {
                $table->dropColumn('meeting_type_id');
            }
        });
    }
};
