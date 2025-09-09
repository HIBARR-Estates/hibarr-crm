<?php

use App\Models\Currency;
use App\Scopes\CompanyScope;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
        Schema::table('payroll_settings', function (Blueprint $table) {
            $table->unsignedInteger('currency_id')->nullable()->default(null)->after('semi_monthly_end');
            $table->foreign('currency_id')->references('id')->on('currencies')->onDelete('cascade')->onDelete('cascade');
        });

        $currency = Currency::withoutGlobalScope(CompanyScope::class)->first();

        if (! is_null($currency)) {
            $payrollCurrency = PayrollSetting::withoutGlobalScope(CompanyScope::class)->first();
            $payrollCurrency->currency_id = $currency->id;
            $payrollCurrency->saveQuietly();
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('payroll_settings', function (Blueprint $table) {

        });
    }
};
