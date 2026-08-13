<?php

use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\PermissionType;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermission;
use App\Scopes\CompanyScope;
use Illuminate\Database\Migrations\Migration;

/**
 * Narrows view_partner_dashboard to accounts that actually have referrals.
 *
 * 2026_08_07_000003 granted all four v2 dashboard permissions to the admin role
 * and to every admin user. That is the wrong shape for this one: the partner
 * view is a property of an account (it has referred leads or earned commission),
 * not of a job title, and it sits outside the trust boundary — a staff account
 * holding it sees a Partner tab that can only ever render an empty state.
 *
 * The role grant goes entirely. Direct grants survive only for accounts whose
 * LeadAgent has referral data. Both tables are touched because
 * User::permission() reads user_permissions and ignores permission_role.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::where('name', 'view_partner_dashboard')->first();

        if (is_null($permission)) {
            return;
        }

        // A role grant can only ever say "everyone with this job title", which is
        // never the right answer for a view scoped to one agent's own referrals.
        PermissionRole::where('permission_id', $permission->id)->delete();

        // Downgraded, not deleted. A "none" row grants nothing but is what the
        // permission settings screen renders a toggle from, so removing it takes
        // the control away rather than turning it off.
        UserPermission::where('permission_id', $permission->id)
            ->where('permission_type_id', PermissionType::ALL)
            ->whereNotIn('user_id', $this->partnerUserIds() ?: [0])
            ->update(['permission_type_id' => PermissionType::NONE]);
    }

    public function down(): void
    {
        $permission = Permission::where('name', 'view_partner_dashboard')->first();

        if (is_null($permission)) {
            return;
        }

        foreach (Company::select('id')->get() as $company) {
            $roles = Role::where('company_id', $company->id)->where('name', 'admin')->get();

            foreach ($roles as $role) {
                PermissionRole::updateOrCreate([
                    'permission_id' => $permission->id,
                    'role_id' => $role->id,
                ], [
                    'permission_type_id' => PermissionType::ALL,
                ]);
            }
        }

        // updateOrCreate, not firstOrCreate: up() downgrades these rows to "none"
        // rather than deleting them, so the row is already there and needs
        // raising back to "all".
        foreach (User::allAdmins() as $admin) {
            UserPermission::updateOrCreate([
                'user_id' => $admin->id,
                'permission_id' => $permission->id,
            ], [
                'permission_type_id' => PermissionType::ALL,
            ]);
        }
    }

    /**
     * Users whose agent record has ever introduced a lead or been paid a
     * commission — the only accounts for which the partner view has content.
     *
     * CompanyScope is dropped explicitly rather than relying on there being no
     * authenticated user: this has to cover every company, and the scope would
     * silently narrow it to one if the migration were ever run in a request.
     *
     * @return array<int, int>
     */
    private function partnerUserIds(): array
    {
        $agentIds = Lead::withoutGlobalScope(CompanyScope::class)
            ->whereNotNull('referred_by_agent_id')
            ->distinct()
            ->pluck('referred_by_agent_id')
            ->merge(MlmCommission::query()->distinct()->pluck('agent_id'))
            ->filter()
            ->unique();

        return LeadAgent::withoutGlobalScope(CompanyScope::class)
            ->whereIn('id', $agentIds)
            ->pluck('user_id')
            ->filter()
            ->all();
    }
};
