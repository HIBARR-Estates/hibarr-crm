<?php

use Froiden\RestAPI\Facades\ApiRoute;
use Modules\Payroll\Http\Controllers\API\PayrollApiController;

ApiRoute::group(['middleware' => ['auth:sanctum', 'api.auth']], function () {
    ApiRoute::resource('payroll', PayrollApiController::class);
    ApiRoute::get('payroll-cycle', [PayrollApiController::class, 'getCycle']);
    ApiRoute::get('payroll/cycle-data/{payrollCycleId}/{year}', [PayrollApiController::class, 'getCycleData']);
});