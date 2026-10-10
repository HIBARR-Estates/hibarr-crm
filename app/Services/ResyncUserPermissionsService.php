<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;

/**
 * Rebuilds `user_permissions` from each user's role template.
 *
 * Tenant scoping: callers that act on behalf of a single company (the web
 * button) must pass `$companyId`. `null` means "every company" and is only
 * reachable from the CLI, where there is no authenticated tenant.
 */
class ResyncUserPermissionsService
{
    public const CHUNK_SIZE = 100;

    /**
     * @return array{synced: int, skipped_no_role: int, skipped_admin: int}
     */
    public function resync(?int $companyId = null): array
    {
        $synced = 0;
        $skippedNoRole = 0;
        $skippedAdmin = 0;

        $this->query($companyId)
            ->with('roles')
            ->chunkById(self::CHUNK_SIZE, function ($users) use (&$synced, &$skippedNoRole, &$skippedAdmin): void {
                foreach ($users as $user) {
                    if ($this->isAdmin($user)) {
                        // Mirrors addMissingUserPermission(): admin rows are owned by
                        // addMissingAdminPermission(), which already rewrites them.
                        $skippedAdmin++;

                        continue;
                    }

                    $role = $this->primaryPermissionRole($user);

                    if (! $role) {
                        $skippedNoRole++;

                        continue;
                    }

                    $user->assignUserRolePermission($role->id);

                    if ((int) $user->permission_sync !== 1) {
                        $user->permission_sync = 1;
                        $user->saveQuietly();
                    }

                    Cache::forget('sidebar_user_perms_'.$user->id);

                    $synced++;
                }
            });

        return [
            'synced' => $synced,
            'skipped_no_role' => $skippedNoRole,
            'skipped_admin' => $skippedAdmin,
        ];
    }

    /**
     * Backfill missing permission_role rows for every role template.
     */
    public function backfillRoleTemplates(?int $companyId = null): bool
    {
        $arguments = $companyId === null ? [] : ['--company' => $companyId];

        return Artisan::call('add-missing-permissions', $arguments) === Command::SUCCESS;
    }

    private function query(?int $companyId)
    {
        return User::query()
            ->where('customised_permissions', 0)
            ->when(
                $companyId !== null,
                fn ($query) => $query->where('company_id', $companyId)
            );
    }

    private function isAdmin(User $user): bool
    {
        return $user->roles->contains('name', 'admin');
    }

    /**
     * Same rule as the legacy sync job: when a user holds employee plus another
     * role, permissions come from the non-employee role.
     */
    private function primaryPermissionRole(User $user): ?Role
    {
        $roles = $user->roles;

        if ($roles->isEmpty()) {
            return null;
        }

        if ($roles->count() > 1) {
            return $roles->where('name', '!=', 'employee')->first();
        }

        return $roles->first();
    }
}
