<?php

namespace App\Email;

use App\Email\Models\EmailPilotAllowlistEntry;
use App\Models\User;
use App\Support\FeatureFlags;

class EmailFeature
{
    public const FLAG = 'crm.email';

    /**
     * Global kill switch for the CRM Email module. Fails closed: an unknown,
     * absent or unresolvable flag reads as off. The pilot allowlist is a
     * separate, additional gate on top of this.
     */
    public static function enabled(): bool
    {
        try {
            return FeatureFlags::enabled(self::FLAG);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * The flag alone never opens Email: the user (or their company) must also
     * be on the pilot allowlist. Anything unresolvable reads as off.
     */
    public static function enabledFor(?User $user): bool
    {
        if (! self::enabled()) {
            return false;
        }

        try {
            return EmailPilotAllowlistEntry::allows($user);
        } catch (\Throwable) {
            return false;
        }
    }
}
