<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A summary is only ever pushed in by the meeting automation, so "still
     * generating" used to be a guess made from the absence of a row, with no
     * end. These record when the CRM last asked for one again, so the page can
     * tell a summary that is on its way from one that never came, and so a
     * retry restarts the wait rather than leaving it stalled.
     */
    public function up(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_follow_up', 'summary_retry_requested_at')) {
                $table->timestamp('summary_retry_requested_at')->nullable();
            }
            if (! Schema::hasColumn('lead_follow_up', 'summary_retry_count')) {
                $table->unsignedSmallInteger('summary_retry_count')->default(0);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            foreach (['summary_retry_requested_at', 'summary_retry_count'] as $column) {
                if (Schema::hasColumn('lead_follow_up', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
