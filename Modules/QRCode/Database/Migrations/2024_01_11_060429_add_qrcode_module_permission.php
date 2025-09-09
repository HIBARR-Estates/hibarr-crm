<?php

use App\Models\Company;
use App\Models\Module;
use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Modules\QRCode\Entities\QRCodeSetting;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $module = Module::firstOrCreate(['module_name' => 'qrcode']);

        $permissions = [
            ['name' => 'add_qrcode', 'display_name' => 'Add QrCode', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'view_qrcode', 'display_name' => 'View QrCode', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'edit_qrcode', 'display_name' => 'Edit QrCode', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
            ['name' => 'delete_qrcode', 'display_name' => 'Delete QrCode', 'module_id' => $module->id, 'allowed_permissions' => Permission::ALL_NONE],
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate($permission);
        }

        $companies = Company::all();

        foreach ($companies as $company) {
            QRCodeSetting::addModuleSetting($company);
        }
    }

};
