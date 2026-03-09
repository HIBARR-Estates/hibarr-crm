<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\MeetingType;
use App\Models\User;
use App\Services\PermissionService;
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
            $this->addFollowUpPermission = user()->permission('add_lead_follow_up');
            $this->editFollowUpPermission = user()->permission('edit_lead_follow_up');
            $this->deleteFollowUpPermission = user()->permission('delete_lead_follow_up');

            return $next($request);
        });
    }

    /**
     * Display the meetings index page with overview stats, upcoming & past sections.
     */
    public function index(Request $request)
    {
        $userId = user()->id;
        $now = Carbon::now('UTC');

        $eagerLoads = [
            'deal:id,name,agent_id,value,currency_id,pipeline_stage_id',
            'deal.leadStage:id,name,slug,label_color',
            'deal.contact:id,client_name',
            'deal.currency:id,currency_symbol',
            'addedBy:id,name,image',
            'meetingType',
            'meetingSummary',
        ];

        // ── Base scope: user is participant OR creator ──────────────────
        $scopeUser = function ($query) use ($userId) {
            $query->whereJsonContains('participants', $userId)
                  ->orWhere('added_by', $userId);
        };

        // ── Overview stats ─────────────────────────────────────────────
        $weekStart = Carbon::now('UTC')->startOfWeek();
        $weekEnd   = Carbon::now('UTC')->endOfWeek();

        $upcomingCount = DealFollowUp::where($scopeUser)
            ->where('next_follow_up_date', '>=', $now)
            ->count();

        $thisWeekCount = DealFollowUp::where($scopeUser)
            ->whereBetween('next_follow_up_date', [$weekStart, $weekEnd])
            ->count();

        // Live = scheduled + currently within [start, start + duration]
        $liveMeetings = DealFollowUp::where($scopeUser)
            ->where('status', 'scheduled')
            ->where('next_follow_up_date', '<=', $now)
            ->get(['id', 'next_follow_up_date', 'duration']);

        $liveCount = $liveMeetings->filter(function ($m) use ($now) {
            $duration = $m->getEffectiveDuration();
            $end = $m->next_follow_up_date->copy()->addMinutes($duration);
            return $now->lte($end);
        })->count();

        $completedCount = DealFollowUp::where($scopeUser)
            ->where('status', 'completed')
            ->count();

        $overviewStats = [
            'upcoming'  => $upcomingCount,
            'this_week' => $thisWeekCount,
            'live'      => $liveCount,
            'completed' => $completedCount,
        ];

        // ── Paginated sections ─────────────────────────────────────────
        $upcomingPerPage = (int) $request->get('upcoming_per_page', 6);
        $pastPerPage     = (int) $request->get('past_per_page', 6);

        $upcomingMeetings = DealFollowUp::with($eagerLoads)
            ->where($scopeUser)
            ->where('next_follow_up_date', '>=', $now)
            ->orderBy('next_follow_up_date', 'asc')
            ->paginate($upcomingPerPage, ['*'], 'upcoming_page');

        $pastMeetings = DealFollowUp::with($eagerLoads)
            ->where($scopeUser)
            ->where('next_follow_up_date', '<', $now)
            ->orderBy('next_follow_up_date', 'desc')
            ->paginate($pastPerPage, ['*'], 'past_page');

        // Append effective_duration and resolve participant users for each record
        $allUserIds = collect();
        $collectParticipantIds = function ($paginator) use (&$allUserIds) {
            $paginator->getCollection()->each(function ($followUp) use (&$allUserIds) {
                if (!empty($followUp->participants)) {
                    $allUserIds = $allUserIds->merge($followUp->participants);
                }
            });
        };
        $collectParticipantIds($upcomingMeetings);
        $collectParticipantIds($pastMeetings);

        // Batch-load all participant users in one query
        $participantUsers = User::whereIn('id', $allUserIds->unique()->values())
            ->get(['id', 'name', 'image', 'email'])
            ->keyBy('id');

        $transformRecords = function ($paginator) use ($participantUsers) {
            $paginator->getCollection()->transform(function ($followUp) use ($participantUsers) {
                $followUp->effective_duration = $followUp->getEffectiveDuration();
                // Resolve participant IDs to user data for MultiUserIndicator
                $followUp->participant_users = collect($followUp->participants ?? [])
                    ->map(fn ($id) => $participantUsers->get($id))
                    ->filter()
                    ->values()
                    ->toArray();
                return $followUp;
            });
            return $paginator;
        };
        $transformRecords($upcomingMeetings);
        $transformRecords($pastMeetings);

        // ── User's deals for "Schedule Meeting" ────────────────────────
        $dealsQuery = Deal::select('id', 'name')
            ->where('next_follow_up', 'yes');

        // Scope deals to the user unless they have 'all' permission
        $viewDealsPermission = user()->permission('view_deals');
        if ($viewDealsPermission !== 'all') {
            $dealRules = [
                'added' => 'deals.added_by',
                'owned' => function ($q, $user) {
                    $q->where(function ($query) use ($user) {
                        $query->whereHas('leadAgent', function ($q) use ($user) {
                            $q->where('user_id', $user->id);
                        })->orWhereHas('dealWatchers', function ($q) use ($user) {
                            $q->where('users.id', $user->id);
                        });
                    });
                },
            ];
            PermissionService::applyScope($dealsQuery, user(), 'view_deals', $dealRules);
        }

        $userDeals = $dealsQuery->orderBy('name')->get();

        // ── Meeting types ──────────────────────────────────────────────
        $meetingTypes = MeetingType::where('is_active', 1)->get();

        // ── Permissions ────────────────────────────────────────────────
        $permissions = [
            'view_lead_follow_up'   => $this->viewFollowUpPermission,
            'add_lead_follow_up'    => $this->addFollowUpPermission,
            'edit_lead_follow_up'   => $this->editFollowUpPermission,
            'delete_lead_follow_up' => $this->deleteFollowUpPermission,
        ];

        return Inertia::render('Meetings/Index', [
            'pageTitle'        => __($this->pageTitle),
            'overviewStats'    => $overviewStats,
            'upcomingMeetings' => $upcomingMeetings,
            'pastMeetings'     => $pastMeetings,
            'userDeals'        => $userDeals,
            'meetingTypes'     => $meetingTypes,
            'permissions'      => $permissions,
        ]);
    }

    /**
     * Return a deal's data sufficient for the SaveFollowup form (participants, watchers).
     * Called via AJAX when user selects a deal in the "Schedule Meeting" drawer.
     */
    public function getDealForScheduling(Deal $deal)
    {
        $deal->load([
            'dealParticipants:id,name,image,email',
            'dealWatchers:id,name,image,email',
            'contact:id,client_name',
            'leadStage:id,name,slug,label_color',
            'currency:id,currency_symbol',
        ]);

        return response()->json([
            'success' => true,
            'data' => $deal,
        ]);
    }

    /**
     * Reschedule an existing follow-up (date, time, and optionally duration).
     * Only the creator (added_by) or users with 'all' edit permission can reschedule.
     */
    public function reschedule(Request $request, DealFollowUp $followUp)
    {
        $this->editFollowUpPermission = user()->permission('edit_lead_follow_up');

        abort_403(!(
            $this->editFollowUpPermission == 'all'
            || ($this->editFollowUpPermission == 'added' && $followUp->added_by == user()->id)
        ));

        $request->validate([
            'next_follow_up_date' => 'required|date_format:d-m-Y',
            'start_time'          => 'required|date_format:H:i:s',
            'duration'            => 'nullable|integer|min:5|max:480',
            'timezone'            => 'nullable|string|max:100',
        ]);

        $browserTimezone = $request->input('timezone', 'UTC');

        $newDateTime = Carbon::createFromFormat(
            'd-m-Y H:i:s',
            $request->next_follow_up_date . ' ' . $request->start_time,
            $browserTimezone
        )->setTimezone('UTC');

        $followUp->next_follow_up_date = $newDateTime;
        $followUp->status = 'scheduled';

        if ($request->has('duration')) {
            $followUp->duration = $request->duration;
        }

        $followUp->save();

        return response()->json([
            'success' => true,
            'message' => 'Meeting rescheduled successfully.',
        ]);
    }

}
