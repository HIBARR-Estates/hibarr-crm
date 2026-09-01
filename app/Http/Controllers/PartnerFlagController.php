<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\PartnerFlag;
use App\Models\User;
use App\Notifications\PartnerFlagRaised;
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

        return back()->with('success', __('messages.updateSuccess'));
    }

    /**
     * Notify company admins. Permission-scoped managers are disabled until
     * that routing is reviewed (TODO below).
     */
    private function notifyManagers(PartnerFlag $flag): void
    {
        // TODO: also notify users with manage_partner_flags = all.
        Notification::send(
            User::allAdmins((int) $flag->company_id),
            new PartnerFlagRaised($flag),
        );
    }
}
