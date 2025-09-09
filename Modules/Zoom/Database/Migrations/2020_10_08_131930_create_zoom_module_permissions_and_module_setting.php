<?php

use App\Models\Module;
use Illuminate\Database\Migrations\Migration;
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
        // create module and permissions
        $permissions = [
            [
                'name' => 'add_zoom_meetings',
                'display_name' => 'Add Meetings',
            ],
            [
                'name' => 'view_zoom_meetings',
                'display_name' => 'View Meetings',
            ],
            [
                'name' => 'edit_zoom_meetings',
                'display_name' => 'Edit Meetings',
            ],
            [
                'name' => 'delete_zoom_meetings',
                'display_name' => 'Delete Meetings',
            ],
        ];

        $module = new Module;
        $module->module_name = ZoomSetting::MODULE_NAME;
        $module->description = 'User can view the meetings assigned to him as default even without any permission.';
        $module->saveQuietly();

        $module->permissions()->createMany($permissions);

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Module::where('module_name', 'zoom')->delete();
    }
};
