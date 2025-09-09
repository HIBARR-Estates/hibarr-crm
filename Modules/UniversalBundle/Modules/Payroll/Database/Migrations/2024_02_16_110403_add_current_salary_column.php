<?php

use App\Models\Company;
use App\Models\EmployeeDetails;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Payroll\Entities\EmployeeMonthlySalary;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('employee_monthly_salaries', 'company_id')) {
            Schema::table('employee_monthly_salaries', function (Blueprint $table) {
                $table->integer('company_id')->unsigned()->nullable()->after('id');
                $table->foreign('company_id')->references('id')
                    ->on('companies')->onDelete('cascade')->onUpdate('cascade');


            });

        }

        if (!Schema::hasColumn('employee_monthly_salaries', 'effective_annual_salary')) {
            Schema::table('employee_monthly_salaries', function (Blueprint $table) {
                $table->string('effective_annual_salary')->nullable();
                $table->string('effective_monthly_salary')->nullable();
            });

        }
        $companies = Company::select('id')->get();

        foreach ($companies as $company) {

            $employees = EmployeeDetails::where('company_id', $company->id)->select('id', 'user_id')->get();

            foreach ($employees as $employee) {
                $salary = EmployeeMonthlySalary::employeeNetSalary($employee->user_id);

                EmployeeMonthlySalary::where('user_id', $employee->user_id)->update([
                    'company_id' => $company->id
                ]);

                EmployeeMonthlySalary::where('user_id', $employee->user_id)->where('type', 'initial')->update([
                    'effective_monthly_salary' => $salary['netSalary'],
                    'effective_annual_salary' => ($salary['netSalary'] * 12)
                ]);
            }
        }


    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {

        });
    }

};
