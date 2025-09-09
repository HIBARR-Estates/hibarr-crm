<?php

use Illuminate\Support\Facades\Route;
use Modules\Performance\Http\Controllers\ActionController;
use Modules\Performance\Http\Controllers\AgendaController;
use Modules\Performance\Http\Controllers\CheckInController;
use Modules\Performance\Http\Controllers\DashboardController;
use Modules\Performance\Http\Controllers\GoalTypeController;
use Modules\Performance\Http\Controllers\ObjectiveController;
use Modules\Performance\Http\Controllers\KeyResultsController;
use Modules\Performance\Http\Controllers\KeyResultsMetricsController;
use Modules\Performance\Http\Controllers\OkrScoringController;
use Modules\Performance\Http\Controllers\PerformanceSettingController;
use Modules\Performance\Http\Controllers\MeetingController;

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
    // Objective key result and checkin routes
    Route::get('objectives/show-description/{id}', [ObjectiveController::class, 'showDescription'])->name('objectives.show-description');
    Route::resource('objectives', ObjectiveController::class)->names('objectives');

    Route::get('key-results/send-reminder/{id}', [KeyResultsController::class, 'sendReminder'])->name('key-results.send-reminder');
    Route::get('key-results/show-description/{id}', [KeyResultsController::class, 'showDescription'])->name('key-results.show-description');
    Route::resource('key-results', KeyResultsController::class)->names('key-results');

    Route::get('okr-scoring/export-report', [OkrScoringController::class, 'exportReport'])->name('okr-scoring.export-report');
    Route::resource('okr-scoring', OkrScoringController::class)->names('okr-scoring');

    Route::resource('check-ins', CheckInController::class)->names('check-ins');

    // Dashboard routes
    Route::post('performance-dashboard/objective-progress', [DashboardController::class, 'objectiveChartData'])->name('performance-dashboard.chart');
    Route::resource('performance-dashboard', DashboardController::class)->names('performance-dashboard');

    // Performance Settings
    Route::resource('goal-type-settings', GoalTypeController::class)->names('goal-type-settings');
    Route::resource('key-results-metric', KeyResultsMetricsController::class)->names('key-results-metrics');
    Route::put('performance-settings/meeting-setting/{id}', [PerformanceSettingController::class, 'updateMeeting'])->name('performance-settings.meeting-setting');
    Route::resource('performance-settings', PerformanceSettingController::class)->names('performance-settings');

    // Meeting routes
    Route::get('meetings/view-meeting-list', [MeetingController::class, 'viewMeetingList'])->name('meetings.view_meeting_list');
    Route::get('meetings/send-reminder/{id?}', [MeetingController::class, 'sendReminder'])->name('meetings.send_reminder');
    Route::post('meetings/mark-as-cancelled/{id}', [MeetingController::class, 'markAsCancelled'])->name('meetings.mark_as_cancelled');
    Route::post('meetings/mark-as-complete/{id}', [MeetingController::class, 'markAsComplete'])->name('meetings.mark_as_complete');
    Route::post('meetings/event-monthly-on', [MeetingController::class, 'monthlyOn'])->name('meetings.monthly_on');
    Route::get('meetings/calendar-view', [MeetingController::class, 'calendarView'])->name('meetings.calendar_view');
    Route::resource('meetings', MeetingController::class)->names('meetings');

    Route::post('agenda/mark-as-discussed', [AgendaController::class, 'markAsDiscussed'])->name('agenda.mark_as_discussed');
    Route::resource('agenda', AgendaController::class)->names('agenda');

    Route::post('action/mark-as-actioned', [ActionController::class, 'markAsActioned'])->name('action.mark_as_actioned');
    Route::resource('action', ActionController::class)->names('action');

});
