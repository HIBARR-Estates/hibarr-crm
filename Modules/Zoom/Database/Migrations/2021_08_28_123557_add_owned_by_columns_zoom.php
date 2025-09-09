<?php

use App\Models\Permission;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Zoom\Entities\ZoomMeeting;
use Modules\Zoom\Entities\ZoomSetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        $regularPermissions = [
            [
                'name' => 'manage_zoom_category',
                'display_name' => 'Manage Zoom category',
                'is_custom' => 1,
            ],
        ];

        $module = \App\Models\Module::where('module_name', ZoomSetting::MODULE_NAME)->first();

        $module->permissions()->createMany($regularPermissions);

        Schema::table('zoom_meetings', function (Blueprint $table) {
            $table->integer('added_by')->unsigned()->nullable();
            $table->foreign('added_by')->references('id')->on('users')->onDelete('SET NULL')->onUpdate('cascade');

            $table->integer('last_updated_by')->unsigned()->nullable();
            $table->foreign('last_updated_by')->references('id')->on('users')->onDelete('SET NULL')->onUpdate('cascade');
        });

        $admin = User::allAdmins()->first();

        if (! is_null($admin)) {
            ZoomMeeting::withoutGlobalScope(\App\Scopes\CompanyScope::class)->whereNull('added_by')->update(['added_by' => $admin->id]);
            ZoomMeeting::withoutGlobalScope(\App\Scopes\CompanyScope::class)->whereNull('last_updated_by')->update(['last_updated_by' => $admin->id]);
        }

        $all = ['add_zoom_meetings', 'view_zoom_meetings', 'edit_zoom_meetings', 'delete_zoom_meetings'];
        Permission::whereIn('name', $all)->update(['allowed_permissions' => Permission::ALL_4_ADDED_1_OWNED_2_BOTH_3_NONE_5]);
        Permission::where('name', 'manage_zoom_category')->update(['allowed_permissions' => Permission::ALL_NONE]);

        Artisan::call('module:enable Zoom');
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Permission::where('name', 'manage_zoom_category')->delete();

        Schema::table('zoom_meetings', function (Blueprint $table) {
            $table->dropForeign(['added_by']);
            $table->dropForeign(['last_updated_by']);
            $table->dropColumn(['added_by']);
            $table->dropColumn(['last_updated_by']);
        });
    }
};
