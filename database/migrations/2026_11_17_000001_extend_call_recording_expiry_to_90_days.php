<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Call recordings used to be kept for 30 days and are now kept for 90. This
 * moves every stored expiry date 60 days later, so recordings that already
 * exist get the same 90 days as new ones. That includes recordings that
 * expired less than 60 days ago: expiry never deleted the audio, so they
 * become playable again. Rows with no expiry date are left alone.
 */
return new class extends Migration
{
    private const EXTRA_DAYS = 60;

    public function up(): void
    {
        $this->shiftExpiry(self::EXTRA_DAYS);
    }

    public function down(): void
    {
        $this->shiftExpiry(-self::EXTRA_DAYS);
    }

    /**
     * Done row by row in PHP rather than with SQL date arithmetic, so it runs
     * the same on MySQL and on the sqlite test database.
     */
    private function shiftExpiry(int $days): void
    {
        if (! Schema::hasTable('call_recordings')) {
            return;
        }

        DB::table('call_recordings')
            ->whereNotNull('expires_at')
            ->select(['id', 'expires_at'])
            ->chunkById(500, function ($rows) use ($days) {
                foreach ($rows as $row) {
                    DB::table('call_recordings')
                        ->where('id', $row->id)
                        ->update([
                            'expires_at' => Carbon::parse($row->expires_at)->addDays($days),
                        ]);
                }
            });
    }
};
