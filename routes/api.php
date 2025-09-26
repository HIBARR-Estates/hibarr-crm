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
use Illuminate\Support\Facades\Route;

ApiRoute::group(['namespace' => 'App\Http\Controllers'], function () {
    ApiRoute::get('purchased-module', ['as' => 'api.purchasedModule', 'uses' => 'HomeController@installedModule']);

    ApiRoute::post('internal/communication-activities', ['as' => 'api.communication-activities.store', 'uses' => 'CommunicationActivityController@store']);
    ApiRoute::get('internal/deals/{dealId}/communication-activities', ['as' => 'api.deals.communication-activities', 'uses' => 'CommunicationActivityController@getDealActivities']);
    // External Communications Module Routes
    ApiRoute::middleware(['api.token'])->group(function () {
        ApiRoute::post('communication-activities', ['as' => 'api.communication-activities.store', 'uses' => 'CommunicationActivityController@store']);
        ApiRoute::get('deals/{dealId}/communication-activities', ['as' => 'api.deals.communication-activities', 'uses' => 'CommunicationActivityController@getDealActivities']);
        ApiRoute::get('leads/{leadId}/communication-activities', ['as' => 'api.leads.communication-activities', 'uses' => 'CommunicationActivityController@getLeadActivities']);
        ApiRoute::get('communication-activities/channel/{channelType}', ['as' => 'api.communication-activities.by-channel', 'uses' => 'CommunicationActivityController@getActivitiesByChannel']);

    });
});