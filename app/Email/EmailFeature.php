<?php

namespace App\Email;

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
}
