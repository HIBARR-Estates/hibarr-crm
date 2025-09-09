<?php

use App\Models\Module;
use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Modules\Biolinks\Entities\BiolinksGlobalSetting;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $module = Module::firstOrCreate(['module_name' => BiolinksGlobalSetting::MODULE_NAME]);

        $permissions = [
            ['name' => 'add_biolinks', 'display_name' => 'Add Biolinks', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'view_biolinks', 'display_name' => 'View Biolinks', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'edit_biolinks', 'display_name' => 'Edit Biolinks', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'delete_biolinks', 'display_name' => 'Delete Biolinks', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate($permission);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }

};
