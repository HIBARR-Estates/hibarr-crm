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

    // External Communications Module Routes
    ApiRoute::middleware(['api.token'])->group(function () {
        ApiRoute::post('communication-activities', ['as' => 'api.communication-activities.store', 'uses' => 'CommunicationActivityController@store']);
        ApiRoute::get('deals/{dealId}/communication-activities', ['as' => 'api.deals.communication-activities', 'uses' => 'CommunicationActivityController@getDealActivities']);
        ApiRoute::get('leads/{leadId}/communication-activities', ['as' => 'api.leads.communication-activities', 'uses' => 'CommunicationActivityController@getLeadActivities']);
        ApiRoute::get('communication-activities/channel/{channelType}', ['as' => 'api.communication-activities.by-channel', 'uses' => 'CommunicationActivityController@getActivitiesByChannel']);

        // Properties API
        ApiRoute::get('properties', ['as' => 'api.properties.index', 'uses' => 'PropertyController@apiIndex']);
        ApiRoute::post('properties', ['as' => 'api.properties.store', 'uses' => 'PropertyController@apiStore']);
        ApiRoute::get('properties/{id}', ['as' => 'api.properties.show', 'uses' => 'PropertyController@apiShow']);
        ApiRoute::put('properties/{id}', ['as' => 'api.properties.update', 'uses' => 'PropertyController@apiUpdate']);
        ApiRoute::delete('properties/{id}', ['as' => 'api.properties.destroy', 'uses' => 'PropertyController@apiDestroy']);
        
        // Property Configuration Endpoints
        ApiRoute::get('properties/config/configurations', ['as' => 'api.properties.configurations', 'uses' => 'PropertyController@getPropertyConfigurations']);
        ApiRoute::get('properties/config/allowed-types', ['as' => 'api.properties.allowed-types', 'uses' => 'PropertyController@getAllowedPropertyTypes']);
        ApiRoute::get('properties/config/allowed-fields', ['as' => 'api.properties.allowed-fields', 'uses' => 'PropertyController@getAllowedFields']);
    });
});