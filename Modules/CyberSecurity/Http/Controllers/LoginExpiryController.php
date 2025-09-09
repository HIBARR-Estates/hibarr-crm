<?php

namespace Modules\CyberSecurity\Http\Controllers;

use Carbon\Carbon;
use App\Models\User;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Modules\CyberSecurity\Entities\LoginExpiry;
use Illuminate\Contracts\Support\Renderable;
use App\Http\Controllers\AccountBaseController;
use Modules\CyberSecurity\Http\Requests\StoreLoginExpiryRequest;
use Modules\CyberSecurity\Http\Requests\UpdateLoginExpiryRequest;

class LoginExpiryController extends AccountBaseController
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
        $this->employees = User::onlyEmployee()->where('id', '!=', $this->user->id)->get();
        return view('cybersecurity::security-settings.create-login-expiry', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     * @param Request $request
     * @return Renderable
     */
    public function store(StoreLoginExpiryRequest $request)
    {
        $expiry_date = Carbon::createFromFormat($this->global->date_format, $request->expiry_date)->format('Y-m-d');
        $expiryUser = new LoginExpiry();
        $expiryUser->user_id = $request->user_id;
        $expiryUser->expiry_date = $expiry_date;
        $expiryUser->save();

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the form for editing the specified resource.
     * @param int $id
     * @return Renderable
     */
    public function edit($id)
    {
        $this->loginExpiry  = LoginExpiry::findOrfail($id);
        $this->employees = User::onlyEmployee()->where('id', '!=', $this->user->id)->get();
        return view('cybersecurity::security-settings.edit-login-expiry', $this->data);
    }

    /**
     * Update the specified resource in storage.
     * @param Request $request
     * @param int $id
     * @return Renderable
     */
    public function update(UpdateLoginExpiryRequest $request, $id)
    {
        $expiry_date = Carbon::createFromFormat($this->global->date_format, $request->expiry_date)->format('Y-m-d');
        $expiryUser  = LoginExpiry::findOrfail($id);
        $expiryUser->user_id = $request->user_id;
        $expiryUser->expiry_date = $expiry_date;
        $expiryUser->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Remove the specified resource from storage.
     * @param int $id
     * @return Renderable
     */
    public function destroy($id)
    {
        LoginExpiry::destroy($id);
        return Reply::success(__('messages.deleteSuccess'));
    }

}
