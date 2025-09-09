<?php

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

use Illuminate\Support\Facades\Route;
use Modules\Zoom\Http\Controllers\ZoomCategoryController;
use Modules\Zoom\Http\Controllers\ZoomMeetingController;
use Modules\Zoom\Http\Controllers\ZoomMeetingNoteController;
use Modules\Zoom\Http\Controllers\ZoomSettingController;
use Modules\Zoom\Http\Controllers\ZoomWebhookController;

Route::group(['middleware' => 'auth', 'prefix' => 'account'], function () {

    Route::get('zoom-calendar', [ZoomMeetingController::class, 'calendar'])->name('zoom-meetings.calendar');
    Route::get('zoom-meetings/start-meeting/{id}', [ZoomMeetingController::class, 'startMeeting'])->name('zoom-meetings.start_meeting');
    Route::post('zoom-meeting/update-occurrence/{id}', [ZoomMeetingController::class, 'updateOccurrence'])->name('zoom-meetings.update_occurrence');
    Route::post('zoom-meeting/cancel-meeting', [ZoomMeetingController::class, 'cancelMeeting'])->name('zoom-meetings.cancel_meeting');
    Route::post('zoom-meeting/end-meeting', [ZoomMeetingController::class, 'endMeeting'])->name('zoom-meetings.end_meeting');
    Route::post('zoom-meetings/apply-quick-action', [ZoomMeetingController::class, 'applyQuickAction'])->name('zoom-meetings.apply_quick_action');
    Route::resource('zoom-meetings', ZoomMeetingController::class);

    Route::resource('zoom-categories', ZoomCategoryController::class);
    Route::post('zoom-settings/zoom-smtp-settings/{id?}', [ZoomSettingController::class, 'updateEmailSetting'])->name('zoom-settings.zoom-smtp-settings');
    Route::post('zoom-settings/zoom-slack-settings/{id?}', [ZoomSettingController::class, 'updateSlackSetting'])->name('zoom-settings.zoom-slack-settings');

    Route::resource('zoom-settings', ZoomSettingController::class);
    Route::resource('meeting-note', ZoomMeetingNoteController::class);

});

Route::post('zoom-webhook/{hash}', [ZoomWebhookController::class, 'index'])->name('zoom-webhook');
Route::get('zoom-webhook/{hash}', [ZoomWebhookController::class, 'getWebhook'])->name('get-zoom-webhook');
