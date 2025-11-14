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
            // Add JSON column for multiple reminders
            $table->json('reminders')->nullable()->after('remind_type');
            
            // Add deal_id column to link to deals table instead of leads
            if (!Schema::hasColumn('lead_follow_up', 'deal_id')) {
                $table->unsignedBigInteger('deal_id')->nullable()->after('lead_id');
            }
            
            // Add status column if it doesn't exist
            if (!Schema::hasColumn('lead_follow_up', 'status')) {
                $table->enum('status', ['scheduled', 'completed', 'cancelled'])->default('scheduled')->after('remind_type');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->dropColumn(['reminders']);
            
            if (Schema::hasColumn('lead_follow_up', 'deal_id')) {
                $table->dropColumn('deal_id');
            }
            
            if (Schema::hasColumn('lead_follow_up', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
