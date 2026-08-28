<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\EmailNotificationSetting;
use App\Models\PusherSetting;
use App\Models\PushNotificationSetting;
use App\Models\SlackSetting;
use App\Models\SmtpSetting;
use App\Services\NotificationSettingsService;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Request;

class NotificationSettingController extends AccountBaseController
{

    public function __construct(private readonly NotificationSettingsService $settingsService)
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.notificationSettings';
        $this->activeSettingMenu = 'notification_settings';
        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_notification_setting') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        $tab = request('tab');

        $this->emailSettings = EmailNotificationSetting::all();
        $this->slackSettings = SlackSetting::first();
        $this->pushSettings = PushNotificationSetting::first();
        $this->pusherSettings = PusherSetting::first();

        switch ($tab) {
        case 'slack-setting':
            $this->checkedAll = $this->emailSettings->count() == $this->emailSettings->filter(function ($value) {
                    return $value->send_slack == 'yes';
            })->count();

            $this->view = 'notification-settings.ajax.slack-setting';
            break;

        case 'push-notification-setting':
            $this->checkedAll = $this->emailSettings->count() == $this->emailSettings->filter(function ($value) {
                    return $value->send_push == 'yes';
            })->count();

            $this->view = 'notification-settings.ajax.push-notification-setting';
            break;

        case 'pusher-setting':
            $this->view = 'notification-settings.ajax.pusher-setting';
            break;

        case 'database-setting':
            $this->checkedAll = $this->emailSettings->count() == $this->emailSettings->filter(function ($value) {
                    return $value->send_database == 'yes';
            })->count();

            $this->view = 'notification-settings.ajax.database-setting';
            break;

        default:
            $this->checkedAll = $this->emailSettings->count() == $this->emailSettings->filter(function ($value) {
                    return $value->send_email == 'yes';
            })->count();

            $this->smtpSetting = SmtpSetting::first();

            try {
                $this->smtpSetting->mail_password;
            }catch (DecryptException $e){
                // when we get message like below set password as null or o
                // The MAC is invalid.
                // The payload is invalid.
                $this->smtpSetting->mail_password = null;
                $this->smtpSetting->save();
            }
            $this->view = 'notification-settings.ajax.email-setting';
            break;
        }

        $this->activeTab = $tab ?: 'email-setting';

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle, 'activeTab' => $this->activeTab]);
        }

        return view('notification-settings.index', $this->data);
    }

    /**
     * Save the in-app (database channel) notification toggles. Unlike the other
     * 3 tabs, there is no connection config to save alongside — this is purely
     * a type-toggle checklist, so the route's {notification_setting} id is unused.
     */
    public function update(Request $request)
    {
        $this->settingsService->updateChannelToggles('send_database', $request->send_database ?? []);

        session()->forget('email_notification_setting');

        return Reply::success(__('messages.updateSuccess'));
    }

}
