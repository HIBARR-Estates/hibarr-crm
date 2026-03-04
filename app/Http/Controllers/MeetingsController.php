<?php

namespace App\Http\Controllers;

use App\Models\DealFollowUp;
use App\Models\MeetingType;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MeetingsController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.meetings';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array('leads', $this->user->modules));

            $this->viewFollowUpPermission = user()->permission('view_lead_follow_up');
            $this->editFollowUpPermission = user()->permission('edit_lead_follow_up');
            $this->deleteFollowUpPermission = user()->permission('delete_lead_follow_up');

            return $next($request);
        });
    }

    /**
     * Display the meetings index page with upcoming and past meetings tabs.
     *
     * Meetings are scoped to the authenticated user — either as a participant
     * (stored in JSON `participants` column) or as the creator (`added_by`).
     */
    public function index(Request $request)
    {
        $userId = user()->id;
        $now = Carbon::now('UTC');
        $tab = $request->get('tab', 'upcoming');
        $perPage = (int) $request->get('per_page', 15);

        // Base query: meetings where the current user is a participant or creator
        $baseQuery = DealFollowUp::with([
            'deal:id,name,agent_id,value,currency_id,pipeline_stage_id',
            'deal.leadStage:id,name,slug,label_color',
            'deal.contact:id,client_name',
            'deal.currency:id,currency_symbol',
            'addedBy:id,name,image',
            'meetingType',
            'meetingSummary',
        ])
        ->where(function ($query) use ($userId) {
            $query->whereJsonContains('participants', $userId)
                  ->orWhere('added_by', $userId);
        });

        // Upcoming meetings: soonest first
        $upcomingQuery = (clone $baseQuery)
            ->where('next_follow_up_date', '>=', $now)
            ->orderBy('next_follow_up_date', 'asc');

        // Past meetings: most recent first
        $pastQuery = (clone $baseQuery)
            ->where('next_follow_up_date', '<', $now)
            ->orderBy('next_follow_up_date', 'desc');

        // Paginate based on active tab, but always return both counts
        $upcomingPage = $tab === 'upcoming' ? (int) $request->get('page', 1) : 1;
        $pastPage = $tab === 'past' ? (int) $request->get('page', 1) : 1;

        $upcomingMeetings = $upcomingQuery->paginate($perPage, ['*'], 'page', $upcomingPage);
        $pastMeetings = $pastQuery->paginate($perPage, ['*'], 'page', $pastPage);

        // Meeting types for reference
        $meetingTypes = MeetingType::where('is_active', 1)->get();

        // Permissions
        $permissions = [
            'view_lead_follow_up' => $this->viewFollowUpPermission,
            'edit_lead_follow_up' => $this->editFollowUpPermission,
            'delete_lead_follow_up' => $this->deleteFollowUpPermission,
        ];

        return Inertia::render('Meetings/Index', [
            'pageTitle' => __($this->pageTitle),
            'upcomingMeetings' => $upcomingMeetings,
            'pastMeetings' => $pastMeetings,
            'meetingTypes' => $meetingTypes,
            'permissions' => $permissions,
            'activeTab' => $tab,
        ]);
    }

}
