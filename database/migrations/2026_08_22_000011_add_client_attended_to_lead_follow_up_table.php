<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            // Tri-state, not a plain default-false boolean: null = not yet
            // confirmed either way (the common case right after a meeting is
            // scheduled), true = client confirmed attended, false = confirmed
            // no-show. Set manually after the meeting, not inferred automatically.
            $table->boolean('client_attended')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('lead_follow_up', function (Blueprint $table) {
            $table->dropColumn('client_attended');
        });
    }
};
