<?php

namespace App\Support;

use App\Models\PermissionType;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Who hears about a partner flag.
 *
 * Admins always. With $includePermissionHolders (the crm.partner-flag-routing
 * flag), also every active user holding manage_partner_flags = all — the people
 * who can answer it, who until now were only told if they happened to open the
 * Manager dashboard. Partner-only accounts are never recipients, whatever they
 * hold.
 */
class PartnerFlagRecipients
{
    /** @return Collection<int, User> */
    public static function resolve(int $companyId, bool $includePermissionHolders): Collection
    {
        $admins = User::allAdmins($companyId);

        if (! $includePermissionHolders) {
            return $admins;
        }

        $holderIds = DB::table('user_permissions')
            ->join('permissions', 'permissions.id', '=', 'user_permissions.permission_id')
            ->where('permissions.name', 'manage_partner_flags')
            ->where('user_permissions.permission_type_id', PermissionType::ALL)
            ->pluck('user_permissions.user_id');

        if ($holderIds->isEmpty()) {
            return $admins;
        }

        $holders = User::withOut('clientDetails')
            ->withoutGlobalScope(\App\Scopes\CompanyScope::class)
            ->where('users.company_id', $companyId)
            ->where('users.status', 'active')
            ->whereIn('users.id', $holderIds)
            ->with('roles')
            ->get()
            ->reject(fn (User $user) => PartnerRole::isPartnerOnly($user));

        return $admins->merge($holders)->unique('id')->values();
    }
}
