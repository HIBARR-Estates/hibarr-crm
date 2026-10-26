<?php

use App\Models\Company;
use App\Models\PermissionRole;
use App\Models\Role;
use App\Models\RoleUser;
use App\Scopes\CompanyScope;
use App\Support\PartnerRole;
use Illuminate\Database\Migrations\Migration;

/**
 * Creates the `partner` role for every existing company. New companies get it
 * from CompanyObserver::roles().
 *
 * Only the role and its permission rows are created. No user is moved onto it:
 * accounts already flagged is_partner keep whatever they have today, and are
 * re-pointed (or invited fresh) deliberately by an admin.
 *
 * Requires 2026_08_07_000003 to have created view_partner_dashboard; without it
 * the role is still created, as all-none.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (Company::select('id')->get() as $company) {
            PartnerRole::ensureFor((int) $company->id);
        }
    }

    public function down(): void
    {
        $roles = Role::withoutGlobalScope(CompanyScope::class)
            ->where('name', PartnerRole::NAME)
            ->get();

        foreach ($roles as $role) {
            RoleUser::where('role_id', $role->id)->delete();
            PermissionRole::where('role_id', $role->id)->delete();
            $role->delete();
        }
    }
};
