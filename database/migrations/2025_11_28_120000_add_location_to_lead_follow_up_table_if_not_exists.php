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
        $needsLocation = !Schema::hasColumn('lead_follow_up', 'location');
        $needsMeetingLink = !Schema::hasColumn('lead_follow_up', 'meeting_link');
        
        // Only modify the table if columns need to be added
        if ($needsLocation || $needsMeetingLink) {
            Schema::table('lead_follow_up', function (Blueprint $table) use ($needsLocation, $needsMeetingLink) {
                // Add location column before deal_id if it doesn't exist
                if ($needsLocation) {
                    $table->string('location')->nullable()->before('deal_id');
                }
                
                // Add meeting_link column after location if it doesn't exist
                if ($needsMeetingLink) {
                    $table->string('meeting_link')->nullable()->after('location');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Check for column existence outside the Schema::table() closure
        $hasMeetingLink = Schema::hasColumn('lead_follow_up', 'meeting_link');
        $hasLocation = Schema::hasColumn('lead_follow_up', 'location');
        
        // Only modify the table if at least one column needs dropping
        if ($hasMeetingLink || $hasLocation) {
            Schema::table('lead_follow_up', function (Blueprint $table) use ($hasMeetingLink, $hasLocation) {
                // Drop meeting_link first, then location (preserve existing drop order)
                if ($hasMeetingLink) {
                    $table->dropColumn('meeting_link');
                }
                
                if ($hasLocation) {
                    $table->dropColumn('location');
                }
            });
        }
    }
};

