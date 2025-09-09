<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use App\Models\Module;
use App\Models\Permission;
use Modules\Webhooks\Entities\WebhooksGlobalSetting;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $module = Module::firstOrCreate(['module_name' => 'webhooks']);

        $permissions = [
            ['name' => 'add_webhooks', 'display_name' => 'Add Webhooks', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'view_webhooks', 'display_name' => 'View Webhooks', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'edit_webhooks', 'display_name' => 'Edit Webhooks', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'delete_webhooks', 'display_name' => 'Delete Webhooks', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'view_webhooks_logs', 'display_name' => 'View Webhooks Logs', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE, 'is_custom' => 1],
        ];

        foreach ($permissions as $permission) {
            Permission::updateOrCreate(
                ['name' => $permission['name']],
                $permission
            );
        }

        $companies = Company::all();

        foreach ($companies as $company) {
            WebhooksGlobalSetting::addModuleSetting($company);
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
