<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Modules\Payroll\Entities\PayrollSetting;
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
        Schema::table('salary_slips', function (Blueprint $table) {
            $table->unsignedInteger('currency_id')->nullable()->after('company_id');
            $table->foreign('currency_id')->references('id')->on('currencies')->onUpdate('cascade')->onDelete('SET NULL');
        });

        $companies = Company::all();

        foreach ($companies as $company) {
            $payrollSetting = PayrollSetting::where('company_id', $company->id)->first();

            $salarySlips = SalarySlip::where('company_id', $company->id)->get();

            foreach ($salarySlips as $salarySlip) {
                $slip = SalarySlip::where('id', $salarySlip->id)->first();
                $slip->currency_id = ! is_null($payrollSetting->currency_id) ? $payrollSetting->currency_id : $company->currency_id;
                $slip->save();
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
