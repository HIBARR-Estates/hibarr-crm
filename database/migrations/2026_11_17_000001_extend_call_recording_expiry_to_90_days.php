<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Call recordings used to be kept for 30 days and are now kept for 90. This
 * moves the expiry of every recording still on the 30-day policy 60 days
 * later, so recordings that already exist get the same 90 days as new ones.
 * That includes recordings that expired less than 60 days ago: expiry never
 * deleted the audio, so they become playable again.
 *
 * A row's policy is read from its own dates (expiry minus upload), not from a
 * rollout timestamp. So recordings uploaded under the new code before this
 * migration ran are left alone, and re-running either direction after a
 * partial failure never shifts a row twice. Everything runs in one
 * transaction, so a failure leaves no rows half-moved.
 */
return new class extends Migration
{
    private const EXTRA_DAYS = 60;

    /** Expiry spans up to this many days count as the old 30-day policy. */
    private const OLD_POLICY_MAX_DAYS = 31;

    /** Expiry spans from this many days count as the new 90-day policy. */
    private const NEW_POLICY_MIN_DAYS = 89;

    public function up(): void
    {
        $this->shiftExpiry(
            self::EXTRA_DAYS,
            fn (float $spanDays): bool => $spanDays <= self::OLD_POLICY_MAX_DAYS,
        );
    }

    public function down(): void
    {
        $this->shiftExpiry(
            -self::EXTRA_DAYS,
            fn (float $spanDays): bool => $spanDays >= self::NEW_POLICY_MIN_DAYS,
        );
    }

    /**
     * Done row by row in PHP rather than with SQL date arithmetic, so it runs
     * the same on MySQL and on the sqlite test database.
     *
     * @param  callable(float): bool  $onPolicy  whether a row with this expiry span is moved
     */
    private function shiftExpiry(int $days, callable $onPolicy): void
    {
        if (! Schema::hasTable('call_recordings')) {
            return;
        }

        DB::transaction(function () use ($days, $onPolicy): void {
            DB::table('call_recordings')
                ->whereNotNull('expires_at')
                // Without an upload time the policy cannot be told apart.
                ->whereNotNull('created_at')
                ->select(['id', 'expires_at', 'created_at'])
                ->chunkById(500, function ($rows) use ($days, $onPolicy): void {
                    foreach ($rows as $row) {
                        $expiresAt = Carbon::parse($row->expires_at);
                        $spanDays = Carbon::parse($row->created_at)->diffInSeconds($expiresAt, false) / 86400;

                        if (! $onPolicy($spanDays)) {
                            continue;
                        }

                        DB::table('call_recordings')
                            ->where('id', $row->id)
                            ->update(['expires_at' => $expiresAt->addDays($days)]);
                    }
                });
        });
    }
};
