<?php

use Illuminate\Support\Facades\Route;
use Modules\RestAPI\Http\Controllers\RestAPIController;
use Modules\RestAPI\Http\Controllers\RestAPISettingController;

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

Route::prefix('restapi')->group(function () {
    Route::get('/', [RestAPIController::class, 'index']);
});

// Admin routes
Route::group(['middleware' => 'auth', 'prefix' => 'account'], function () {

    Route::group(['prefix' => 'settings'], function () {
        Route::get('rest-api-setting/test-push/{platform}', [RestAPISettingController::class, 'testPush'])->name('rest-api.test_push');
        Route::post('rest-api-setting/send-push', [RestAPISettingController::class, 'sendPush'])->name('rest-api.send_push');
        Route::resource('rest-api-setting', RestAPISettingController::class, ['only' => ['index', 'update']]);
    });
});
