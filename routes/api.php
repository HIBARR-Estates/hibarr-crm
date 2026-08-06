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
use Froiden\RestAPI\Facades\ApiRoute;
use Illuminate\Support\Facades\Route;

ApiRoute::group(['namespace' => 'App\Http\Controllers'], function () {
    ApiRoute::get('purchased-module', ['as' => 'api.purchasedModule', 'uses' => 'HomeController@installedModule']);

    ApiRoute::post('internal/communication-activities', ['as' => 'api.communication-activities.store.internal', 'uses' => 'CommunicationActivityController@store']);
    ApiRoute::get('internal/deals/{dealId}/communication-activities', ['as' => 'api.deals.communication-activities.internal', 'uses' => 'CommunicationActivityController@getDealActivities']);
    ApiRoute::post('internal/communication-activities/send-email', ['as' => 'api.communication-activities.send-email.internal', 'uses' => 'CommunicationActivityController@sendEmailToCustomer']);
  
    // CRM Event Record Keeping Engine Routes
    ApiRoute::post('crm-events', ['as' => 'api.crm-events.store', 'uses' => 'CrmEventController@store']);
    ApiRoute::post('crm-events/batch', ['as' => 'api.crm-events.batch', 'uses' => 'CrmEventController@storeBatch']);
    ApiRoute::get('crm-events', ['as' => 'api.crm-events.index', 'uses' => 'CrmEventController@index']);
    ApiRoute::get('crm-events/chain/{correlationId}', ['as' => 'api.crm-events.chain', 'uses' => 'CrmEventController@chain']);
    ApiRoute::get('crm-events/{uuid}', ['as' => 'api.crm-events.show', 'uses' => 'CrmEventController@show']);
    ApiRoute::patch('crm-events/{uuid}', ['as' => 'api.crm-events.update', 'uses' => 'CrmEventController@update']);
    ApiRoute::delete('crm-events/{uuid}', ['as' => 'api.crm-events.destroy', 'uses' => 'CrmEventController@destroy']);
    ApiRoute::get('crm-event-types', ['as' => 'api.crm-event-types.index', 'uses' => 'CrmEventTypeController@index']);

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
        
        // Lead API Routes (paginated: first_name, last_name, email)
        ApiRoute::get('leads', ['as' => 'api.leads.index', 'uses' => 'Api\LeadApiController@index']);

        // Task API Routes (paginated: tasks for the current day app-wide)
        ApiRoute::get('tasks/today', ['as' => 'api.tasks.today', 'uses' => 'Api\TaskApiController@tasksForToday']);

        // Property API Routes
        ApiRoute::get('properties', ['as' => 'api.properties.index', 'uses' => 'Api\PropertyApiController@index']);
        ApiRoute::get('properties/{identifier}/expose', ['as' => 'api.properties.expose', 'uses' => 'Api\ExposeDataApiController@propertyExpose']);
        ApiRoute::get('properties/{identifier}', ['as' => 'api.properties.show', 'uses' => 'Api\PropertyApiController@showByIdOrSlug']);
        ApiRoute::get('properties/filters/propertyTypes', ['as' => 'api.properties.filters.property_types', 'uses' => 'Api\PropertyApiController@getPropertyTypes']);
        ApiRoute::get('properties/filters/features', ['as' => 'api.properties.filters.features', 'uses' => 'Api\PropertyApiController@getFeatures']);
        ApiRoute::get('properties/filters/locations', ['as' => 'api.properties.filters.location', 'uses' => 'Api\PropertyApiController@getLocation']);

        // Developer Project API Routes
        ApiRoute::get('developer-projects', ['as' => 'api.developer-projects.index', 'uses' => 'Api\DeveloperProjectApiController@index']);
        ApiRoute::get('developer-projects/{identifier}/unit-types/{unitTypeId}/expose', ['as' => 'api.developer-projects.unit-types.expose', 'uses' => 'Api\ExposeDataApiController@unitTypeExpose']);
        ApiRoute::get('developer-projects/{identifier}/expose', ['as' => 'api.developer-projects.expose', 'uses' => 'Api\ExposeDataApiController@projectExpose']);
        ApiRoute::get('developer-projects/{identifier}', ['as' => 'api.developer-projects.show', 'uses' => 'Api\DeveloperProjectApiController@showByIdOrSlug']);

        // Expose snapshot reference API (lookup key only — auth remains api.token)
        ApiRoute::post('expose-snapshots', ['as' => 'api.expose-snapshots.create', 'uses' => 'Api\ExposeSnapshotApiController@store']);
        ApiRoute::get('expose-snapshots', ['as' => 'api.expose-snapshots.index', 'uses' => 'Api\ExposeSnapshotApiController@index']);
        ApiRoute::get('expose-snapshots/{token}', ['as' => 'api.expose-snapshots.show', 'uses' => 'Api\ExposeSnapshotApiController@show']);

        // Agent commission profile (internal)
        ApiRoute::get('internal/agents/{agentId}/commission-profile', ['as' => 'api.internal.agents.commission-profile.show', 'uses' => 'Api\AgentCommissionProfileInternalController@show']);
        ApiRoute::patch('internal/agents/{agentId}/commission-profile', ['as' => 'api.internal.agents.commission-profile.update', 'uses' => 'Api\AgentCommissionProfileInternalController@update']);

        // Commission levels & agent level (internal)
        ApiRoute::get('internal/commissions/levels', ['as' => 'api.internal.commissions.levels.index', 'uses' => 'Api\CommissionLevelsInternalController@index']);
        ApiRoute::patch('internal/agents/{agentId}/level', ['as' => 'api.internal.agents.level.update', 'uses' => 'Api\AgentLevelInternalController@update']);

    });

});

