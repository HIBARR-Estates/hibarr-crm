<?php

namespace App\Email;

use App\Email\Models\EmailConnection;
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

    /**
     * Lead/deal Quick action gate. Null when the Email control must not appear
     * (flag off or not allowlisted). When present, the UI shows Email and
     * either opens the composer (has a mailbox) or a connect CTA.
     *
     * @return array{has_connection: bool}|null
     */
    public static function quickActionFor(?User $user): ?array
    {
        if (! self::enabledFor($user)) {
            return null;
        }

        try {
            $hasConnection = EmailConnection::withoutGlobalScopes()
                ->where('user_id', $user->id)
                ->where('company_id', $user->company_id)
                ->exists();
        } catch (\Throwable) {
            return null;
        }

        return ['has_connection' => $hasConnection];
    }
}
