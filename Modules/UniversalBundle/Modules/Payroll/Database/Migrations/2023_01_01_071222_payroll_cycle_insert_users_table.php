<?php

use App\Models\Company;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Modules\Payroll\Entities\EmployeePayrollCycle;
use Modules\Payroll\Entities\PayrollCycle;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {

        $users = User::with('company')->withoutGlobalScopes([ActiveScope::class, Company::class])->whereNotNull('company_id')->get();

        foreach ($users as $user) {
            $payrollCycle = PayrollCycle::first();

            if ($payrollCycle && $user->company) {

                $exists = EmployeePayrollCycle::where('user_id', $user->id)
                    ->where('company_id', $user->company->id)->exists();

                if (! $exists) {
                    EmployeePayrollCycle::firstOrCreate([
                        'user_id' => $user->id,
                        'company_id' => $user->company->id,
                        'payroll_cycle_id' => $payrollCycle->id,
                    ]);
                }
            }

        }

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('salary_slips', function (Blueprint $table) {
            $table->dropForeign('salary_slips_currency_id_foreign');
            $table->dropColumn('currency_id');
        });
    }
};
