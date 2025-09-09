<?php

namespace Modules\Payroll\Entities\API;

use App\Models\Company;
use App\Models\Currency;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Payroll\Entities\PayrollCycle;
use Modules\Payroll\Entities\SalaryGroup;
use Modules\Payroll\Entities\SalaryPaymentMethod;
use Modules\Payroll\Entities\SalarySlip as EntitiesSalarySlip;
use Modules\Payroll\Observers\SalarySlipObserver;
use Illuminate\Database\Eloquent\Casts\Attribute;

class SalarySlip extends EntitiesSalarySlip
{
    // region Properties

    protected $table = 'salary_slips';

    protected $default = [
        'id',
        'user_id',
        'currency_id',
        'company_id',
        'month',
        'year',
        'basic_salary',
        'paid_on',
        'salary_json',
        'extra_json',
        'expense_claims',
        'salary_payment_method_id',
        'monthly_salary',
        'gross_salary',
        'total_deductions',
        'salary_from',
        'salary_to',
        'salary_group_id',
        'fixed_allowance',
        'ytd_json',
        'ytd_extra_json',
        'ytd_expenses',
        'ytd_fixed_allowance',
        'additional_earning_json',
        'ytd_additional_json',
        'net_salary',
        'status',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'status',
        'user_id',
        'month',
        'year',
        'payroll_cycle_id',
        'salary_from',
        'salary_to',
    ];

    protected $hidden = [
        'updated_at',
    ];

    protected $dates = ['paid_on', 'salary_from', 'salary_to'];

    protected $appends = ['duration', 'default_currency_price'];

    public static function boot()
    {
        parent::boot();
        static::observe(SalarySlipObserver::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withoutGlobalScope(ActiveScope::class);
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

    public function visibleTo(User $user)
    {
        if ($user->hasRole('admin') || ($user->hasRole('employee') && $user->cans('view_payroll'))) {
            return true;
        }

        return $this->user_id == $user->id;
    }

    public function scopeVisibility($query)
    {
        if (api_user()) {
            $user = api_user();

            if ($user->hasRole('admin')) {
                return $query;
            }
            // If employee or client show projects assigned
            $query->where('salary_slips.user_id', $user->id);
            return $query;

        }

        return $query;
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