// v2 compatibility routes (mount at /api/v2/)
Route::middleware(['api.token'])->prefix('v2')->group(function () {
    Route::middleware(['crm.write.client'])->group(function () {
        Route::get('tasks', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@listTasks', 'as' => 'api.v2.tasks.index']);
        Route::post('tasks', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@createTask', 'as' => 'api.v2.tasks.create']);
        Route::get('tasks/{taskId}', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@getTask', 'as' => 'api.v2.tasks.show'])
            ->whereNumber('taskId');
        Route::match(['put', 'patch'], 'tasks/{taskId}', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@updateTask', 'as' => 'api.v2.tasks.update'])
            ->whereNumber('taskId');
        Route::delete('tasks/{taskId}', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@deleteTask', 'as' => 'api.v2.tasks.destroy'])
            ->whereNumber('taskId');

        Route::get('notes', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@listNotes', 'as' => 'api.v2.notes.index']);
        Route::post('notes', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@createNote', 'as' => 'api.v2.notes.create']);
        Route::get('notes/{noteId}', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@getNote', 'as' => 'api.v2.notes.show'])
            ->whereNumber('noteId');
        Route::match(['put', 'patch'], 'notes/{noteId}', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@updateNote', 'as' => 'api.v2.notes.update'])
            ->whereNumber('noteId');
        Route::delete('notes/{noteId}', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@deleteNote', 'as' => 'api.v2.notes.destroy'])
            ->whereNumber('noteId');

        Route::get('meetings', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@listMeetings', 'as' => 'api.v2.meetings.index']);
        Route::post('meetings', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@createMeeting', 'as' => 'api.v2.meetings.create']);
        Route::get('meetings/{meetingId}', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@getMeeting', 'as' => 'api.v2.meetings.show'])
            ->whereNumber('meetingId');
        Route::match(['put', 'patch'], 'meetings/{meetingId}', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@updateMeeting', 'as' => 'api.v2.meetings.update'])
            ->whereNumber('meetingId');
        Route::delete('meetings/{meetingId}', ['uses' => 'App\Http\Controllers\ApiV2\CrmWriteApiController@deleteMeeting', 'as' => 'api.v2.meetings.destroy'])
            ->whereNumber('meetingId');
    });

    Route::post('employees', ['uses' => 'App\Http\Controllers\ApiV2\EmployeeV2ApiController@createEmployee', 'as' => 'api.v2.employees.create.compat']);
    Route::post('employees/find-or-create', ['uses' => 'App\Http\Controllers\ApiV2\EmployeeV2ApiController@findOrCreateEmployee', 'as' => 'api.v2.employees.findOrCreate.compat']);
    Route::get('employees', ['uses' => 'App\Http\Controllers\ApiV2\EmployeeV2ApiController@listEmployees', 'as' => 'api.v2.employees.list.compat']);
    Route::get('employees/departments', ['uses' => 'App\Http\Controllers\ApiV2\EmployeeV2ApiController@listDepartments', 'as' => 'api.v2.employees.departments.compat']);
    Route::get('employees/designations', ['uses' => 'App\Http\Controllers\ApiV2\EmployeeV2ApiController@listDesignations', 'as' => 'api.v2.employees.designations.compat']);
    Route::get('employees/{userId}', ['uses' => 'App\Http\Controllers\ApiV2\EmployeeV2ApiController@getEmployee', 'as' => 'api.v2.employees.get.compat'])
        ->whereNumber('userId');
    Route::match(['put', 'patch'], 'employees/{userId}', ['uses' => 'App\Http\Controllers\ApiV2\EmployeeV2ApiController@updateEmployee', 'as' => 'api.v2.employees.update.compat'])
        ->whereNumber('userId');
});

// API Routes for external applications
ApiRoute::group(['namespace' => 'App\Http\Controllers\Api'], function () {
    ApiRoute::post('deals/change-stage', ['as' => 'api.deals.changeStage', 'uses' => 'DealContactApiController@changeStage']);
    // ->validate([
    //     'deal_id' => 'required|exists:deals,id',
    //     'new_stage_id' => 'required|exists:pipeline_stages,id',
    // ]);

});