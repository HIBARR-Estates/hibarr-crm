<?php

namespace App\Support;

use App\Models\Company;

class ReminderFeature
{
    public static function enabledForCompany(Company|int $company): bool
    {
        if (!FeatureFlags::enabled('crm.entity-reminders')) {
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
