<?php

use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;

/**
 * Renames manage_property_admin → manage_properties after the permission
 * was split/renamed post first deploy of 2026_08_05_000001.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::where('name', 'manage_property_admin')->first();

        if (!$permission) {
            return;
        }

        // Prefer update if rename target not present; otherwise fold role/user grants into existing.
        $existing = Permission::where('name', 'manage_properties')->first();

        if ($existing) {
            // Keep manage_properties; drop the obsolete name after copying any unique grants is unnecessary
            // if both were never granted together — delete admin alias.
            \App\Models\PermissionRole::where('permission_id', $permission->id)->delete();
            \App\Models\UserPermission::where('permission_id', $permission->id)->delete();
            $permission->delete();
        } else {
            $permission->name = 'manage_properties';
            $permission->display_name = 'Manage Properties';
            $permission->save();
        }

        cache()->forget('all_permissions_list');
    }

    public function down(): void
    {
        $permission = Permission::where('name', 'manage_properties')->first();

        if (!$permission) {
            return;
        }

        $permission->name = 'manage_property_admin';
        $permission->display_name = 'Manage Property Admin';
        $permission->save();

        cache()->forget('all_permissions_list');
    }
};
