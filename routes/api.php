<?php


/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

use App\Http\Controllers\CommunicationActivityController;
use App\Http\Controllers\Api\BitrixImportController;
use Illuminate\Support\Facades\Route;

ApiRoute::group(['namespace' => 'App\Http\Controllers'], function () {
    ApiRoute::get('purchased-module', ['as' => 'api.purchasedModule', 'uses' => 'HomeController@installedModule']);

    ApiRoute::post('internal/communication-activities', ['as' => 'api.communication-activities.store.internal', 'uses' => 'CommunicationActivityController@store']);
    ApiRoute::get('internal/deals/{dealId}/communication-activities', ['as' => 'api.deals.communication-activities', 'uses' => 'CommunicationActivityController@getDealActivities']);
  

    // External Communications Module Routes
    ApiRoute::middleware(['api.token'])->group(function () {
        ApiRoute::post('communication-activities', ['as' => 'api.communication-activities.store', 'uses' => 'CommunicationActivityController@store']);
        ApiRoute::get('deals/{dealId}/communication-activities', ['as' => 'api.deals.communication-activities', 'uses' => 'CommunicationActivityController@getDealActivities']);
        ApiRoute::get('leads/{leadId}/communication-activities', ['as' => 'api.leads.communication-activities', 'uses' => 'CommunicationActivityController@getLeadActivities']);
        ApiRoute::get('communication-activities/channel/{channelType}', ['as' => 'api.communication-activities.by-channel', 'uses' => 'CommunicationActivityController@getActivitiesByChannel']);
        ApiRoute::post('meeting-summary', ['as' => 'api.meeting-summary', 'uses' => 'MeetingSummaryApiController@getMeetingSummary']);

        // Meeting Summary Routes
        ApiRoute::get('meeting-summary/{summaryId}', ['as' => 'api.meeting-summary.show', 'uses' => 'MeetingSummaryController@show']);
        ApiRoute::post('meeting-summary', ['as' => 'api.meeting-summary.store', 'uses' => 'MeetingSummaryApiController@getMeetingSummary']);

        //Import routes
        ApiRoute::post('bitrix/import', ['as' => 'api.bitrix.import', 'uses' => 'Api\BitrixImportController@store']);

        
        // External Events Routes
        ApiRoute::post('external-events', ['as' => 'api.external-events.store', 'uses' => 'ExternalEventController@store']);
        ApiRoute::get('external-events', ['as' => 'api.external-events.index', 'uses' => 'ExternalEventController@index']);
        ApiRoute::get('external-events/{id}', ['as' => 'api.external-events.show', 'uses' => 'ExternalEventController@show']);
 
    });

});

// API Routes for external applications
ApiRoute::group(['namespace' => 'App\Http\Controllers\Api'], function () {
    ApiRoute::post('deals/change-stage', ['as' => 'api.deals.changeStage', 'uses' => 'DealApiController@changeStage']);
    // ->validate([
    //     'deal_id' => 'required|exists:deals,id',
    //     'new_stage_id' => 'required|exists:pipeline_stages,id',
    // ]);

});