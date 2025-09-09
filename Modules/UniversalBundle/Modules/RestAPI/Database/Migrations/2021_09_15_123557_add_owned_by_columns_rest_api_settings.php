<?php

use App\Models\Permission;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\RestAPI\Entities\RestAPISetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (! Schema::hasColumn('rest_api_settings', 'added_by')) {
            Schema::table('rest_api_settings', function (Blueprint $table) {
                $table->integer('added_by')->unsigned()->nullable();
                $table->foreign('added_by')->references('id')->on('users')->onDelete('SET NULL')->onUpdate('cascade');

                $table->integer('last_updated_by')->unsigned()->nullable();
                $table->foreign('last_updated_by')->references('id')->on('users')->onDelete('SET NULL')->onUpdate('cascade');
            });
        }

        $restAPIModule = \App\Models\Module::firstOrCreate(['module_name' => 'restapi']);

        $admin = User::allAdmins()->first();

        if (! is_null($admin)) {
            RestAPISetting::whereNull('added_by')->update(['added_by' => $admin->id]);
            RestAPISetting::whereNull('last_updated_by')->update(['last_updated_by' => $admin->id]);
        }

        $customPermissions = [
            'manage_test_push_notification',
            'manage_rest_api_settings',
        ];

        foreach ($customPermissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'display_name' => ucwords(str_replace('_', ' ', $permission)),
                'is_custom' => 1,
                'module_id' => $restAPIModule->id,
                'allowed_permissions' => Permission::ALL_NONE,
            ]);

        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        $restAPIModule = \App\Models\Module::where(['module_name' => 'restapi'])->first();
        Permission::where('module_id', $restAPIModule->id)->delete();
    }
};
