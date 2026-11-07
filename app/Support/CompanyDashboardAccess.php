<?php

namespace App\Support;

use App\Models\CompanyDashboardViewer;
use App\Models\User;
use Illuminate\Support\Facades\Schema;

/**
 * Who may open the Company dashboard (?view=leadership): only the people on
 * their company's list in Settings → Company dashboard access. Being an admin
 * does not let anyone in; admins manage the list but must be on it to see the
 * view themselves.
 */
final class CompanyDashboardAccess
{
    public static function allows(?User $user): bool
    {
        if ($user === null || $user->company_id === null || ! self::tableReady()) {
            return false;
        }

        return CompanyDashboardViewer::query()
            ->where('company_id', $user->company_id)
            ->where('user_id', $user->id)
            ->exists();
    }

    /** Before the migration has run, nobody is on a list rather than every page erroring. */
    private static function tableReady(): bool
    {
        return Schema::hasTable('company_dashboard_viewers');
    }
}
