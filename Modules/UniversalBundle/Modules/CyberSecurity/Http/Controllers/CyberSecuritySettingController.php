<?php

namespace Modules\CyberSecurity\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Illuminate\Contracts\Support\Renderable;
use Modules\CyberSecurity\Entities\BlacklistEmail;
use Modules\CyberSecurity\Entities\BlacklistIp;
use Modules\CyberSecurity\Entities\CyberSecurity;
use Modules\CyberSecurity\Entities\LoginExpiry;
use Modules\CyberSecurity\Http\Requests\StoreSecurityRequest;

class CyberSecuritySettingController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'cybersecurity::app.menu.cybersecurity';
        $this->activeSettingMenu = 'cybersecurity';
        $this->middleware(function ($request, $next) {
            abort_403(!in_array('admin', user_roles()));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     * @return Renderable
     */
    public function index()
    {
        $tab = request('tab');

        switch ($tab) {
        case 'blacklistIp':
            $this->blacklistIps = BlacklistIp::all();
            $this->view = 'cybersecurity::security-settings.ajax.blacklist-ip';
            break;
        case 'blacklistEmail':
            $this->blacklistEmails = BlacklistEmail::all();
            $this->view = 'cybersecurity::security-settings.ajax.blacklist-email';
            break;
        case 'login-expiry':
            $this->expiryUsers = LoginExpiry::all();
            $this->view = 'cybersecurity::security-settings.ajax.login-expiry';
            break;
        case 'single-session':
            $this->security = CyberSecurity::first();
            $this->view = 'cybersecurity::security-settings.ajax.single-session';
            break;
        default:
            $this->security = CyberSecurity::first();
            $this->view = 'cybersecurity::security-settings.ajax.security';
            break;
        }

        $this->activeTab = $tab ?: 'security';

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle, 'activeTab' => $this->activeTab]);
        }

        return view('cybersecurity::security-settings.index', $this->data);
    }

    /**
     * Update the specified resource in storage.
     * @param StoreSecurityRequest $request
     * @param int $id
     * @return Renderable
     */
    public function update(StoreSecurityRequest $request, $id)
    {

        switch ($request->page) {
        case 'single-session':
            $this->updateSingleSession($request);
            break;
        default:
            $this->updateSecurity($request);
            break;
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * @param mixed $request
     * @return void
     */
    public function updateSecurity(StoreSecurityRequest $request)
    {
        $security = CyberSecurity::first();
        $security->max_retries = $request->max_retries;
        $security->lockout_time = $request->lockout_time;
        $security->max_lockouts = $request->max_lockouts;
        $security->extended_lockout_time = $request->extended_lockout_time;
        $security->reset_retries = $request->reset_retries;
        $security->alert_after_lockouts = $request->alert_after_lockouts;
        $security->email = $request->email;
        // $security->user_timeout = $request->user_timeout;

        if (isWorksuite()) {
            $security->ip_check = $request->ip_check;
            $security->ip = $request->ip;
        }

        $security->save();
    }

    /**
     * @param StoreSecurityRequest $request
     * @return void
     */
    public function updateSingleSession(StoreSecurityRequest $request)
    {
        $security = CyberSecurity::first();
        $security->unique_session = $request->unique_session;
        $security->update();
    }

}
