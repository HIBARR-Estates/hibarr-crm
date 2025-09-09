<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Entities\SalaryPaymentMethod;
use Modules\Payroll\Http\Requests\StorePaymentMethod;

class SalaryPaymentMethodController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_403(! in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     *
     * @return Response
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create()
    {
        $this->paymentMethodPermission = user()->permission('manage_salary_payment_method');
        abort_403($this->paymentMethodPermission !== 'all');

        return view('payroll::payroll-setting.create-payment-method-modal');
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  Request  $request
     * @return Response
     */
    public function store(StorePaymentMethod $request)
    {
        $this->paymentMethodPermission = user()->permission('manage_salary_payment_method');
        abort_403($this->paymentMethodPermission !== 'all');

        SalaryPaymentMethod::create($request->all());

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    public function edit($id)
    {
        $this->paymentMethodPermission = user()->permission('manage_salary_payment_method');

        abort_403($this->paymentMethodPermission !== 'all');

        $this->paymentMethod = SalaryPaymentMethod::findOrFail($id);

        return view('payroll::payroll-setting.edit-payment-method-modal', $this->data);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return Response
     */
    public function update(StorePaymentMethod $request, $id)
    {
        $this->paymentMethodPermission = user()->permission('manage_salary_payment_method');
        abort_403($this->paymentMethodPermission !== 'all');

        SalaryPaymentMethod::where('id', $id)->update([
            'payment_method' => $request->payment_method,
        ]);

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function destroy($id)
    {
        $this->paymentMethodPermission = user()->permission('manage_salary_payment_method');
        abort_403($this->paymentMethodPermission !== 'all');

        SalaryPaymentMethod::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }
}
