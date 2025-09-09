<?php

namespace Modules\CyberSecurity\Http\Controllers;

use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Contracts\Support\Renderable;
use Modules\CyberSecurity\Entities\BlacklistEmail;
use App\Http\Controllers\AccountBaseController;
use Modules\CyberSecurity\Http\Requests\StoreEmailRequest;

class BlacklistEmailController extends AccountBaseController
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
        return view('cybersecurity::security-settings.create-blacklist-email');
    }

    /**
     * Store a newly created resource in storage.
     * @param Request $request
     * @return Renderable
     */
    public function store(StoreEmailRequest $request)
    {
        BlacklistEmail::create(['email' => $request->email]);

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the form for editing the specified resource.
     * @param int $id
     * @return Renderable
     */
    public function edit($id)
    {
        $this->blacklistEmail = BlacklistEmail::findOrfail($id);

        return view('security::security-settings.edit-blacklist-email', $this->data);
    }

    /**
     * Update the specified resource in storage.
     * @param Request $request
     * @param int $id
     * @return Renderable
     */
    public function update(StoreEmailRequest $request, $id)
    {
        $blacklistEmail = BlacklistEmail::findOrfail($id);
        $blacklistEmail->email = $request->email;
        $blacklistEmail->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Remove the specified resource from storage.
     * @param int $id
     * @return Renderable
     */
    public function destroy($id)
    {
        BlacklistEmail::destroy($id);
        return Reply::success(__('messages.deleteSuccess'));
    }

}
