<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\MeetingType;
use App\Models\User;
use App\Services\MeetingVisibilityService;
use App\Support\FeatureFlags;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MeetingsController extends AccountBaseController
{
    /** Redesigned Meetings index (tab-driven list + month calendar). */
    private const REDESIGN_FLAG = 'crm.meetings-page-redesign';

    /** Filter tabs the redesigned list accepts. */
    private const TABS = ['all', 'upcoming', 'live', 'past'];

    /** Hard ceiling on chips the calendar month query will return. */
    private const CALENDAR_EVENT_LIMIT = 500;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.meetings';

        $this->middleware(function ($request, $next) {
            abort_403(! in_array('leads', $this->user->modules));

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

        // The redesigned page replaces the two fixed Upcoming/Past sections
        // with one tab-driven list plus an optional month calendar, so it
        // needs a different prop set. Both shapes are built from the same
        // bucket scopes below — a meeting must land in exactly one of
        // Upcoming/Live/Past whichever page renders it.
        $redesign = FeatureFlags::enabled(self::REDESIGN_FLAG);

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

        $defaultDuration = DealFollowUp::DEFAULT_DURATION_MINUTES;

        // A meeting is "live" when it has started but not yet ended:
        //   next_follow_up_date <= now AND next_follow_up_date + duration > now AND status = 'scheduled'
        // Live meetings should appear in Upcoming, not Past.
        $scopeLive = function ($query) use ($now, $defaultDuration) {
            $query->where('status', 'scheduled')
                ->where('next_follow_up_date', '<=', $now)
                ->whereRaw(
                    'DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) >= ?',
                    [$defaultDuration, $now]
                );
        };

        $scopeUpcoming = function ($query) use ($now, $scopeLive) {
            // Truly upcoming (haven't started yet) OR currently live.
            $query->where('next_follow_up_date', '>=', $now)
                ->orWhere($scopeLive);
        };

        $scopePast = function ($query) use ($now, $defaultDuration) {
            $query->where('next_follow_up_date', '<', $now)
                // Exclude live meetings from Past
                ->where(function ($inner) use ($now, $defaultDuration) {
                    $inner->where('status', '!=', 'scheduled')
                        ->orWhereRaw(
                            'DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) < ?',
                            [$defaultDuration, $now]
                        );
                });
        };

        // ── Overview stats ─────────────────────────────────────────────
        $weekStart = Carbon::now('UTC')->startOfWeek();
        $weekEnd = Carbon::now('UTC')->endOfWeek();

        // One pass with conditional sums instead of four trips over the same
        // table. The live count used to pull every past-dated scheduled meeting
        // into memory to filter in PHP — unbounded, and growing with history.
        // The end-time expression matches the one the Upcoming/Past queries below use.
        // The last three sums are the redesign's tab tallies; they restate the
        // scopes above in SQL so a tab's count matches the list it opens.
        $liveSql = "status = 'scheduled'"
            . ' AND next_follow_up_date <= ?'
            . ' AND DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) >= ?';
        $pastSql = 'next_follow_up_date < ?'
            . " AND (status != 'scheduled'"
            . ' OR DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) < ?)';

        $counts = MeetingVisibilityService::scopeVisibleToUser(DealFollowUp::query(), $userId)
            ->selectRaw(
                'COUNT(*) as total,'
                . ' SUM(next_follow_up_date >= ?) as upcoming,'
                . ' SUM(next_follow_up_date BETWEEN ? AND ?) as this_week,'
                . " SUM($liveSql) as live,"
                . " SUM(status = 'completed') as completed,"
                . " SUM(next_follow_up_date >= ? OR ($liveSql)) as upcoming_tab,"
                . " SUM($pastSql) as past_tab",
                [
                    $now, $weekStart, $weekEnd,
                    $now, $defaultDuration, $now,
                    $now, $now, $defaultDuration, $now,
                    $now, $defaultDuration, $now,
                ]
            )
            ->first();

        $overviewStats = [
            'upcoming' => (int) ($counts->upcoming ?? 0),
            'this_week' => (int) ($counts->this_week ?? 0),
            'live' => (int) ($counts->live ?? 0),
            'completed' => (int) ($counts->completed ?? 0),
        ];

        $tabCounts = [
            'all' => (int) ($counts->total ?? 0),
            'upcoming' => (int) ($counts->upcoming_tab ?? 0),
            'live' => (int) ($counts->live ?? 0),
            'past' => (int) ($counts->past_tab ?? 0),
        ];

        // Optional attendance/date-window filters — used by links into this
        // page that already know what they're looking for (e.g. the personal
        // dashboard's "N missed" badge), so the list they land on actually
        // matches what was counted rather than just "all your past meetings".
        // Attendance is only meaningful for past meetings, so it applies to
        // that query alone.
        $attendanceFilter = $request->get('attendance');

        // Scalar Y-m-d only — Carbon::parse() on an array or garbage string
        // throws, and a malformed link shouldn't 500 the page.
        $isValidDate = function ($value): bool {
            if (! is_string($value)) {
                return false;
            }

            $parsed = \DateTime::createFromFormat('Y-m-d', $value);

            return $parsed !== false && $parsed->format('Y-m-d') === $value;
        };
        $dateFrom = $isValidDate($request->get('date_from')) ? $request->get('date_from') : null;
        $dateTo = $isValidDate($request->get('date_to')) ? $request->get('date_to') : null;

        $applyDateWindow = function ($query) use ($dateFrom, $dateTo) {
            return $query
                ->when($dateFrom, fn ($q) => $q->where('next_follow_up_date', '>=', $dateFrom))
                ->when($dateTo, fn ($q) => $q->where('next_follow_up_date', '<=', Carbon::parse($dateTo)->endOfDay()));
        };

        $upcomingMeetings = null;
        $pastMeetings = null;
        $meetings = null;
        $activeTab = null;

        if ($redesign) {
            // ── Single tab-driven list ─────────────────────────────────
            // An attendance deep link is about meetings that already
            // happened, so land on Past rather than the default Upcoming.
            $requestedTab = $request->get('tab');
            $activeTab = in_array($requestedTab, self::TABS, true)
                ? $requestedTab
                : ($attendanceFilter ? 'past' : 'upcoming');

            $perPage = max(3, min(60, (int) $request->get('per_page', 9)));

            $listQuery = MeetingVisibilityService::scopeVisibleToUser(
                DealFollowUp::with($eagerLoads),
                $userId
            );

            // Upcoming/Live read forwards (soonest first); Past and All read
            // backwards (most recent first).
            $ascending = in_array($activeTab, ['upcoming', 'live'], true);

            if ($activeTab === 'live') {
                $listQuery->where($scopeLive);
            } elseif ($activeTab === 'past') {
                $listQuery->where($scopePast)
                    ->when($attendanceFilter, fn ($q) => $q->where('attendance_outcome', $attendanceFilter));
            } elseif ($activeTab === 'upcoming') {
                $listQuery->where($scopeUpcoming);
            }
            // 'all' takes every bucket — no extra scope.

            $meetings = $applyDateWindow($listQuery)
                ->orderBy('next_follow_up_date', $ascending ? 'asc' : 'desc')
                ->paginate($perPage, ['*'], 'page')
                ->withQueryString();
        } else {
            // ── Legacy paginated sections ──────────────────────────────
            $upcomingPerPage = (int) $request->get('upcoming_per_page', 6);
            $pastPerPage = (int) $request->get('past_per_page', 6);

            $upcomingMeetings = MeetingVisibilityService::scopeVisibleToUser(
                DealFollowUp::with($eagerLoads),
                $userId
            )->where($scopeUpcoming)
                ->orderBy('next_follow_up_date', 'asc')
                ->paginate($upcomingPerPage, ['*'], 'upcoming_page');

            $pastMeetings = $applyDateWindow(
                MeetingVisibilityService::scopeVisibleToUser(
                    DealFollowUp::with($eagerLoads),
                    $userId
                )->where($scopePast)
                    ->when($attendanceFilter, fn ($q) => $q->where('attendance_outcome', $attendanceFilter))
            )
                ->orderBy('next_follow_up_date', 'desc')
                ->paginate($pastPerPage, ['*'], 'past_page');
        }

        // Append effective_duration and resolve participant users for each record
        $paginators = array_filter([$meetings, $upcomingMeetings, $pastMeetings]);

        $allUserIds = collect();
        foreach ($paginators as $paginator) {
            $paginator->getCollection()->each(function ($followUp) use (&$allUserIds) {
                if (! empty($followUp->participants)) {
                    $allUserIds = $allUserIds->merge($followUp->participants);
                }
            });
        }

        // Batch-load all participant users in one query
        $participantUsers = User::whereIn('id', $allUserIds->unique()->values())
            ->get(['id', 'name', 'image', 'email'])
            ->keyBy('id');

        foreach ($paginators as $paginator) {
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
        }

        // ── User's deals & leads for "Schedule Meeting" ────────────────
        $userDeals = MeetingVisibilityService::schedulableDealsQuery()->get();
        $userLeads = MeetingVisibilityService::schedulableLeadsQuery()
            ->get()
            ->map(fn (Lead $lead) => [
                'id' => $lead->id,
                'name' => $lead->company_name
                    ? "{$lead->client_name} ({$lead->company_name})"
                    : $lead->client_name,
            ]);

        // ── Meeting types ──────────────────────────────────────────────
        $meetingTypes = MeetingType::where('is_active', 1)->get();

        // ── Permissions ────────────────────────────────────────────────
        $permissions = [
            'view_lead_follow_up' => $this->viewFollowUpPermission,
            'add_lead_follow_up' => $this->addFollowUpPermission,
            'edit_lead_follow_up' => $this->editFollowUpPermission,
            'delete_lead_follow_up' => $this->deleteFollowUpPermission,
        ];

        $props = [
            'pageTitle' => __($this->pageTitle),
            'overviewStats' => $overviewStats,
            'userDeals' => $userDeals,
            'userLeads' => $userLeads,
            'meetingTypes' => $meetingTypes,
            'permissions' => $permissions,
        ];

        if ($redesign) {
            $props['meetings'] = $meetings;
            $props['tabCounts'] = $tabCounts;
            $props['activeTab'] = $activeTab;
            // Named apart from Inertia's shared `filters` prop, which other
            // index pages already use for their own filter shape.
            $props['meetingFilters'] = [
                'attendance' => $attendanceFilter,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ];

            // The month grid is a different query over a different window, and
            // only the calendar view can show it — register it as a deferred
            // prop just for that view so the card view never pays for it. The
            // client re-requests this key alone when the month changes.
            //
            // `calendarRequestedMonth` tells the page which month (if any) this
            // render registered, so it can wait for Inertia's own deferred
            // fetch instead of racing it with a duplicate request.
            $props['calendarRequestedMonth'] = null;

            if ($request->get('view') === 'calendar') {
                $calendarMonth = $this->resolveCalendarMonth($request->get('cal_month'));
                $props['calendarRequestedMonth'] = $calendarMonth->format('Y-m');
                $props['calendarMeetings'] = Inertia::defer(
                    fn () => $this->calendarPayload($calendarMonth, $userId, $now, $defaultDuration)
                );
            }
        } else {
            $props['upcomingMeetings'] = $upcomingMeetings;
            $props['pastMeetings'] = $pastMeetings;
        }

        return Inertia::render('Meetings/Index', $props);
    }

    /**
     * `YYYY-MM` from the request, or the current month when absent/malformed.
     */
    private function resolveCalendarMonth(mixed $value): Carbon
    {
        if (is_string($value) && preg_match('/^\d{4}-\d{2}$/', $value)) {
            $parsed = Carbon::createFromFormat('Y-m-d', $value.'-01', 'UTC');

            if ($parsed !== false) {
                return $parsed->startOfMonth();
            }
        }

        return Carbon::now('UTC')->startOfMonth();
    }

    /**
     * Month of meetings for the calendar view, plus the people who appear in
     * them (the "Calendar for" chips). The window is padded by a day on each
     * side because cells are placed by the *viewer's* local date, which can
     * pull a boundary meeting into the neighbouring month.
     */
    private function calendarPayload(Carbon $month, int $userId, Carbon $now, int $defaultDuration): array
    {
        $windowStart = $month->copy()->startOfMonth()->subDay();
        $windowEnd = $month->copy()->endOfMonth()->addDay();

        $records = MeetingVisibilityService::scopeVisibleToUser(
            DealFollowUp::with([
                'deal:id,name',
                'lead:id,client_name,salutation,company_name',
                'meetingType:id,name',
            ]),
            $userId
        )
            ->whereBetween('next_follow_up_date', [$windowStart, $windowEnd])
            ->orderBy('next_follow_up_date', 'asc')
            // A month of meetings is a bounded set in practice; the cap only
            // stops a pathological account from rendering thousands of chips.
            ->limit(self::CALENDAR_EVENT_LIMIT)
            ->get();

        $peopleIds = collect();
        $events = $records->map(function (DealFollowUp $followUp) use ($now, $defaultDuration, &$peopleIds) {
            $duration = $followUp->getEffectiveDuration() ?: $defaultDuration;
            $start = $followUp->next_follow_up_date;
            $end = $start ? $start->copy()->addMinutes($duration) : null;

            $live = $followUp->status === 'scheduled'
                && $start && $start->lessThanOrEqualTo($now)
                && $end && $end->greaterThanOrEqualTo($now);

            $peopleIds = $peopleIds->merge($followUp->participants ?? []);
            if ($followUp->added_by) {
                $peopleIds->push($followUp->added_by);
            }

            return [
                'id' => $followUp->id,
                'start' => $start?->toIso8601String(),
                'duration' => $duration,
                'location' => $followUp->location,
                'status' => $followUp->status,
                'bucket' => $live ? 'live' : (($start && $start->lessThan($now)) ? 'past' : 'upcoming'),
                'title' => $followUp->meetingType?->name,
                'record_name' => $followUp->deal?->name
                    ?? $followUp->lead?->client_name_salutation
                    ?? $followUp->lead?->client_name,
                'added_by_id' => $followUp->added_by,
                'participants' => array_values($followUp->participants ?? []),
            ];
        })->values();

        $people = User::whereIn('id', $peopleIds->filter()->unique()->values())
            ->orderBy('name')
            ->get(['id', 'name', 'image', 'email'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                // image_url falls back to a gravatar placeholder, which would
                // hide the initials the chips are meant to show — so only send
                // a photo when the user actually has one.
                'image' => $user->image ? $user->image_url : null,
            ])
            ->values();

        return [
            'month' => $month->format('Y-m'),
            'events' => $events,
            'people' => $people,
        ];
    }

    /**
     * Return a deal's data sufficient for the SaveFollowup form (participants, watchers).
     * Called via AJAX when user selects a deal in the "Schedule Meeting" drawer.
     */
    public function getDealForScheduling(Deal $deal)
    {
        abort_403(
            $deal->next_follow_up !== 'yes'
            || ! MeetingVisibilityService::schedulableDealsQuery()
                ->where('id', $deal->id)
                ->exists()
        );

        $deal->load([
            'dealParticipants:id,name,image,email',
            'dealWatchers:id,name,image,email',
            'contact:id,client_name',
            'leadStage:id,name,slug,label_color',
            'currency:id,currency_symbol',
            // The agent is the deal's meeting owner — the redesigned schedule
            // dialog seeds the host from it and locks them into participants,
            // the same way the deal page's own dialog does.
            'leadAgent:id,user_id',
            'leadAgent.user:id,name',
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
            ! MeetingVisibilityService::schedulableLeadsQuery()
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
            'success' => true,
            'data' => $lead,
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

        abort_403(! (
            $this->editFollowUpPermission == 'all'
            || ($this->editFollowUpPermission == 'added' && $followUp->added_by == user()->id)
        ));

        $request->validate([
            'next_follow_up_date' => 'required|date_format:d-m-Y',
            'start_time' => 'required|date_format:H:i:s',
            'duration' => 'nullable|integer|min:5|max:480',
            'timezone' => 'nullable|string|max:100',
        ]);

        $browserTimezone = $request->input('timezone', 'UTC');

        $newDateTime = Carbon::createFromFormat(
            'd-m-Y H:i:s',
            $request->next_follow_up_date.' '.$request->start_time,
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

    /**
     * Manually record/confirm whether the client attended a meeting. Tri-state
     * (true/false/null) — this is never inferred automatically, only set by a
     * user after the fact. Same permission rule as reschedule(): the creator,
     * or a user with 'all' edit permission.
     */
    public function confirmAttendance(Request $request, DealFollowUp $followUp)
    {
        $this->editFollowUpPermission = user()->permission('edit_lead_follow_up');

        abort_403(! (
            $this->editFollowUpPermission == 'all'
            || ($this->editFollowUpPermission == 'added' && $followUp->added_by == user()->id)
        ));

        $request->validate([
            'client_attended' => 'present|nullable|boolean',
        ]);

        if ($followUp->next_follow_up_date && $followUp->next_follow_up_date->isFuture()) {
            return response()->json([
                'success' => false,
                'message' => 'Attendance can only be recorded after the meeting time.',
            ], 422);
        }

        // $request->has() is true even for an explicit JSON null, so it can't
        // distinguish "clear it" from "set true/false" — read the raw value instead.
        $value = $request->input('client_attended');
        $followUp->client_attended = $value === null ? null : (bool) $value;
        $followUp->save();

        return response()->json([
            'success' => true,
            'client_attended' => $followUp->client_attended,
            'message' => 'Attendance updated.',
        ]);
    }
}
