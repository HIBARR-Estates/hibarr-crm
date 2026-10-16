<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\PartnerFlag;
use App\Notifications\PartnerFlagAnswered;
use App\Notifications\PartnerFlagRaised;
use App\Support\FeatureFlags;
use App\Support\PartnerFlagRecipients;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

/**
 * Partner flags: a partner asking for a look at one of their own referrals.
 *
 * The trust boundary is enforced here rather than in the UI. A partner may
 * only flag a lead their own LeadAgent introduced, and the check is a query
 * against referred_by_agent_id — not a hidden field, not a client-side guard.
 */
class PartnerFlagController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.dashboard';
    }

    public function store(Request $request)
    {
        $request->validate([
            'lead_id' => 'required|integer',
            'reason' => ['required', Rule::in(PartnerFlag::REASONS)],
            'message' => 'nullable|string|max:1000',
        ]);

        $agent = LeadAgent::where('user_id', user()->id)->first();

        abort_403(is_null($agent));

        // The whole trust boundary, in one query.
        $lead = Lead::where('id', $request->lead_id)
            ->where('referred_by_agent_id', $agent->id)
            ->first();

        abort_403(is_null($lead));

        // Dedupe on the open ones only: a resolved flag from three months ago
        // must not stop the partner raising the same concern again.
        $flag = PartnerFlag::open()
            ->where('lead_agent_id', $agent->id)
            ->where('lead_id', $lead->id)
            ->first();

        if (is_null($flag)) {
            $flag = PartnerFlag::create([
                'company_id' => $lead->company_id,
                'lead_agent_id' => $agent->id,
                'lead_id' => $lead->id,
                'reason' => $request->reason,
                'message' => $request->message,
                'status' => PartnerFlag::STATUS_OPEN,
            ]);

            $this->notifyManagers($flag);
        }

        return back()->with('success', __('messages.recordSaved'));
    }

    public function resolve(Request $request, PartnerFlag $flag)
    {
        abort_403(user()->permission('manage_partner_flags') !== 'all');

        $request->validate([
            'response' => 'required|string|max:1000',
            'status' => ['nullable', Rule::in([
                PartnerFlag::STATUS_ACKNOWLEDGED,
                PartnerFlag::STATUS_RESOLVED,
            ])],
        ]);

        $flag->update([
            'status' => $request->status ?: PartnerFlag::STATUS_RESOLVED,
            'response' => $request->response,
            'resolved_by' => user()->id,
            'resolved_at' => now(),
        ]);

        $this->notifyPartner($flag);

        return back()->with('success', __('messages.updateSuccess'));
    }

    /**
     * Mail and an in-app notification to admins and to everyone who can answer
     * the flag. Sent now, not queued: a worker that is not running was dropping
     * both, and the partner had already been told the flag was saved.
     *
     * The routing flag still decides where the button lands. It no longer
     * decides who is told.
     */
    private function notifyManagers(PartnerFlag $flag): void
    {
        try {
            $routed = FeatureFlags::enabled(PartnerFlag::ROUTING_FLAG);
        } catch (\Throwable $e) {
            report($e);
            $routed = false;
        }

        $this->deliver(
            PartnerFlagRecipients::resolve((int) $flag->company_id, true),
            new PartnerFlagRaised($flag, $routed),
        );
    }

    /** The partner who raised it hears the reply the same way. */
    private function notifyPartner(PartnerFlag $flag): void
    {
        $partner = $flag->partner()->first()?->user;

        if ($partner === null) {
            return;
        }

        $this->deliver($partner, new PartnerFlagAnswered($flag));
    }

    private function deliver(mixed $notifiable, PartnerFlagRaised $notification): void
    {
        try {
            Notification::sendNow($notifiable, $notification);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
