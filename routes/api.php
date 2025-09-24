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

ApiRoute::group(['namespace' => 'App\Http\Controllers'], function () {
    ApiRoute::get('purchased-module', ['as' => 'api.purchasedModule', 'uses' => 'HomeController@installedModule']);
});

// API Routes for external applications
ApiRoute::group(['namespace' => 'App\Http\Controllers\Api'], function () {
    ApiRoute::post('deals/change-stage', ['as' => 'api.deals.changeStage', 'uses' => 'DealApiController@changeStage']);
    // ->validate([
    //     'deal_id' => 'required|exists:deals,id',
    //     'new_stage_id' => 'required|exists:pipeline_stages,id',
    // ]);
});