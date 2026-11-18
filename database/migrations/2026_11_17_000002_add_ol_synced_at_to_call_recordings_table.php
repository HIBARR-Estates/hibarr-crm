<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When OL's call bridge confirmed it stored the recording. A recording left
 * NULL is re-sent by `call-recordings:sync-to-call-bridge`, which is what makes
 * a failed registration recoverable when no queue worker retries the job.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('call_recordings', function (Blueprint $table) {
            if (! Schema::hasColumn('call_recordings', 'ol_synced_at')) {
                $table->timestamp('ol_synced_at')->nullable()->index()->after('expires_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('call_recordings', function (Blueprint $table) {
            if (Schema::hasColumn('call_recordings', 'ol_synced_at')) {
                $table->dropIndex(['ol_synced_at']);
                $table->dropColumn('ol_synced_at');
            }
        });
    }
};
