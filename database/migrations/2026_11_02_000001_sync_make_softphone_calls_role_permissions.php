<?php

use App\Models\Company;
use App\Models\Module;
use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\PermissionType;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermission;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PERMISSION = 'make_softphone_calls';

    public function up(): void
    {
        $module = Module::where('module_name', 'dashboards')->first();

        if ($module === null) {
            return;
        }

        $permission = Permission::updateOrCreate(
            ['name' => self::PERMISSION],
            [
                'display_name' => 'Make Softphone Calls',
                'is_custom' => 1,
                'module_id' => $module->id,
                'allowed_permissions' => Permission::ALL_ADDED_NONE,
            ]
        );

        foreach (Company::select('id')->get() as $company) {
            $roles = Role::where('company_id', $company->id)->get();

            foreach ($roles as $role) {
                $defaultType = match ($role->name) {
                    'admin' => PermissionType::ALL,
                    'employee' => PermissionType::ADDED,
                    default => PermissionType::NONE,
                };

                PermissionRole::firstOrCreate(
                    [
                        'permission_id' => $permission->id,
                        'role_id' => $role->id,
                    ],
                    [
                        'permission_type_id' => $defaultType,
                    ]
                );
            }
        }

        $poolUserIds = Schema::hasTable('softphone_call_agents')
            ? DB::table('softphone_call_agents')
                ->where('active', true)
                ->pluck('user_id')
                ->map(fn ($id) => (int) $id)
                ->all()
            : [];
        $poolUserLookup = array_flip($poolUserIds);

        User::withoutGlobalScope(\App\Scopes\ActiveScope::class)->with('roles')->chunkById(200, function ($users) use ($permission, $poolUserLookup): void {
            foreach ($users as $user) {
                $existing = UserPermission::where('user_id', $user->id)
                    ->where('permission_id', $permission->id)
                    ->first();

                if ($existing !== null) {
                    if (
                        (int) $existing->permission_type_id === PermissionType::NONE
                        && isset($poolUserLookup[(int) $user->id])
                    ) {
                        $existing->permission_type_id = PermissionType::ADDED;
                        $existing->save();
                    }

                    continue;
                }

                $roles = $user->roles;
                if ($roles->isEmpty()) {
                    continue;
                }

                if ($roles->contains('name', 'admin')) {
                    $typeId = PermissionType::ALL;
                } elseif (isset($poolUserLookup[(int) $user->id])) {
                    $typeId = PermissionType::ADDED;
                } else {
                    $primaryRole = $roles->count() > 1
                        ? ($roles->firstWhere('name', '!=', 'employee') ?? $roles->first())
                        : $roles->first();

                    $rolePerm = PermissionRole::where('role_id', $primaryRole->id)
                        ->where('permission_id', $permission->id)
                        ->first();

                    $typeId = $rolePerm ? (int) $rolePerm->permission_type_id : PermissionType::NONE;
                }

                UserPermission::firstOrCreate(
                    [
                        'user_id' => $user->id,
                        'permission_id' => $permission->id,
                    ],
                    [
                        'permission_type_id' => $typeId,
                    ]
                );
            }
        });

        try {
            cache()->forget('all_permissions_list');
        } catch (\Throwable) {
            // Ignore when cache store is unavailable during CLI runs.
        }
    }

    public function down(): void
    {
        // Non-destructive sync migration.
    }
};
