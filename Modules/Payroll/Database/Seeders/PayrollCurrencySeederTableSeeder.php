<?php

namespace Modules\Payroll\Database\Seeders;

use App\Models\Currency;
use Illuminate\Database\Seeder;
use Modules\Payroll\Entities\PayrollSetting;

class PayrollCurrencySeederTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $currency = Currency::first();

        if (is_null($currency)) {
            $payrollCurrency = PayrollSetting::first();
            $payrollCurrency->currency_id = '1';
            $payrollCurrency->saveQuietly();
        } else {
            $payrollCurrency = PayrollSetting::first();
            $payrollCurrency->currency_id = $currency->id ?? null;
            $payrollCurrency->saveQuietly();
        }

    }
}
