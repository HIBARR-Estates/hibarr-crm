<?php

use Illuminate\Support\Facades\Route;
use Modules\Sms\Http\Controllers\SmsSettingsController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

// Admin routes
Route::group(['middleware' => 'auth', 'prefix' => 'account'], function () {

    Route::group(
        ['prefix' => 'settings'],
        function () {
            Route::get('sms-setting/test-message', [SmsSettingsController::class, 'testMessage'])->name('sms-setting.test_message');
            Route::POST('sms-setting/send-test-message', [SmsSettingsController::class, 'sendTestMessage'])->name('sms-setting.send_test_message');
            Route::resource('sms-setting', SmsSettingsController::class);
        }
    );

});
