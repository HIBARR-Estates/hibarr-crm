<?php

use Illuminate\Support\Facades\Route;
use Modules\Asset\Http\Controllers\AssetController;
use Modules\Asset\Http\Controllers\AssetTypeController;
use Modules\Asset\Http\Controllers\AssetHistoryController;
use Modules\Asset\Http\Controllers\AssetSettingController;

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

Route::group(['middleware' => 'auth', 'prefix' => 'account'], function () {
    Route::resource('assets', AssetController::class);

    Route::prefix('assets')->group(function () {
        //phpcs:ignore
        Route::get('/asset/{asset}/history/return/{history}', [AssetHistoryController::class, 'returnAsset'])->name('assets.return');
        Route::resource('/asset/{asset}/history', AssetHistoryController::class)->names([
            'create' => 'history.create',
            'store' => 'history.store',
            'edit' => 'history.edit',
            'update' => 'history.update',
            'destroy' => 'history.destroy',
        ]);

        Route::resource('asset-type', AssetTypeController::class);
    });
    
    Route::resource('/asset-setting', AssetSettingController::class);
});
