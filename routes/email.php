<?php

use App\Email\Http\Controllers\ConnectionController;
use App\Email\Http\Controllers\CopyActionController;
use App\Email\Http\Controllers\FileController;
use App\Email\Http\Controllers\HandoffController;
use App\Email\Http\Controllers\ReadController;
use App\Email\Http\Controllers\RecordHistoryController;
use App\Email\Http\Controllers\ReportController;
use App\Email\Http\Controllers\ReviewController;
use App\Email\Http\Controllers\SendController;
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
        Route::get('review/candidates', [ReviewController::class, 'candidates'])->name('review.candidates');
        Route::get('review/{copy}', [ReviewController::class, 'show'])
            ->whereUuid('copy')->name('review.show');

        Route::get('report', [ReportController::class, 'index'])->name('report.index');

        Route::post('copies/{copy}/link', [CopyActionController::class, 'link'])
            ->whereUuid('copy')->name('copies.link');
        Route::post('copies/{copy}/unlink', [CopyActionController::class, 'unlink'])
            ->whereUuid('copy')->name('copies.unlink');
        Route::post('copies/{copy}/dismiss', [CopyActionController::class, 'dismiss'])
            ->whereUuid('copy')->name('copies.dismiss');
        Route::post('copies/{copy}/create-lead', [CopyActionController::class, 'createLead'])
            ->whereUuid('copy')->name('copies.create-lead');
        Route::post('copies/{copy}/handoff', [HandoffController::class, 'handoff'])
            ->whereUuid('copy')->name('copies.handoff');
        Route::post('copies/{copy}/escalate', [HandoffController::class, 'escalate'])
            ->whereUuid('copy')->name('copies.escalate');

        Route::get('handoffs/incoming', [HandoffController::class, 'incoming'])->name('handoffs.incoming');
        Route::get('handoffs/colleagues', [HandoffController::class, 'colleagues'])->name('handoffs.colleagues');
        Route::post('handoffs/{handoff}/accept', [HandoffController::class, 'accept'])
            ->whereUuid('handoff')->name('handoffs.accept');
        Route::post('handoffs/{handoff}/reject', [HandoffController::class, 'reject'])
            ->whereUuid('handoff')->name('handoffs.reject');

        Route::get('unread', [ReadController::class, 'count'])->name('unread');
        Route::post('messages/{message}/read', [ReadController::class, 'store'])
            ->whereUuid('message')->name('messages.read');

        Route::post('files', [FileController::class, 'store'])->name('files.store');
        Route::get('files/{file}/download', [FileController::class, 'download'])
            ->whereUuid('file')->name('files.download');

        Route::post('send', [SendController::class, 'store'])->name('send');

        Route::get('records/{type}/{id}/history', [RecordHistoryController::class, 'index'])
            ->whereIn('type', ['lead', 'deal'])->whereNumber('id')->name('records.history');
        Route::get('records/{type}/{id}/timeline', [RecordHistoryController::class, 'timeline'])
            ->whereIn('type', ['lead', 'deal'])->whereNumber('id')->name('records.timeline');
        Route::get('records/{type}/{id}/search', [RecordHistoryController::class, 'search'])
            ->whereIn('type', ['lead', 'deal'])->whereNumber('id')->name('records.search');
        Route::get('records/{type}/{id}/conversations/{conversation}', [RecordHistoryController::class, 'conversation'])
            ->whereIn('type', ['lead', 'deal'])->whereNumber('id')->whereUuid('conversation')
            ->name('records.conversations.show');
        Route::get('records/{type}/{id}/messages/{message}', [RecordHistoryController::class, 'message'])
            ->whereIn('type', ['lead', 'deal'])->whereNumber('id')->whereUuid('message')
            ->name('records.messages.show');
    });
