<?php

use App\Models\Permission;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Payroll\Entities\SalarySlip;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {

        if (! Schema::hasColumn('salary_slips', 'added_by')) {
            Schema::table('salary_slips', function (Blueprint $table) {
                $table->integer('added_by')->unsigned()->nullable();
                $table->foreign('added_by')->references('id')->on('users')->onDelete('SET NULL')->onUpdate('cascade');

                $table->integer('last_updated_by')->unsigned()->nullable();
                $table->foreign('last_updated_by')->references('id')->on('users')->onDelete('SET NULL')->onUpdate('cascade');
            });
        }

        if (! Schema::hasColumn('salary_slips', 'company_id')) {
            Schema::table('salary_slips', function (Blueprint $table) {
                $table->integer('company_id')->unsigned()->nullable()->after('id');
                $table->foreign('company_id')->references('id')
                    ->on('companies')->onDelete('cascade')->onUpdate('cascade');
            });
        }

        $admin = User::allAdmins()->first();

        if (! is_null($admin)) {
            SalarySlip::whereNull('added_by')->update(['added_by' => $admin->id]);
            SalarySlip::whereNull('last_updated_by')->update(['last_updated_by' => $admin->id]);
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        $payrollModule = \App\Models\Module::where(['module_name' => 'payroll'])->first();
        Permission::where('module_id', $payrollModule->id)->delete();
    }
};
