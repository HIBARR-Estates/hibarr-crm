<?php

namespace App\Support;

use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\PermissionType;
use App\Models\Role;
use App\Models\User;
use App\Scopes\CompanyScope;

/**
 * The `partner` role: an external agent who refers leads and sees only their
 * own referral book on the Partner dashboard.
 *
 * A partner user holds this role *alongside* `employee`, the same stacking the
 * other custom roles use. `employee` keeps the account on the right panel and
 * module set (user_modules() has no branch for an unknown role), while
 * SyncUserPermissions picks the non-employee role for the permission rows. So
 * everything a partner can do is exactly what is listed here — nothing is
 * inherited from `employee`.
 *
 * Every permission gets an explicit "none" row rather than no row. Some checks
 * compare against 'none' and fall through to "everything" for any other value
 * (see Lead::allLeads), and a missing row reads as false, not 'none'.
 */
class PartnerRole
{
    public const NAME = 'partner';

    /**
     * Permission name => permission type. Everything not listed is none.
     *
     * Referral attribution and the dashboard queries do not go through the
     * lead/deal permissions, so a partner needs no lead or deal access at all.
     *
     * @return array<string, int>
     */
    public static function permissions(): array
    {
        return [
            'view_partner_dashboard' => PermissionType::ALL,
        ];
    }

    /**
     * "Sarah Al-Rashid" → "S. Al-Rashid". A partner may recognise a client by
     * this but cannot use it to reach them.
     */
    public static function abbreviateName(?string $name): ?string
    {
        $parts = array_values(array_filter(explode(' ', trim((string) $name))));

        if (count($parts) < 2) {
            return $parts[0] ?? null;
        }

        return mb_substr($parts[0], 0, 1).'. '.implode(' ', array_slice($parts, 1));
    }

    /**
     * A partner account: holds `partner` and nothing beyond the `employee`
     * baseline it is stacked on. Anyone with another role (admin, manager, …) is
     * staff first and keeps staff access even if `partner` was added to them.
     */
    public static function isPartnerOnly(?User $user): bool
    {
        if (is_null($user)) {
            return false;
        }

        $names = $user->roles->pluck('name');

        return $names->contains(self::NAME)
            && $names->diff([self::NAME, 'employee'])->isEmpty();
    }

    /**
     * Create the role for a company and (re)write its permission rows.
     * Safe to run repeatedly: the rows are rebuilt from permissions() each time.
     */
    public static function ensureFor(int $companyId): Role
    {
        $role = Role::withoutGlobalScope(CompanyScope::class)
            ->where('name', self::NAME)
            ->where('company_id', $companyId)
            ->first();

        if (is_null($role)) {
            $role = new Role;
            $role->name = self::NAME;
            $role->company_id = $companyId;
            $role->display_name = 'Partner';
            $role->description = 'External partner. Sees only the leads they referred and their own commission.';
            $role->saveQuietly();
        }

        $granted = self::permissions();
        $rows = [];

        foreach (Permission::select('id', 'name')->get() as $permission) {
            $rows[] = [
                'permission_id' => $permission->id,
                'role_id' => $role->id,
                'permission_type_id' => $granted[$permission->name] ?? PermissionType::NONE,
            ];
        }

        PermissionRole::where('role_id', $role->id)->delete();

        foreach (array_chunk($rows, 100) as $chunk) {
            PermissionRole::insert($chunk);
        }

        return $role;
    }
}
