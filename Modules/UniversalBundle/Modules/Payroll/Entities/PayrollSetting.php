<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Models\Currency;
use App\Models\ModuleSetting;
use App\Scopes\CompanyScope;
use App\Traits\HasCompany;

class PayrollSetting extends BaseModel
{
    use HasCompany;

    const MODULE_NAME = 'payroll';

    protected $guarded = ['id'];

    public function currency()
    {
        return $this->belongsTo(Currency::class, 'currency_id');
    }

    public static function addModuleSetting($company)
    {

        // create admin, employee and client module settings
        $roles = ['admin', 'employee'];

        ModuleSetting::createRoleSettingEntry(self::MODULE_NAME, $roles, $company);

        $setting = PayrollSetting::withoutGlobalScope(CompanyScope::class)->where('company_id', $company->id)->first();

        if (! $setting) {
            $newSetting = new PayrollSetting;
            $newSetting->company_id = $company->id;
            $newSetting->saveQuietly();
        }

        self::salaryMethods($company);

    }

    private static function salaryMethods($company)
    {
        $methods = [
            ['payment_method' => 'Bank Transfer', 'default' => 1, 'company_id' => $company->id],
            ['payment_method' => 'Cash', 'company_id' => $company->id],
            ['payment_method' => 'Cheque', 'company_id' => $company->id],
            ['payment_method' => 'PayPal', 'company_id' => $company->id],
        ];

        foreach ($methods as $value) {
            $data = SalaryPaymentMethod::withoutGlobalScope(CompanyScope::class)->firstOrNew($value);
            $data->saveQuietly();
        }
    }
}
