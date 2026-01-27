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
        // Check for column existence outside the Schema::table() closure
        $needsParticipants = !Schema::hasColumn('lead_follow_up', 'participants');
        
        // Only modify the table if column needs to be added
        if ($needsParticipants) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                // Add participants JSON column to store array of user IDs
                $table->json('participants')->nullable()->after('meeting_link');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Check for column existence outside the Schema::table() closure
        $hasParticipants = Schema::hasColumn('lead_follow_up', 'participants');
        
        // Only modify the table if column needs dropping
        if ($hasParticipants) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->dropColumn('participants');
            });
        }
    }
};
