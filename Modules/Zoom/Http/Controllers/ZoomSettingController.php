<?php

namespace Modules\Zoom\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\SlackSetting;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Modules\Zoom\Entities\ZoomNotificationSetting;
use Modules\Zoom\Entities\ZoomSetting;
use Modules\Zoom\Http\Requests\ZoomMeeting\UpdateSetting;

class ZoomSettingController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = __('zoom::app.menu.zoomSetting');
        $this->activeSettingMenu = 'zoom_settings';

        $this->middleware(
            function ($request, $next) {
                abort_403(! in_array(ZoomSetting::MODULE_NAME, $this->user->modules));

                return $next($request);
            }
        );
    }

    /**
     * Display a listing of the resource.
     *
     * @return Response
     */
    public function index()
    {
        abort_403(! in_array('admin', user_roles()));
        $hash = $this->company->hash;
        $tab = request('tab');

        $this->zoom = ZoomSetting::first();
        $this->emailSettings = ZoomNotificationSetting::all();
        $this->slackSettings = SlackSetting::first();

        switch ($tab) {
        case 'email-setting':
            $this->view = 'zoom::notification-settings.ajax.email-setting';
            break;
        case 'slack-setting':
            $this->view = 'zoom::notification-settings.ajax.slack-setting';
            break;
        default:
            $this->zoom = ZoomSetting::first();
            $this->webhookRoute = route('zoom-webhook', [$hash]);
            $this->view = 'zoom::notification-settings.ajax.zoom-setting';
            break;
        }

        $this->activeTab = $tab ?: 'zoom-setting';

        if (request()->ajax()) {

            $html = view($this->view, $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle, 'activeTab' => $this->activeTab]);
        }

        return view('zoom::index', $this->data);

    }

    public function updateEmailSetting(Request $request)
    {
        ZoomNotificationSetting::where('send_email', 'yes')->update(['send_email' => 'no']);

        if ($request->send_email) {

            ZoomNotificationSetting::where('id', $request->send_email)->update(['send_email' => 'yes']);

        }

        return Reply::success(__('messages.updateSuccess'));

    }

    public function updateSlackSetting(Request $request)
    {
        ZoomNotificationSetting::where('send_slack', 'yes')->update(['send_slack' => 'no']);

        if ($request->send_slack) {

            ZoomNotificationSetting::where('id', $request->send_slack)->update(['send_slack' => 'yes']);

        }

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return Response
     */
    public function update(UpdateSetting $request, $id)
    {
        $setting = ZoomSetting::find($id);
        $setting->update($request->all());

        return Reply::success(__('messages.updateSuccess'));

    }
}
