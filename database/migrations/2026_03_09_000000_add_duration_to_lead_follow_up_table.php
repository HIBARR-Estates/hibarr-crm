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
        if (!Schema::hasColumn('lead_follow_up', 'duration')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->unsignedInteger('duration')->nullable()->after('next_follow_up_date')
                    ->comment('Meeting duration in minutes. Defaults to 30 if not set.');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('lead_follow_up', 'duration')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->dropColumn('duration');
            });
        }
    }
};
