<?php

namespace App\Support;

use App\Models\Company;

class ReminderFeature
{
    /**
     * Global kill switch for entity-reminder workers / sync.
     * Prefer the remote feature flag; ENTITY_REMINDERS_FORCE_ENABLE bypasses it
     * when the flags API is down or the flag is not yet rolled out remotely.
     */
    public static function globallyEnabled(): bool
    {
        if ((bool) config('reminders.force_enable', false)) {
            return true;
        }

        return FeatureFlags::enabled('crm.entity-reminders');
    }

    public static function enabledForCompany(Company|int $company): bool
    {
        if (! self::globallyEnabled()) {
            return false;
        }

        $companyId = $company instanceof Company ? (int) $company->id : (int) $company;

        return self::companyInAllowlist($companyId);
    }

    public static function companyInAllowlist(int $companyId): bool
    {
        $raw = trim((string) config('reminders.entity_reminders_company_allowlist', ''));

        if ($raw === '') {
            return false;
        }

        if ($raw === '*') {
            return true;
        }

        $ids = array_filter(array_map('intval', preg_split('/\s*,\s*/', $raw) ?: []));

        return in_array($companyId, $ids, true);
    }
}
