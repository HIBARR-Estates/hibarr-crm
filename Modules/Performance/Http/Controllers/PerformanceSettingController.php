<?php

namespace Modules\Performance\Http\Controllers;

use App\Helper\Reply;
use Illuminate\Http\Request;
use Modules\Performance\Entities\GoalType;
use App\Http\Controllers\AccountBaseController;
use App\Models\Role;
use Modules\Performance\Entities\KeyResultsMetrics;
use Modules\Performance\Entities\PerformanceSetting;

class PerformanceSettingController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->activeSettingMenu = 'performance_settings';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array(PerformanceSetting::MODULE_NAME, $this->user->modules));
            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $managePermissionSetting = user()->permission('manage_performance_setting');
        abort_403(!(in_array($managePermissionSetting, ['all'])));

        $tab = request('tab');

        $this->pageTitle = 'performance::app.performance';
        $this->performanceSetting = PerformanceSetting::first();

        switch ($tab) {
        case 'key-results-metrics':
            $this->KeyResultsMetrics = KeyResultsMetrics::all();
            $this->view = 'performance::performance-settings.ajax.key-results-metrics';
            break;
        case 'notification-settings':
            $this->settings = PerformanceSetting::first();
            $this->view = 'performance::performance-settings.ajax.notification-settings';
            break;
        case 'meeting-settings':
            $this->setting = PerformanceSetting::first();
            $this->roles = Role::whereNotIn('name', ['admin', 'client'])->get();
            $this->setting->create_meeting_roles = json_decode($this->setting->create_meeting_roles) ?? [];
            $this->setting->view_meeting_roles = json_decode($this->setting->view_meeting_roles) ?? [];
            $this->view = 'performance::performance-settings.ajax.meeting-settings';
            break;
        default:
            $this->goalTypes = GoalType::all();
            $this->view = 'performance::performance-settings.ajax.goal-type-settings';
            break;
        }

        $this->activeTab = $tab ?: 'goal-type-settings';

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle, 'activeTab' => $this->activeTab]);
        }

        return view('performance::performance-settings.index', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $managePermissionSetting = user()->permission('manage_performance_setting');
        abort_403(!(in_array($managePermissionSetting, ['all'])));

        $setting = PerformanceSetting::findOrFail($id);

        if ($request->type == 'objective_slack') {
            $setting->objective_slack_notification = $request->status;
        }

        if ($request->type == 'objective_push') {
            $setting->objective_push_notification = $request->status;
        }

        if ($request->type == 'objective_email') {
            $setting->objective_email_notification = $request->status;
        }

        if ($request->type == 'meeting_slack') {
            $setting->meeting_slack_notification = $request->status;
        }

        if ($request->type == 'meeting_push') {
            $setting->meeting_push_notification = $request->status;
        }

        if ($request->type == 'meeting_email') {
            $setting->meeting_email_notification = $request->status;
        }

        $setting->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    public function updateMeeting(Request $request, $id)
    {
        $managePermissionSetting = user()->permission('manage_performance_setting');
        abort_403(!(in_array($managePermissionSetting, ['all'])));

        $setting = PerformanceSetting::findOrFail($id);
        $setting->create_meeting_roles = json_encode($request->create_meeting_roles ?? []);
        $setting->create_meeting_manager = $request->create_meeting_manager ? 1 : 0;
        $setting->create_meeting_participant = $request->create_meeting_participant ? 1 : 0;
        $setting->view_meeting_roles = json_encode($request->view_meeting_roles ?? []);
        $setting->view_meeting_manager = $request->view_meeting_manager ? 1 : 0;
        $setting->view_meeting_participant = $request->view_meeting_participant ? 1 : 0;
        $setting->save();

        return Reply::success(__('messages.updateSuccess'));
    }
}
