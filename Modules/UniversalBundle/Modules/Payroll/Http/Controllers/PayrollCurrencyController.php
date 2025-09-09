<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Http\Requests\StoreCurrency;

class PayrollCurrencyController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_403(! in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    public function index()
    {
        //
    }

    public function store(StoreCurrency $request)
    {

        $currency = PayrollSetting::first();

        if (! is_null($currency)) {
            $currency->update(['currency_id' => $request->currency]);

        } else {
            $newCurrency = new PayrollSetting;
            $newCurrency->company_id = company()->id;
            $newCurrency->currency_id = $request->currency;
            $newCurrency->save();
        }

        return Reply::success(__('messages.recordSaved'));

    }
}
