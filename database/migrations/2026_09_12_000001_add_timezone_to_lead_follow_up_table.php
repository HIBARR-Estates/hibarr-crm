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
        if (! Schema::hasColumn('lead_follow_up', 'timezone')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                // IANA zone the meeting was booked in (the creator's own, or
                // the host's when switched in the form). next_follow_up_date
                // stays UTC — this is what the entered wall-clock time meant,
                // and what OL/Zoho renders the calendar event in.
                $table->string('timezone', 64)->nullable()->after('next_follow_up_date');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('lead_follow_up', 'timezone')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                $table->dropColumn('timezone');
            });
        }
    }
};
