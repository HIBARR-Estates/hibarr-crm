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
            // Check if location column exists, if not add it
            if (!Schema::hasColumn('lead_follow_up', 'location')) {
                $table->string('location')->nullable()->before('deal_id');
            }
            
            // Also check for meeting_link as it's often added together
            if (!Schema::hasColumn('lead_follow_up', 'meeting_link')) {
                $table->string('meeting_link')->nullable()->after('location');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            // Only drop the columns if they exist
            if (Schema::hasColumn('lead_follow_up', 'meeting_link')) {
                $table->dropColumn('meeting_link');
            }
            
            if (Schema::hasColumn('lead_follow_up', 'location')) {
                $table->dropColumn('location');
            }
        });
    }
};

