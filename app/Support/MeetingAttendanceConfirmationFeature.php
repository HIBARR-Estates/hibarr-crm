<?php

namespace App\Support;

use App\Models\Company;
use Illuminate\Support\Facades\Cache;

class MeetingAttendanceConfirmationFeature
{
    private const ACTIVATION_STAMPED_CACHE_TTL = 3600;

    /**
     * Sole kill switch for the meeting-attendance-confirmation prompt — no
     * per-company opt-in on top of this; once on remotely, it's on for every
     * company.
     */
    public static function globallyEnabled(): bool
    {
        return FeatureFlags::enabled('crm.meeting-attendance-confirmation');
    }

    /**
     * Enabled for this company right now (the global flag). Also lazily
     * stamps companies.meeting_attendance_confirmation_enabled_at the first
     * time this returns true for the company, so meetings that ended before
     * the feature was actually turned on for this company never become
     * eligible later.
     */
    public static function enabledForCompany(Company|int $company): bool
    {
        if (!self::globallyEnabled()) {
            return false;
        }

        self::ensureActivationStamped($company);

        return true;
    }

    /** Company's own override, falling back to the config default. */
    public static function delayMinutes(Company $company): int
    {
        return $company->meeting_attendance_confirmation_delay_minutes
            ?? (int) config('meetings.attendance_confirmation_delay_minutes', 5);
    }

    /** Company's own override, falling back to the config default. */
    public static function snoozeMinutes(Company $company): int
    {
        return $company->meeting_attendance_confirmation_snooze_minutes
            ?? (int) config('meetings.attendance_confirmation_snooze_minutes', 60);
    }

    /**
     * Forget the "already stamped" flag for a company. Call this whenever
     * meeting_attendance_confirmation_enabled_at is written directly (e.g. a
     * manual override from Company Settings) — otherwise a stale cache entry
     * from an earlier activation attempt keeps ensureActivationStamped() from
     * ever re-checking the column, silently ignoring the new value until the
     * cache entry expires on its own.
     */
    public static function clearActivationCache(int $companyId): void
    {
        Cache::forget(self::activationCacheKey($companyId));
    }

    /**
     * When this call performs the write, also patches the in-memory $company
     * instance (if one was passed in) — otherwise a caller that already fetched
     * $company before this call would read a stale null back from it on the
     * very same request that just activated the feature.
     */
    private static function ensureActivationStamped(Company|int $company): void
    {
        $companyId = $company instanceof Company ? (int) $company->id : (int) $company;
        $cacheKey = self::activationCacheKey($companyId);

        if (Cache::get($cacheKey)) {
            return;
        }

        if ($company instanceof Company && $company->meeting_attendance_confirmation_enabled_at) {
            Cache::put($cacheKey, true, self::ACTIVATION_STAMPED_CACHE_TTL);

            return;
        }

        $now = now();
        $updated = Company::query()
            ->where('id', $companyId)
            ->whereNull('meeting_attendance_confirmation_enabled_at')
            ->update(['meeting_attendance_confirmation_enabled_at' => $now]);

        if ($updated && $company instanceof Company) {
            $company->meeting_attendance_confirmation_enabled_at = $now;
        }

        Cache::put($cacheKey, true, self::ACTIVATION_STAMPED_CACHE_TTL);
    }

    private static function activationCacheKey(int $companyId): string
    {
        return "meeting_attendance_confirmation:activated:{$companyId}";
    }
}
