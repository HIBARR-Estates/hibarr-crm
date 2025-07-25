<?php

namespace App\Http\Controllers;

use App\Helper\Files;
use App\Helper\Reply;
use App\Models\GdprSetting;
use App\Models\PurposeConsent;
use App\Models\PurposeConsentUser;
use App\Models\User;
use App\Models\RemovalRequest;
use Illuminate\Http\Request;

class GdprController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.gdpr';
        $this->gdprSetting = GdprSetting::first();

         $this->middleware(function ($request, $next) {
            abort_403(!(user()->permission('manage_gdpr_setting') == 'all' || in_array('client', user_roles())));
            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        $this->view = 'gdpr.ajax.right-to-informed';

        $this->user = User::findOrFail($this->user->id);

        $this->consents = PurposeConsent::with(['user' => function($query) {
            $query->where('client_id', $this->user->id)
                ->orderByDesc('created_at');
        }])->get();

        $this->removalRequest = RemovalRequest::where('user_id', $this->user->id)->where('status', 'pending')->first();

        $tab = request('tab');

        $this->view = match ($tab) {
            'right-to-erasure' => 'gdpr.ajax.right-to-erasure',
            'right-to-data-portability' => 'gdpr.ajax.right-to-data-portability',
            'right-to-access' => 'gdpr.ajax.right-to-access',
            'consent' => 'gdpr.ajax.consent',
            default => 'gdpr.ajax.right-to-informed',
        };

        $this->activeTab = $tab ?: 'right-to-informed';

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle, 'activeTab' => $this->activeTab]);
        }

        return view('gdpr.index', $this->data);
    }

    public function updateClientConsent(Request $request)
    {
        $allConsents = $request->has('consent_customer') ? $request->consent_customer : [];

        foreach ($allConsents as $allConsentId => $allConsentStatus)
        {
            $newConsentLead = new PurposeConsentUser();
            $newConsentLead->client_id = $this->user->id;
            $newConsentLead->updated_by_id = $this->user->id;
            $newConsentLead->purpose_consent_id = $allConsentId;
            $newConsentLead->status = $allConsentStatus;
            $newConsentLead->ip = $request->ip();
            $newConsentLead->save();

        }

        return Reply::success(__('messages.gdprUpdated'));
    }

    public function updateConsentBlock(Request $request)
    {
        $removalRequest = RemovalRequest::where('company_id', company()->id)->where('user_id', $this->user->id)->where('status', 'pending')->first();

        if (!$removalRequest) {
            $removalRequest = new RemovalRequest;
        }
        $removalRequest->user_id = $this->user->id;
        $removalRequest->name = $this->user->name;
        $removalRequest->company_id = company()->id;
        $removalRequest->description = $request->consent_block;
        $removalRequest->save();
        return Reply::success(__('messages.gdprRequestUpdated'));
    }

    public function downloadJson(Request $request)
    {
        $table = User::with('clientDetails', 'attendance', 'employee', 'employeeDetail', 'projects', 'member', 'group')->findOrFail(user()->id);
        $filename = Files::UPLOAD_FOLDER.'/user.json';
        $handle = fopen($filename, 'w+');
        fputs($handle, $table->toJson(JSON_PRETTY_PRINT));
        fclose($handle);
        $headers = array('Content-type' => 'application/json');

        return response()->download($filename, 'user.json', $headers);
    }

}
