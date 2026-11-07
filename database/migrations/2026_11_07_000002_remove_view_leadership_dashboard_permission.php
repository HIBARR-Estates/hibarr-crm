<?php

use App\Models\Module;
use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The Company dashboard is no longer gated by a permission but by the
 * company_dashboard_viewers list, so view_leadership_dashboard is removed
 * along with every role and user grant of it. Leaving it would show a
 * permission in role settings that no longer does anything.
 */
return new class extends Migration
{
    private const NAME = 'view_leadership_dashboard';

    public function up(): void
    {
        $permissionId = DB::table('permissions')->where('name', self::NAME)->value('id');

        if ($permissionId === null) {
            return;
        }

        DB::table('user_permissions')->where('permission_id', $permissionId)->delete();
        DB::table('permission_role')->where('permission_id', $permissionId)->delete();
        DB::table('permissions')->where('id', $permissionId)->delete();
    }

    /** Puts the permission back with no grants; access then needs re-granting. */
    public function down(): void
    {
        $module = Module::where('module_name', 'dashboards')->first();

        if ($module === null) {
            return;
        }

        Permission::firstOrCreate(
            ['name' => self::NAME],
            [
                'display_name' => 'View Leadership Dashboard',
                'is_custom' => 1,
                'module_id' => $module->id,
                'allowed_permissions' => Permission::ALL_NONE,
            ],
        );
    }
};
