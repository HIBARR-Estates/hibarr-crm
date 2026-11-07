<?php

namespace App\Support;

use App\Models\CompanyDashboardViewer;
use App\Models\User;
use Illuminate\Database\QueryException;

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
        if ($user === null || $user->company_id === null) {
            return false;
        }

        try {
            return CompanyDashboardViewer::query()
                ->where('company_id', $user->company_id)
                ->where('user_id', $user->id)
                ->exists();
        } catch (QueryException) {
            // Before the migration has run there is no list, so nobody is on
            // it. Catching the error costs nothing per request, unlike asking
            // the schema whether the table exists on every dashboard load.
            return false;
        }
    }
}
