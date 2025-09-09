<?php

use Illuminate\Support\Facades\Route;
use Modules\UniversalBundle\Http\Controllers\UniversalBundleController;

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
            Route::post('install-universal-bundle-module', [UniversalBundleController::class, 'installUniversalBundleModule'])->name('install-universal-bundle-module');
            Route::post('add-universal-module-purchase-code', [UniversalBundleController::class, 'addUniversalModulePurchaseCode'])->name('add-universal-module-purchase-code');
        }
    );

});
