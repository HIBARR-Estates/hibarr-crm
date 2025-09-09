<?php

use Illuminate\Support\Facades\Route;

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

use Modules\Webhooks\Http\Controllers\WebhooksController;
use Modules\Webhooks\Http\Controllers\WebhooksLogController;

Route::group(['middleware' => 'auth', 'prefix' => 'account'], function () {

    Route::post('webhooks/apply-quick-action', [WebhooksController::class, 'applyQuickAction'])->name('webhooks.apply_quick_action');
    Route::resource('webhooks', WebhooksController::class);
    Route::resource('webhooks-log', WebhooksLogController::class);
    Route::get('webhooks-for-variable/{webhookFor}', [WebhooksController::class, 'webhooksForVariable'])->name('webhooks.webhooks_for_variable');
});
