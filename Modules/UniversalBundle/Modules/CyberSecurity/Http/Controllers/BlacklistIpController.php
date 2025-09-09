<?php

namespace Modules\CyberSecurity\Http\Controllers;

use App\Helper\Reply;
use Illuminate\Http\Request;
use Modules\CyberSecurity\Entities\BlacklistIp;
use Illuminate\Contracts\Support\Renderable;
use App\Http\Controllers\AccountBaseController;
use Modules\CyberSecurity\Http\Requests\StoreIpRequest;

class BlacklistIpController extends AccountBaseController
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
     * @return View|Factory
     * @throws BindingResolutionException
     */
    public function create()
    {
        return view('cybersecurity::security-settings.create-blacklist-ip');
    }

    /**
     * Store a newly created resource in storage.
     * @param Request $request
     * @return Renderable
     */
    public function store(StoreIpRequest $request)
    {
        BlacklistIp::create(['ip_address' => $request->ip_address]);

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the form for editing the specified resource.
     * @param int $id
     * @return Renderable
     */
    public function edit($id)
    {
        $this->blacklistIp = BlacklistIp::findOrfail($id);

        return view('cybersecurity::security-settings.edit-blacklist-ip', $this->data);
    }

    /**
     * Update the specified resource in storage.
     * @param Request $request
     * @param int $id
     * @return Renderable
     */
    public function update(StoreIpRequest $request, $id)
    {
        $blacklistIp = BlacklistIp::findOrfail($id);
        $blacklistIp->ip_address = $request->ip_address;
        $blacklistIp->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Remove the specified resource from storage.
     * @param int $id
     * @return Renderable
     */
    public function destroy($id)
    {
        BlacklistIp::destroy($id);
        return Reply::success(__('messages.deleteSuccess'));
    }

}
