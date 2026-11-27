<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_entries', function (Blueprint $table) {
            // The first-contact SLA OL reported for this entry, as sent:
            // {first_contact_seconds, recommended_method, window}. Frozen like the channel snapshot.
            $table->json('sla')->nullable()->after('channel_tags');
        });
    }

    public function down(): void
    {
        Schema::table('lead_entries', function (Blueprint $table) {
            $table->dropColumn('sla');
        });
    }
};
