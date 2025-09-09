<?php


use Illuminate\Database\Migrations\Migration;
use Modules\Payroll\Entities\EmployeeMonthlySalary;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {

        $salaries = EmployeeMonthlySalary::all();

        foreach ($salaries as $salary) {

            $user = $salary->user;

            if(isset($user->company_id))
            {
                $salary->company_id = $user->company_id;
                $salary->save();
            }
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
