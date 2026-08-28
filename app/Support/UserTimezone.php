<?php

namespace App\Support;

use App\Models\Company;
use App\Models\User;

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
