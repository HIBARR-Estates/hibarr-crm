<?php

namespace Modules\Biolinks\Http\Controllers;

use App\Helper\Reply;
use Illuminate\Http\Request;
use Modules\Biolinks\Enums\YesNo;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Hash;
use Modules\Biolinks\Entities\Biolink;
use Illuminate\Support\Facades\Session;
use Modules\Biolinks\Entities\BiolinkBlocks;
use Modules\Biolinks\Entities\BiolinkSetting;
use App\Http\Controllers\AccountBaseController;
use Modules\Biolinks\Events\PhoneCollectionEmailEvent;
use Modules\Biolinks\Http\Requests\EmailCollectorRequest;
use Modules\Biolinks\Http\Requests\PhoneCollectorRequest;
use Modules\Biolinks\Http\Requests\BiolinkPasswordRequest;

class BiolinkPageController extends AccountBaseController
{

    public function __construct()
    {
        $this->baseUrl = URL::to('/');
    }

    /**
     * Display a listing of the methods.
     */
    public function index($slug)
    {
        $this->biolink = Biolink::where('page_link', $slug)->active()->first();
        abort_if(!$this->biolink, 404, __('biolinks::messages.pageNotFound'));

        $this->biolinkSettings = BiolinkSetting::findOrFail($this->biolink->id);
        $this->blocks = BiolinkBlocks::where('biolink_id', $this->biolink->id)->orderBy('position')->get();
        $this->emailBlock = BiolinkBlocks::where('biolink_id', $this->biolink->id)->where('type', 'email-collector')->first();
        $this->phoneBlock = BiolinkBlocks::where('biolink_id', $this->biolink->id)->where('type', 'phone-collector')->first();

        $hasPassword = Session::get('password');
        $isSensitive = Session::get('sensitive');

        if ($this->biolinkSettings->protection_password && is_null($hasPassword)) {
            if ($this->biolinkSettings->protection_password != $hasPassword) {
                return view('biolinks::biolink-page.password-page', $this->data);
            }
        }

        if ($this->biolinkSettings->is_sensitive == YesNo::Yes && is_null($isSensitive)) {
            return view('biolinks::biolink-page.sensitive-warning', $this->data);
        }

        $this->biolink->increment('total_page_views');

        return view('biolinks::biolink-page.index', $this->data);
    }

    public function checkPassword(BiolinkPasswordRequest $request, $slug)
    {
        $this->biolink = Biolink::where('page_link', $slug)->first();
        $this->biolinkSettings = BiolinkSetting::where('id', $this->biolink->id)->first();

        if (Hash::check($request->password, $this->biolinkSettings->protection_password)) {

            Session::put('password', $this->biolinkSettings->protection_password);

            if ($this->biolinkSettings->is_sensitive == YesNo::Yes) {
                return view('biolinks::biolink-page.sensitive-warning', $this->data);
            }

            return redirect()->route('biolink.index', $slug);
        }

        return redirect()->back()->withErrors(['wrong_password' => __('messages.incorrectPassword')]);
    }

    public function checkSensitive($slug)
    {
        $this->biolink = Biolink::where('page_link', $slug)->first();
        $this->biolinkSettings = BiolinkSetting::where('id', $this->biolink->id)->first();

        Session::put('sensitive', 'yes');

        return redirect()->route('biolink.index', $slug);
    }

    public function emailModal(Request $request)
    {
        $this->emailBlock = BiolinkBlocks::where('id', $request->id)->where('type', 'email-collector')->first();

        $view = view('biolinks::biolinks.ajax.email-collector-modal', $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'html' => $view]);
    }

    public function phoneModal(Request $request)
    {
        $this->phoneBlock = BiolinkBlocks::where('id', $request->id)->where('type', 'phone-collector')->first();

        $view = view('biolinks::biolinks.ajax.phone-collector-modal', $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'html' => $view]);
    }

    public function subscribe(EmailCollectorRequest $request, $id)
    {
        $emailBlock = BiolinkBlocks::where('id', $id)->where('type', 'email-collector')->first();

        if ($emailBlock->api_key && $emailBlock->mailchimp_list) {

            $list_id = $emailBlock->mailchimp_list;
            $apiKey = explode('-', $emailBlock->api_key);
            $server = $apiKey[1];

            $mailchimp = new \MailchimpMarketing\ApiClient();

            $mailchimp->setConfig([
                'apiKey' => $emailBlock->api_key,
                'server' => $server
            ]);

            try {
                $response = $mailchimp->lists->addListMember($list_id, [
                    'email_address' => $request->email,
                    'status' => 'subscribed',
                    'merge_fields' => [
                        'FNAME' => $request->name,
                    ]
                ]);

                return Reply::success(__('biolinks::messages.newsLetterSubscribe'));
            } catch (\MailchimpMarketing\ApiException $e) {
                return Reply::error($e);
            }
        }

        return Reply::error(__('biolink::messages.ApiNotAvailable'));
    }

    public function phoneCollector(PhoneCollectorRequest $request, $id)
    {
        $name = $request->name;
        $phone = $request->phone;

        $phoneBlock = BiolinkBlocks::where('type', 'phone-collector')->findOrFail($id);
        event(new PhoneCollectionEmailEvent($phoneBlock, $name, $phone));

        return Reply::success(__('biolinks::messages.newsLetterSubscribe'));
    }

}
