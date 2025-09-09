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
        $viewPermission = Permission::where('name', 'view_payroll')->first();
        $addPermission = Permission::where('name', 'add_payroll')->first();

        if ($viewPermission) {
            Permission::where('name', 'add_payroll')->update(['name' => 'add_payroll_bkp']);

            $viewPermission->name = 'add_payroll';
            $addPermission->display_name = 'Add Payroll';
            $viewPermission->allowed_permissions = Permission::ALL_NONE;
            $viewPermission->saveQuietly();

            $addPermission->name = 'view_payroll';
            $addPermission->display_name = 'View Payroll';
            $addPermission->saveQuietly();
        }

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        //
    }
};
