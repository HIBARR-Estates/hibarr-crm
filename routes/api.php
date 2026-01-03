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
    ApiRoute::get('internal/deals/{dealId}/communication-activities', ['as' => 'api.deals.communication-activities.internal', 'uses' => 'CommunicationActivityController@getDealActivities']);
    ApiRoute::post('internal/communication-activities/send-email', ['as' => 'api.communication-activities.send-email.internal', 'uses' => 'CommunicationActivityController@sendEmailToCustomer']);
  

    // External Communications Module Routes
    ApiRoute::middleware(['api.token'])->group(function () {
        ApiRoute::post('communication-activities', ['as' => 'api.communication-activities.store', 'uses' => 'CommunicationActivityController@store']);
        ApiRoute::get('deals/{dealId}/communication-activities', ['as' => 'api.deals.communication-activities', 'uses' => 'CommunicationActivityController@getDealActivities']);
        ApiRoute::get('leads/{leadId}/communication-activities', ['as' => 'api.leads.communication-activities', 'uses' => 'CommunicationActivityController@getLeadActivities']);
        ApiRoute::get('communication-activities/channel/{channelType}', ['as' => 'api.communication-activities.by-channel', 'uses' => 'CommunicationActivityController@getActivitiesByChannel']);
        ApiRoute::post('communication-activities/send-email', ['as' => 'api.communication-activities.send-email', 'uses' => 'CommunicationActivityController@sendEmailToCustomer']);
        ApiRoute::post('meeting-summary', ['as' => 'api.meeting-summary', 'uses' => 'MeetingSummaryApiController@getMeetingSummary']);

        // Meeting Summary Routes
        ApiRoute::get('meeting-summary/{summaryId}', ['as' => 'api.meeting-summary.show', 'uses' => 'MeetingSummaryController@show']);
        ApiRoute::post('meeting-summary', ['as' => 'api.meeting-summary.store', 'uses' => 'MeetingSummaryApiController@getMeetingSummary']);

        //Import routes
        ApiRoute::post('bitrix/import', ['as' => 'api.bitrix.import', 'uses' => 'Api\BitrixImportController@store']);
        ApiRoute::post('bitrix/contact/import', ['as' => 'api.bitrix.contact.import', 'uses' => 'Api\BitrixImportController@contactStore']);
        ApiRoute::post('bitrix/comments/import', ['as' => 'api.bitrix.comments.import', 'uses' => 'Api\BitrixImportController@commentStore']);
        ApiRoute::post('bitrix/tasks/import', ['as' => 'api.bitrix.tasks.import', 'uses' => 'Api\BitrixImportController@taskImport']);

        
        // External Events Routes
        ApiRoute::post('external-events', ['as' => 'api.external-events.store', 'uses' => 'ExternalEventController@store']);
        ApiRoute::get('external-events', ['as' => 'api.external-events.index', 'uses' => 'ExternalEventController@index']);
        ApiRoute::get('external-events/{id}', ['as' => 'api.external-events.show', 'uses' => 'ExternalEventController@show']);

        // Deal API Routes
        ApiRoute::post('deal/create', ['as' => 'api.deals.create', 'uses' => 'Api\DealContactApiController@createDeal']);
        
        // Contact API Routes
        ApiRoute::post('contact/create', ['as' => 'api.contacts.createOrUpdate', 'uses' => 'Api\DealContactApiController@createOrUpdateContact']);
 
    });

});

// API Routes for external applications
ApiRoute::group(['namespace' => 'App\Http\Controllers\Api'], function () {
    ApiRoute::post('deals/change-stage', ['as' => 'api.deals.changeStage', 'uses' => 'DealContactApiController@changeStage']);
    // ->validate([
    //     'deal_id' => 'required|exists:deals,id',
    //     'new_stage_id' => 'required|exists:pipeline_stages,id',
    // ]);

});