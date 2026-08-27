<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\Settings\UpdateOrganisationSettings;
use App\Traits\CurrencyExchange;
use App\Models\User;
use App\Models\DealAutomation;
use App\Models\CrmEventCategory;
use App\Models\CrmEventType;
use App\Models\CrmBusinessRule;
use App\Models\CrmEventRetentionPolicy;
use App\Support\MeetingAttendanceConfirmationFeature;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

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

    public function crm_events()
    {
        $this->pageTitle = 'app.menu.crmEventSettings';
        $this->activeSettingMenu = 'crm_event_settings';
        $this->categories = CrmEventCategory::withCount('eventTypes')->orderBy('name')->get();
        $this->eventTypes = CrmEventType::with(['category', 'businessRule'])->orderBy('name')->get();
        $this->businessRules = CrmBusinessRule::withCount('eventTypes')->orderBy('name')->get();
        $this->retentionPolicy = CrmEventRetentionPolicy::first();

        return view('company-settings.crm_events', $this->data);
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

        // Manual override for the meeting-attendance-confirmation rollout:
        // blank clears it back to null (auto-stamped again on next check).
        // Parse through Carbon first — the <input type="datetime-local">
        // value ("2026-08-20T07:00", no seconds) doesn't match the strict
        // Y-m-d H:i:s format Eloquent's datetime cast requires when you
        // assign it a raw string, and throws InvalidFormatException instead
        // of saving. Assigning an actual Carbon instance skips that parsing
        // entirely.
        // Cache::forget below is required, not just tidy — the auto-stamp
        // path caches "already activated" for an hour and never re-reads the
        // column once that's set, so it would silently ignore this write
        // until the cache entry expired on its own.
        $setting->meeting_attendance_confirmation_enabled_at = $request->filled('meeting_attendance_confirmation_enabled_at')
            ? \Carbon\Carbon::parse($request->meeting_attendance_confirmation_enabled_at)
            : null;

        $setting->save();

        MeetingAttendanceConfirmationFeature::clearActivationCache((int) $setting->id);

        return Reply::success(__('messages.updateSuccess'));
    }

    // Remove in v 5.2.5
    public function hideWebhookAlert()
    {
        $this->company->show_new_webhook_alert = false;
        $this->company->saveQuietly();
        session()->forget('company');
        session()->forget('user');
        session()->forget('companyOrGlobalSetting');

        return Reply::success('Webohook alert box has been removed permanently');
    }

    /**
     * Change the application language
     * Updates user preference and session locale
     */
    public function changeLanguage(Request $request)
    {
        $locale = $request->get('locale', 'en');

        \Log::channel('daily')->info('[i18n] changeLanguage called', [
            'requested_locale' => $locale,
            'user_id'         => auth()->id(),
            'user_permission' => function_exists('user') && user() ? user()->permission('manage_company_setting') : 'N/A',
            'ip'              => $request->ip(),
        ]);

        // Validate locale is supported (exactly four languages per spec)
        $supportedLocales = ['en', 'de', 'ru', 'tr'];
        if (!in_array($locale, $supportedLocales)) {
            \Log::channel('daily')->warning('[i18n] Unsupported locale requested, falling back to en', ['locale' => $locale]);
            $locale = 'en';
        }

        // Update user preference if logged in
        if (auth()->check()) {
            $user = auth()->user();
            $user->locale = $locale;
            // None of the four supported languages are RTL
            $user->rtl = 0;
            $user->save();

            \Log::channel('daily')->info('[i18n] User locale updated in DB', [
                'user_id'      => $user->id,
                'locale'       => $locale,
                'save_success' => true,
            ]);
        } else {
            \Log::channel('daily')->warning('[i18n] changeLanguage called but user is NOT authenticated');
        }

        // Clear cached translations so the next request loads fresh data
        Cache::forget("translations_{$locale}");
        \Log::channel('daily')->info('[i18n] Translation cache cleared', ['cache_key' => "translations_{$locale}"]);

        // Update session locale
        session(['locale' => $locale]);
        app()->setLocale($locale);

        \Log::channel('daily')->info('[i18n] Session and app locale set', [
            'session_locale' => session('locale'),
            'app_locale'     => app()->getLocale(),
        ]);

        // Redirect back to previous page
        return redirect()->back();
    }

}
