<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Models\Company;
use App\Models\Currency;
use App\Models\User;
use App\Scopes\ActiveScope;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalarySlip extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];

    protected $dates = ['paid_on', 'salary_from', 'salary_to'];

    protected $appends = ['duration', 'default_currency_price'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withoutGlobalScope(ActiveScope::class);;
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    // phpcs:ignore
    public function salary_group(): BelongsTo
    {
        return $this->belongsTo(SalaryGroup::class, 'salary_group_id');
    }

    // phpcs:ignore
    public function salary_payment_method(): BelongsTo
    {
        return $this->belongsTo(SalaryPaymentMethod::class, 'salary_payment_method_id');
    }

    // phpcs:ignore
    public function payroll_cycle(): BelongsTo
    {
        return $this->belongsTo(PayrollCycle::class, 'payroll_cycle_id');
    }

    public function getDurationAttribute()
    {
        $setting = company();

        if (! is_null($this->salary_from) && ! is_null($this->salary_to)) {
            return $this->salary_from->format($setting->date_format).' '.__('app.to').' '.$this->salary_to->format($setting->date_format);
        }

        return '';
    }

    public function defaultCurrencyPrice() : Attribute
    {
        return Attribute::make(
            get: function () {
                $currency = (company() == null) ? $this->company->currency_id : company()->currency_id;

                if ($this->currency_id == $currency) {
                    return $this->amount;
                }

                if($this->exchange_rate){
                    return ($this->amount * ((float)$this->exchange_rate));
                }

                // Retrieve the currency associated with the payment
                $currency = Currency::find($this->currency_id);

                if($currency && $currency->exchange_rate){
                    return ($this->amount * ((float)$currency->exchange_rate));
                }

                // If exchange rate is not available or invalid, return the original amount
                return $this->amount;
            },
        );
    }

}
