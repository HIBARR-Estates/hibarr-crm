<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Payroll\Entities\PayrollCycle;
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
        if (! Schema::hasTable('payroll_cycles')) {
            Schema::create('payroll_cycles', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('cycle')->nullable();
                $table->enum('status', ['active', 'inactive'])->default('active');
                $table->timestamps();
            });
            $payroll = new PayrollCycle;
            $payroll->cycle = 'monthly';
            $payroll->saveQuietly();

            $payroll = new PayrollCycle;
            $payroll->cycle = 'weekly';
            $payroll->saveQuietly();

            $payroll = new PayrollCycle;
            $payroll->cycle = 'biweekly';
            $payroll->saveQuietly();

            $payroll = new PayrollCycle;
            $payroll->cycle = 'semimonthly';
            $payroll->saveQuietly();
        }

        $payrollCycle = PayrollCycle::where('cycle', 'monthly')->first();

        if (! Schema::hasColumn('salary_slips', 'salary_from')) {
            Schema::table('salary_slips', function (Blueprint $table) {
                $table->dateTime('salary_from')->nullable();
                $table->dateTime('salary_to')->nullable();
                $table->unsignedBigInteger('payroll_cycle_id')->nullable();
                $table->foreign('payroll_cycle_id')->references('id')->on('payroll_cycles')->onDelete('cascade')->onUpdate('cascade');
            });

            Schema::table('payroll_settings', function (Blueprint $table) {
                $table->integer('semi_monthly_start')->nullable()->default(1);
                $table->integer('semi_monthly_end')->nullable()->default(30);
            });
        }

        $salaries = SalarySlip::withoutGlobalScopes()->get();

        foreach ($salaries as $salary) {
            $dates = $this->getMonthDates($salary->month, $salary->year);

            if ($dates) {
                $salary->salary_from = $dates['startDate'];
                $salary->salary_to = $dates['endDate'];
                $salary->payroll_cycle_id = $payrollCycle->id;
                $salary->saveQuietly();
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
        Schema::dropIfExists('payroll_cycle');
    }

    public function getMonthDates($month, $year)
    {
        $monthDate = Carbon::createFromFormat('Y-m-d', $year.'-'.$month.'-1');
        $startDate = $monthDate->firstOfMonth()->format('Y-m-d');
        $endDate = $monthDate->endOfMonth()->format('Y-m-d');
        $dates = ['startDate' => $startDate, 'endDate' => $endDate];

        return $dates;
    }
};
