<?php

namespace Modules\RestAPI\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Edujugon\PushNotification\PushNotification;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Contracts\View\Factory;
use Illuminate\View\View;
use Modules\RestAPI\Entities\RestAPISetting;
use Modules\RestAPI\Entities\User;
use Modules\RestAPI\Http\Requests\RestAPISetting\SendPushRequest;
use Modules\RestAPI\Http\Requests\RestAPISetting\UpdateRequest;

class RestAPISettingController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'restapi::app.menu.restAPISettings';
        $this->activeSettingMenu = 'rest_api_setting';
        $this->middleware(function ($request, $next) {
            if (!in_array('restapi', $this->user->modules)) {
                abort(403, __('messages.permissionDenied'));
            }

            return $next($request);
        });
    }

    /**
     * @return Application|Factory|View
     */
    public function index()
    {
        $this->restAPISetting = RestAPISetting::first();

        return view('restapi::setting.index', $this->data);
    }

    /**
     * @return array|string[]
     */
    public function update(UpdateRequest $request, $id)
    {
        $restApiSetting = RestAPISetting::find($id);
        $restApiSetting->fcm_key = $request->fcm_key;
        $restApiSetting->save();

        return Reply::redirect(route('rest-api-setting.index'), __('messages.updateSuccess'));
    }

    public function testPush($platform)
    {
        $this->platform = $platform;
        $this->devices = User::find(user()->id)->devices->where('type', $platform);

        return view('restapi::setting.test-push', $this->data);
    }

    /**
     * @return array
     */
    public function sendPush(SendPushRequest $request)
    {
        $platform = $request->platform === 'ios' ? 'apn' : 'fcm';

        $this->push = new PushNotification('fcm');

        $notification = [
            'title' => 'Test notification',
            'body' => 'This is test push notification',
            'sound' => 'default',
            'badge' => 1,
            'type' => 'test',
        ];

        $message = [
            'apn' => [
                'notification' => $notification,
            ],
            'fcm' => [
                'data' => $notification,
            ],
        ];

        $this->push->setMessage($message[$platform]);

        $setting = RestAPISetting::first();
        $fcm_key = !is_null($setting->fcm_key) ? $setting->fcm_key : config('pushnotification.fcm.apiKey');
        $this->push->setApiKey($fcm_key);

        $this->push->setDevicesToken($request->device_id)->send();

        return Reply::success(__('restapi::app.notificationSentSuccessfully'));
    }

}
