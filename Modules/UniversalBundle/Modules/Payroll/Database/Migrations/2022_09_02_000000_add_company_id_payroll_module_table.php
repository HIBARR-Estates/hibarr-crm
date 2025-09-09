<?php

use App\Models\Company;
use App\Models\Permission;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Payroll\Entities\PayrollSetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        \App\Models\Module::validateVersion(PayrollSetting::MODULE_NAME);
        $payrollModule = \App\Models\Module::firstOrCreate(['module_name' => 'payroll']);

        $tables = [
            'payroll_settings',
            'salary_groups',
            'salary_components',
            'salary_slips',
            'salary_group_components',
            'employee_payroll_cycles',
            'salary_payment_methods',
        ];

        $count = Company::count();

        try {

            foreach ($tables as $table) {

                if (! Schema::hasColumn($table, 'company_id')) {
                    Schema::table($table, function (Blueprint $table) {
                        $table->integer('company_id')->unsigned()->nullable()->after('id');
                        $table->foreign('company_id')->references('id')
                            ->on('companies')->onDelete('cascade')->onUpdate('cascade');
                    });
                }

                if (Schema::hasColumn($table, 'company_id') && $count === 1) {
                    DB::table($table)->update(['company_id' => 1]);
                }
            }

        } catch (Exception $e) {
            echo $e->getMessage();
        }

        $companies = Company::all();

        // We will insert these for the new company from event listener
        $payrollModule = \App\Models\Module::firstOrCreate(['module_name' => 'payroll']);
        $this->addAdminPermissions($payrollModule);

        foreach ($companies as $company) {
            PayrollSetting::addModuleSetting($company);
        }

    }

    private function addAdminPermissions($payrollModule)
    {

        $permissions = [
            [
                'name' => 'manage_salary_payment_method',
                'is_custom' => 1,
                'allowed_permissions' => Permission::ALL_NONE,
            ],
            [
                'name' => 'manage_salary_component',
                'is_custom' => 1,
                'allowed_permissions' => Permission::ALL_NONE,
            ],
            [
                'name' => 'manage_salary_group',
                'is_custom' => 1,
                'allowed_permissions' => Permission::ALL_NONE,
            ],
            [
                'name' => 'manage_salary_tds',
                'is_custom' => 1,
                'allowed_permissions' => Permission::ALL_NONE,
            ],
            [
                'name' => 'manage_employee_salary',
                'is_custom' => 1,
                'allowed_permissions' => Permission::ALL_NONE,
            ],
            [
                'name' => 'add_payroll',
                'is_custom' => 0,
                'allowed_permissions' => Permission::ALL_NONE,
            ],
            [
                'name' => 'view_payroll',
                'is_custom' => 0,
                'allowed_permissions' => Permission::ALL_4_ADDED_1_OWNED_2_BOTH_3_NONE_5,
            ],
            [
                'name' => 'edit_payroll',
                'is_custom' => 0,
                'allowed_permissions' => Permission::ALL_4_ADDED_1_OWNED_2_BOTH_3_NONE_5,
            ],
            [
                'name' => 'delete_payroll',
                'is_custom' => 0,
                'allowed_permissions' => Permission::ALL_4_ADDED_1_OWNED_2_BOTH_3_NONE_5,
            ],
        ];

        foreach ($permissions as $permission) {
            $perm = Permission::firstOrCreate([
                'name' => $permission['name'],
                'is_custom' => $permission['is_custom'],
                'module_id' => $payrollModule->id,
                'allowed_permissions' => $permission['allowed_permissions'],
            ]);

            // To prevent duplicate
            $perm->display_name = ucwords(str_replace('_', ' ', $permission['name']));
            $perm->saveQuietly();
        }

    }
};
