<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use App\Services\ResyncUserPermissionsService;
use Illuminate\Console\Command;
use Symfony\Component\Console\Output\ConsoleOutput;

class SyncUserPermissions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sync-user-permissions
                            {all?}
                            {--resync-all : Backfill role templates and rebuild user_permissions for users with standard role permissions}
                            {--company= : Scope --resync-all to a single company_id. Omit to resync every company (CLI only).}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync user_permissions from each user\'s role (permission_role)';

    /**
     * Note on behaviour: a user with no role is NOT marked permission_sync = 1,
     * so they are retried on the next run. Previously they were marked synced
     * despite the sync doing nothing, which permanently hid them. The scheduler
     * runs this every minute, so the "no role" line is a warning rather than an
     * error — it repeats for a genuinely role-less user by design.
     */

    public function handle(ResyncUserPermissionsService $resync)
    {
        if ($this->option('resync-all')) {
            return $this->resyncAllUsersFromRoles($resync);
        }

        $output = new ConsoleOutput;

        $unsyncedUsers = User::with('roles')
            ->where('permission_sync', 0)
            ->when($this->argument('all'), function ($query) {
                return $query->get();
            }, function ($query) {
                return $query->limit(10)->get();
            });

        if ($unsyncedUsers->isEmpty()) {
            $output->writeln('<info>All user permissions are synced</info>');

            return Command::SUCCESS;
        }

        $total = $unsyncedUsers->count();

        $unsyncedUsers->each(function ($user, $key) use ($total, $output) {
            $remaining = $total - $key;

            if ($this->syncUserFromRole($user, $remaining, $output)) {
                $user->permission_sync = 1;
                $user->saveQuietly();
            }
        });

        return Command::SUCCESS;
    }

    private function resyncAllUsersFromRoles(ResyncUserPermissionsService $resync): int
    {
        $rawCompany = $this->option('company');

        if ($rawCompany === null) {
            $companyId = null;
        } else {
            if (! ctype_digit((string) $rawCompany) || (int) $rawCompany <= 0) {
                $this->error('Invalid --company value. Expected a positive integer company ID.');

                return Command::FAILURE;
            }

            $companyId = (int) $rawCompany;
        }

        $this->info('Backfilling missing permissions on role templates…');

        if (! $resync->backfillRoleTemplates($companyId)) {
            $this->error('add-missing-permissions failed');

            return Command::FAILURE;
        }

        $counts = $resync->resync($companyId);

        $this->info("Resynced permissions for {$counts['synced']} user(s). Skipped {$counts['skipped_no_role']} with no role and {$counts['skipped_admin']} admin user(s).");

        return Command::SUCCESS;
    }

    private function syncUserFromRole(User $user, ?int $remaining, ConsoleOutput $output): bool
    {
        if ($remaining !== null) {
            // phpcs:ignore
            $output->writeln('<info>Remaining: '.$remaining.' Syncing permission started for '.$user->name.'</info>');
        }

        $role = $this->primaryPermissionRole($user);

        if (! $role) {
            if ($remaining !== null) {
                // phpcs:ignore
                $output->writeln('<comment>Role not found for '.$user->name.' — will retry next run</comment>');
            }

            return false;
        }

        $user->assignUserRolePermission($role->id);

        if ($remaining !== null) {
            // phpcs:ignore
            $output->writeln('<info>Remaining: '.$remaining.' Syncing permission ended for '.$user->name.'</info>');
        }

        return true;
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
