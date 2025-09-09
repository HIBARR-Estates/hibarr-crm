<?php

use App\Models\Module;
use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Modules\Letter\Entities\LetterSetting;

return new class extends Migration
{

    public function up()
    {

        $module = Module::firstOrCreate(['module_name' => LetterSetting::MODULE_NAME]);

        $permissions = [
            ['name' => 'add_letter', 'display_name' => 'Add letter', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'view_letter', 'display_name' => 'View letter', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'edit_letter', 'display_name' => 'Edit letter', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'delete_letter', 'display_name' => 'Delete letter', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'add_template', 'display_name' => 'Add template', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE, 'is_custom' => 1],
            ['name' => 'view_template', 'display_name' => 'View template', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE, 'is_custom' => 1],
            ['name' => 'edit_template', 'display_name' => 'Edit template', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE, 'is_custom' => 1],
            ['name' => 'delete_template', 'display_name' => 'Delete template', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE, 'is_custom' => 1],
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate($permission);
        }

    }

};
