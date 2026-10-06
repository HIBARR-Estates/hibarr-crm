<?php

use App\Email\Http\Controllers\ConnectionController;
use App\Email\Http\Controllers\CopyActionController;
use App\Email\Http\Controllers\RecordHistoryController;
use App\Email\Http\Controllers\ReviewController;
use App\Email\Http\Middleware\EnsureEmailEnabled;
use App\Email\Http\Middleware\EnsureEmailPilot;
use Illuminate\Support\Facades\Route;

/*
| CRM Email module (App\Email) — JSON endpoints. Loaded by EmailServiceProvider.
|
| Every route sits behind, in this order: the crm.email flag (off → 404),
| auth (signed out → 401), then the pilot allowlist (not listed → 403).
| The flag check comes before the web group because Laravel hoists auth
| into that group; listed after it, a signed-out caller would get 401
| instead of 404 while the flag is off.
*/

Route::middleware([EnsureEmailEnabled::class, 'web', 'auth', EnsureEmailPilot::class])
    ->prefix('email')
    ->name('email.')
    ->group(function () {
        Route::get('connections', [ConnectionController::class, 'index'])->name('connections.index');
        Route::post('connections', [ConnectionController::class, 'store'])->name('connections.store');

        Route::post('connections/{connection}/stop', [ConnectionController::class, 'stop'])
            ->whereUuid('connection')->name('connections.stop');
        Route::post('connections/{connection}/resume', [ConnectionController::class, 'resume'])
            ->whereUuid('connection')->name('connections.resume');
        Route::put('connections/{connection}/reconnect', [ConnectionController::class, 'reconnect'])
            ->whereUuid('connection')->name('connections.reconnect');
        Route::delete('connections/{connection}', [ConnectionController::class, 'destroy'])
            ->whereUuid('connection')->name('connections.destroy');

        Route::get('review', [ReviewController::class, 'index'])->name('review.index');
        Route::get('review/{copy}', [ReviewController::class, 'show'])
            ->whereUuid('copy')->name('review.show');

        Route::post('copies/{copy}/link', [CopyActionController::class, 'link'])
            ->whereUuid('copy')->name('copies.link');
        Route::post('copies/{copy}/unlink', [CopyActionController::class, 'unlink'])
            ->whereUuid('copy')->name('copies.unlink');
        Route::post('copies/{copy}/dismiss', [CopyActionController::class, 'dismiss'])
            ->whereUuid('copy')->name('copies.dismiss');
        Route::post('copies/{copy}/create-lead', [CopyActionController::class, 'createLead'])
            ->whereUuid('copy')->name('copies.create-lead');

        Route::get('records/{type}/{id}/history', [RecordHistoryController::class, 'index'])
            ->whereIn('type', ['lead', 'deal'])->whereNumber('id')->name('records.history');
    });
