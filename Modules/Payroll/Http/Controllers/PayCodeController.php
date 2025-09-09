<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Payroll\Entities\PayCode;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Http\Requests\OvertimeSetting\Paycode\PayCodeStoreRequest;
use Modules\Payroll\Http\Requests\OvertimeSetting\Paycode\PayCodeUpdateRequest;

class PayCodeController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'payroll::app.menu.payCode';

        $this->middleware(function ($request, $next) {
            abort_403(! in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create(Request $request)
    {
        return view('payroll::overtime-setting.ajax.pay-code.create');
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  Request  $request
     * @return Response
     */
    public function store(PayCodeStoreRequest $request)
    {
        $payCode = new PayCode();

        $payCode->name = $request->name;
        $payCode->code = $request->code;
        $payCode->regular_time_rate = ($request->has('rate_type') && $request->rate_type == 'time') ? $request->regular_time_rate : 0;
        $payCode->holiday_time_rate = ($request->has('rate_type') && $request->rate_type == 'time') ? $request->holiday_time_rate : 0;
        $payCode->day_off_time_rate = ($request->has('rate_type') && $request->rate_type == 'time') ? $request->day_off_time_rate : 0;
        $payCode->regular_fixed_amount = (!$request->has('rate_type') && $request->rate_type != 'time') ? $request->regular_fixed_amount : 0;
        $payCode->holiday_fixed_amount = (!$request->has('rate_type') && $request->rate_type != 'time') ? $request->holiday_fixed_amount : 0;
        $payCode->day_off_fixed_amount = (!$request->has('rate_type') && $request->rate_type != 'time') ? $request->day_off_fixed_amount : 0;
        $payCode->description = $request->description;
        $payCode->fixed = (!$request->has('rate_type') && $request->rate_type != 'time') ? 1 : 0;
        $payCode->save();

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    public function show($id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    public function edit($id)
    {
        $this->payCode = PayCode::findOrFail($id);
        return view('payroll::overtime-setting.ajax.pay-code.edit', $this->data);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return Response
     */
    public function update(PayCodeUpdateRequest $request, $id)
    {

        $payCode = PayCode::findOrFail($id);

        $payCode->name = $request->name;
        $payCode->code = $request->code;
        $payCode->regular_time_rate = ($request->has('rate_type') && $request->rate_type == 'time') ? $request->regular_time_rate : 0;
        $payCode->holiday_time_rate = ($request->has('rate_type') && $request->rate_type == 'time') ? $request->holiday_time_rate : 0;
        $payCode->day_off_time_rate = ($request->has('rate_type') && $request->rate_type == 'time') ? $request->day_off_time_rate : 0;
        $payCode->regular_fixed_amount = (!$request->has('rate_type') && $request->rate_type != 'time') ? $request->regular_fixed_amount : 0;
        $payCode->holiday_fixed_amount = (!$request->has('rate_type') && $request->rate_type != 'time') ? $request->holiday_fixed_amount : 0;
        $payCode->day_off_fixed_amount = (!$request->has('rate_type') && $request->rate_type != 'time') ? $request->day_off_fixed_amount : 0;
        $payCode->description = $request->description;
        $payCode->fixed = (!$request->has('rate_type') && $request->rate_type != 'time') ? 1 : 0;
        $payCode->save();

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
        $payCode = PayCode::findOrFail($id);
        $payCode->delete();
        return Reply::success(__('messages.recordDeleted'));
    }

}
