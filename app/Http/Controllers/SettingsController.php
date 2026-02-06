<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\Settings\UpdateOrganisationSettings;
use App\Traits\CurrencyExchange;
use App\Models\User;
use App\Models\DealAutomation;
use Illuminate\Http\Request;

class SettingsController extends AccountBaseController
{

    use CurrencyExchange;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.accountSettings';
        $this->activeSettingMenu = 'company_settings';
        $this->middleware(function ($request, $next) {
            return user()->permission('manage_company_setting') !== 'all' ? redirect()->route('profile-settings.index') : $next($request);
        });
    }

    /**
     * XXXXXXXXXXX
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        $this->employees = User::allEmployees(null, false);
        return view('company-settings.index', $this->data);
    }

    public function deal_automations()
    {
        $this->employees = User::allEmployees(null, false);
        $this->automations = DealAutomation::with(['pipeline', 'actions.targetStage', 'actions.targetPipeline'])
            ->orderBy('priority', 'desc')
            ->get();
            
        return view('company-settings.deal_automations', $this->data);
    }

    // phpcs:ignore
    public function update(UpdateOrganisationSettings $request, $id)
    {
        $setting = \company();
        $setting->company_name = $request->company_name;
        $setting->company_email = $request->company_email;
        $setting->company_phone = $request->company_phone;
        $setting->website = $request->website;
        $setting->default_lead_creator_id = $request->default_lead_creator_id;
        $setting->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    // Remove in v 5.2.5
    public function hideWebhookAlert()
    {
        $this->company->show_new_webhook_alert = false;
        $this->company->saveQuietly();
        session()->forget('company');

        return Reply::success('Webohook alert box has been removed permanently');
    }

    /**
     * Change the application language
     * Updates user preference and session locale
     */
    public function changeLanguage(Request $request)
    {
        $locale = $request->get('locale', 'en');

        // Validate locale is supported
        $supportedLocales = ['en', 'ar', 'ru', 'tr', 'de', 'fa'];
        if (!in_array($locale, $supportedLocales)) {
            $locale = 'en';
        }

        // Update user preference if logged in
        if (auth()->check()) {
            $user = auth()->user();
            $user->locale = $locale;
            // Set RTL flag based on locale
            $user->rtl = in_array($locale, ['ar', 'fa', 'he']) ? 1 : 0;
            $user->save();
        }

        // Update session locale
        session(['locale' => $locale]);
        app()->setLocale($locale);

        // Redirect back to previous page
        return redirect()->back();
    }

}
