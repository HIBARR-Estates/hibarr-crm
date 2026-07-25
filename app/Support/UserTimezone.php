<?php

namespace App\Support;

use App\Models\Company;
use App\Models\User;

class UserTimezone
{
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
}
