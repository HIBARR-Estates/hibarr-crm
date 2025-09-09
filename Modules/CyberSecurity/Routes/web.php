<?php

use Illuminate\Support\Facades\Route;
use Modules\CyberSecurity\Http\Controllers\BlacklistEmailController;
use Modules\CyberSecurity\Http\Controllers\BlacklistIpController;
use Modules\CyberSecurity\Http\Controllers\CyberSecuritySettingController;
use Modules\CyberSecurity\Http\Controllers\LoginExpiryController;

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
Route::group(['middleware' => 'auth', 'prefix' => 'account/settings'], function () {

    Route::group(['prefix' => 'cybersecurity', 'as' => 'cybersecurity.'], function () {
        Route::resource('blacklist-ip', BlacklistIpController::class);
        Route::resource('blacklist-email', BlacklistEmailController::class);
        Route::resource('login-expiry', LoginExpiryController::class);
    });
    Route::resource('cybersecurity', CyberSecuritySettingController::class);

});
