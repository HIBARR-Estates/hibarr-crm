<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\MeetingType;
use App\Models\User;
use App\Services\MeetingVisibilityService;
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
            'lead:id,client_name,salutation,company_name',
            'addedBy:id,name,image',
            'meetingType',
            'meetingSummary',
        ];

        // ── Overview stats ─────────────────────────────────────────────
        $weekStart = Carbon::now('UTC')->startOfWeek();
        $weekEnd   = Carbon::now('UTC')->endOfWeek();

        $upcomingCount = MeetingVisibilityService::scopeVisibleToUser(DealFollowUp::query(), $userId)
            ->where('next_follow_up_date', '>=', $now)
            ->count();

        $thisWeekCount = MeetingVisibilityService::scopeVisibleToUser(DealFollowUp::query(), $userId)
            ->whereBetween('next_follow_up_date', [$weekStart, $weekEnd])
            ->count();

        // Live = scheduled + currently within [start, start + duration]
        $liveMeetings = MeetingVisibilityService::scopeVisibleToUser(DealFollowUp::query(), $userId)
            ->where('status', 'scheduled')
            ->where('next_follow_up_date', '<=', $now)
            ->get(['id', 'next_follow_up_date', 'duration']);

        $liveCount = $liveMeetings->filter(function ($m) use ($now) {
            $duration = $m->getEffectiveDuration();
            $end = $m->next_follow_up_date->copy()->addMinutes($duration);
            return $now->lte($end);
        })->count();

        $completedCount = MeetingVisibilityService::scopeVisibleToUser(DealFollowUp::query(), $userId)
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

        // A meeting is "live" when it has started but not yet ended:
        //   next_follow_up_date <= now AND next_follow_up_date + duration > now AND status = 'scheduled'
        // Live meetings should appear in Upcoming, not Past.
        $defaultDuration = DealFollowUp::DEFAULT_DURATION_MINUTES;

        $upcomingMeetings = MeetingVisibilityService::scopeVisibleToUser(
            DealFollowUp::with($eagerLoads),
            $userId
        )->where(function ($query) use ($now, $defaultDuration) {
                // Truly upcoming (haven't started yet)
                $query->where('next_follow_up_date', '>=', $now)
                    // OR currently live (started but not ended)
                    ->orWhere(function ($q) use ($now, $defaultDuration) {
                        $q->where('status', 'scheduled')
                          ->where('next_follow_up_date', '<=', $now)
                          ->whereRaw(
                              'DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) >= ?',
                              [$defaultDuration, $now]
                          );
                    });
            })
            ->orderBy('next_follow_up_date', 'asc')
            ->paginate($upcomingPerPage, ['*'], 'upcoming_page');

        $pastMeetings = MeetingVisibilityService::scopeVisibleToUser(
            DealFollowUp::with($eagerLoads),
            $userId
        )->where('next_follow_up_date', '<', $now)
            // Exclude live meetings from Past
            ->where(function ($query) use ($now, $defaultDuration) {
                $query->where('status', '!=', 'scheduled')
                    ->orWhereRaw(
                        'DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) < ?',
                        [$defaultDuration, $now]
                    );
            })
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

        // ── User's deals & leads for "Schedule Meeting" ────────────────
        $userDeals = MeetingVisibilityService::schedulableDealsQuery()->get();
        $userLeads = MeetingVisibilityService::schedulableLeadsQuery()
            ->get()
            ->map(fn (Lead $lead) => [
                'id'   => $lead->id,
                'name' => $lead->company_name
                    ? "{$lead->client_name} ({$lead->company_name})"
                    : $lead->client_name,
            ]);

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
            'userLeads'        => $userLeads,
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
        abort_403(
            $deal->next_follow_up !== 'yes'
            || !MeetingVisibilityService::schedulableDealsQuery()
                ->where('id', $deal->id)
                ->exists()
        );

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
     * Return a lead's data sufficient for the SaveFollowup form (owner, related deals).
     * Called via AJAX when user selects a lead in the "Schedule Meeting" drawer.
     */
    public function getLeadForScheduling(Lead $lead)
    {
        abort_403(
            ($lead->next_follow_up ?? 'yes') === 'no'
            || !MeetingVisibilityService::schedulableLeadsQuery()
                ->where('id', $lead->id)
                ->exists()
        );

        $lead->load([
            'leadOwner:id,name,image,email',
        ]);

        $dealsForLead = Deal::select('id', 'name')
            ->where('lead_id', $lead->id)
            ->where('next_follow_up', 'yes')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success'        => true,
            'data'           => $lead,
            'deals_for_lead' => $dealsForLead,
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
