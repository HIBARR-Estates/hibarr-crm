<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Symfony\Component\Console\Output\ConsoleOutput;

class SyncUserPermissions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'sync-user-permissions {all?} {--resync-all : Backfill role templates and rebuild user_permissions for every user with standard role permissions}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync user_permissions from each user\'s role (permission_role)';

    public function handle()
    {
        if ($this->option('resync-all')) {
            return $this->resyncAllUsersFromRoles();
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

        $unsyncedUsers->each(function ($user, $key) use ($total) {
            $remaining = $total - $key;

            if ($this->syncUserFromRole($user, $remaining)) {
                $user->permission_sync = 1;
                $user->saveQuietly();
            }
        });

        return Command::SUCCESS;
    }

    private function resyncAllUsersFromRoles(): int
    {
        $this->info('Backfilling missing permissions on role templates…');

        if (Artisan::call('add-missing-permissions') !== Command::SUCCESS) {
            $this->error('add-missing-permissions failed');

            return Command::FAILURE;
        }

        $synced = 0;
        $skipped = 0;

        User::query()
            ->where('customised_permissions', 0)
            ->with('roles')
            ->chunkById(100, function ($users) use (&$synced, &$skipped) {
                foreach ($users as $user) {
                    if ($this->syncUserFromRole($user)) {
                        $user->permission_sync = 1;
                        $user->saveQuietly();
                        cache()->forget('sidebar_user_perms_'.$user->id);
                        $synced++;
                    } else {
                        $skipped++;
                    }
                }
            });

        $this->info("Resynced permissions for {$synced} user(s). Skipped {$skipped} with no role.");

        return Command::SUCCESS;
    }

    private function syncUserFromRole(User $user, ?int $remaining = null): bool
    {
        $output = new ConsoleOutput;

        if ($remaining !== null) {
            // phpcs:ignore
            $output->writeln('<info>Remaining: '.$remaining.' Syncing permission started for '.$user->name.'</info>');
        }

        $role = $this->primaryPermissionRole($user);

        if (! $role) {
            if ($remaining !== null) {
                // phpcs:ignore
                $output->writeln('<error>Role not found for '.$user->name.'</error>');
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
    private function primaryPermissionRole(User $user): ?\App\Models\Role
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
