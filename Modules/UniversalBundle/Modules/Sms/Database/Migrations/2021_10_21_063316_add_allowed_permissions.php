<?php

use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        $smsModule = \App\Models\Module::firstOrCreate(['module_name' => 'sms']);

        $permission = 'manage_sms_settings';

        $perm = Permission::firstOrCreate([
            'name' => $permission,
            'display_name' => ucwords(str_replace('_', ' ', $permission)),
            'is_custom' => 1,
            'module_id' => $smsModule->id,
        ]);

        Permission::where('name', 'manage_sms_settings')->update(['allowed_permissions' => Permission::ALL_NONE]);
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {

    }
};
