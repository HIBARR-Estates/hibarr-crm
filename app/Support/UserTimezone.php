<?php

namespace App\Support;

use App\Models\Company;
use App\Models\User;
use Carbon\Carbon;
use InvalidArgumentException;

class UserTimezone
{
    public const FLAG = 'crm.user-timezone';

    /**
     * Resolve display timezone for a user: user → company → UTC.
     */
    public static function resolve(?User $user, ?Company $company = null): string
    {
        if (is_string($user?->timezone) && $user->timezone !== '') {
            return $user->timezone;
        }

        $companyTz = $company?->timezone ?? $user?->company?->timezone;

        if (is_string($companyTz) && $companyTz !== '') {
            return $companyTz;
        }

        return 'UTC';
    }

    /**
     * Timezone for persisting a meeting instant.
     * Non-empty $override (API V2) wins; otherwise {@see resolve()}.
     */
    public static function forWrite(?User $user, ?Company $company = null, ?string $override = null): string
    {
        if (is_string($override) && $override !== '') {
            return $override;
        }

        return self::resolve($user, $company);
    }

    /**
     * Parse a naive wall-clock datetime in the actor's stored timezone and return UTC.
     */
    public static function interpretWallClock(
        ?User $user,
        ?Company $company,
        string $datetime,
        string $format
    ): Carbon {
        $parsed = Carbon::createFromFormat($format, $datetime, self::resolve($user, $company));

        if (! $parsed instanceof Carbon) {
            throw new InvalidArgumentException(
                "Unable to parse datetime [{$datetime}] with format [{$format}]."
            );
        }

        return $parsed->utc();
    }

    /**
     * Viewer timezone for DataTable/report display.
     * Flag off: company timezone (then UTC). Flag on: {@see resolve()}.
     */
    public static function forViewer(?User $user, ?Company $company = null): string
    {
        if (! FeatureFlags::enabled(self::FLAG)) {
            $companyTz = $company?->timezone ?? $user?->company?->timezone;

            return (is_string($companyTz) && $companyTz !== '') ? $companyTz : 'UTC';
        }

        return self::resolve($user, $company);
    }
}
