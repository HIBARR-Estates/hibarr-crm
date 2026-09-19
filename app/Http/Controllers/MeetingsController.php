<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\MeetingSavedView;
use App\Models\MeetingSummary;
use App\Models\MeetingType;
use App\Models\User;
use App\Services\CalendarSyncDispatcher;
use App\Services\CalendarSyncService;
use App\Services\MeetingFilterFacetsService;
use App\Services\MeetingVisibilityService;
use App\Services\Reminders\MeetingReminderSync;
use App\Support\FeatureFlags;
use App\Support\UserTimezone;
use Carbon\Carbon;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class MeetingsController extends AccountBaseController
{
    /** Redesigned Meetings index (tab-driven list + month calendar). */
    private const REDESIGN_FLAG = 'crm.meetings-page-redesign';

    /**
     * Filter tabs the redesigned list accepts.
     *
     * No 'live' tab: a live meeting is called out in the strip, so a
     * tab that normally reads zero would only be a worse second route to it.
     * Upcoming is strictly not-yet-started; live meetings belong in Past
     * (start has passed) and on the strip while they are running.
     */
    private const TABS = ['all', 'upcoming', 'past'];

    /** Hard ceiling on chips the calendar month query will return. */
    private const CALENDAR_EVENT_LIMIT = 500;

    /**
     * How many "next up" cards the strip above the list can hold. Three is
     * what fits one row at the widest layout; narrower screens show fewer by
     * dropping columns, not by asking for less.
     */
    private const UPCOMING_SOON_LIMIT = 3;

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
            // Never previously loaded — every "Meeting host" chip fell back
            // to "User #<id>" because `host_id` came through as a bare id
            // with no relation attached to resolve it from.
            'host:id,name,image',
            'meetingType',
            'meetingSummary',
        ];

        $defaultDuration = DealFollowUp::DEFAULT_DURATION_MINUTES;

        // A meeting is "live" when it has started but not yet ended:
        //   next_follow_up_date <= now AND next_follow_up_date + duration > now AND status = 'scheduled'
        // The strip can still call those out; Upcoming itself does not.
        $scopeLive = function ($query) use ($now, $defaultDuration) {
            $query->where('status', 'scheduled')
                ->where('next_follow_up_date', '<=', $now)
                ->whereRaw(
                    'DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) >= ?',
                    [$defaultDuration, $now]
                );
        };

        $scopeUpcoming = function ($query) use ($now) {
            // Start is still ahead of the clock. A meeting that has already
            // begun is live (strip) or past (list), not upcoming.
            $query->where('next_follow_up_date', '>', $now);
        };

        // Past only after the end (start + duration), or when no longer
        // scheduled. Live meetings (started, not yet ended) must not land here.
        $scopePast = function ($query) use ($now, $defaultDuration) {
            $query->where(function ($inner) use ($now, $defaultDuration) {
                $inner->where('status', '!=', 'scheduled')
                    ->orWhereRaw(
                        'DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) < ?',
                        [$defaultDuration, $now]
                    );
            });
        };

        // ── Shared list filters ────────────────────────────────────────
        // Same contract as the lead/deal/task lists: the filter modal writes
        // these query params, and a deep link (the dashboard's "N missed"
        // badge) writes the same ones, so a filter set either way behaves
        // identically. Everything is applied to the tab tallies as well —
        // a tab whose count disagreed with the list it opens is worse than
        // no count at all.
        $csv = function ($value): array {
            if (is_array($value)) {
                return array_values(array_filter($value, 'strlen'));
            }

            return is_string($value) && $value !== ''
                ? array_values(array_filter(explode(',', $value), 'strlen'))
                : [];
        };

        // Scalar Y-m-d only — Carbon::parse() on an array or garbage string
        // throws, and a malformed link shouldn't 500 the page.
        $isValidDate = function ($value): bool {
            if (! is_string($value)) {
                return false;
            }

            $parsed = \DateTime::createFromFormat('Y-m-d', $value);

            return $parsed !== false && $parsed->format('Y-m-d') === $value;
        };

        $search = is_string($request->get('search')) ? trim($request->get('search')) : '';
        $meetingTypeIds = $csv($request->get('meeting_type_id'));
        $statuses = array_values(array_intersect(
            $csv($request->get('status')),
            ['scheduled', 'completed', 'cancelled']
        ));
        $locations = $csv($request->get('location'));
        $hostIds = $csv($request->get('host_id'));
        $attendanceValues = array_values(array_intersect(
            $csv($request->get('attendance')),
            ['attended', 'no_show']
        ));
        $recordType = in_array($request->get('record_type'), ['deal', 'lead'], true)
            ? $request->get('record_type')
            : null;
        $dateFrom = $isValidDate($request->get('date_from')) ? $request->get('date_from') : null;
        $dateTo = $isValidDate($request->get('date_to')) ? $request->get('date_to') : null;

        // Kept as its own closure because the legacy branch below narrows by
        // date alone; the redesign uses the full set.
        $applyDateWindow = function ($query) use ($dateFrom, $dateTo) {
            return $query
                ->when($dateFrom, fn ($q) => $q->where('next_follow_up_date', '>=', $dateFrom))
                ->when($dateTo, fn ($q) => $q->where('next_follow_up_date', '<=', Carbon::parse($dateTo)->endOfDay()));
        };

        // Split out from the date window so the calendar can apply every
        // other filter without the date range too — calendarPayload() has
        // its own window (the month itself) and must not additionally be
        // narrowed by whatever "Meeting date" range the filter modal has set,
        // or a month view could quietly come back missing meetings the list
        // beside it still shows.
        $applyNonDateFilters = function ($query) use (
            $search,
            $meetingTypeIds,
            $statuses,
            $locations,
            $hostIds,
            $attendanceValues,
            $recordType
        ) {
            return $query
                ->when($meetingTypeIds, fn ($q) => $q->whereIn('meeting_type_id', $meetingTypeIds))
                ->when($statuses, fn ($q) => $q->whereIn('status', $statuses))
                ->when($locations, fn ($q) => $q->whereIn('location', $locations))
                ->when($attendanceValues, fn ($q) => $q->whereIn('attendance_outcome', $attendanceValues))
                // "Host" reads as whoever owns the meeting: the named host
                // where one is set, otherwise the person who booked it.
                ->when($hostIds, fn ($q) => $q->where(function ($inner) use ($hostIds) {
                    $inner->whereIn('host_id', $hostIds)
                        ->orWhere(function ($fallback) use ($hostIds) {
                            $fallback->whereNull('host_id')->whereIn('added_by', $hostIds);
                        });
                }))
                ->when($recordType === 'deal', fn ($q) => $q->whereNotNull('deal_id'))
                ->when($recordType === 'lead', fn ($q) => $q->whereNull('deal_id')->whereNotNull('lead_id'))
                ->when($search !== '', fn ($q) => $q->where(function ($inner) use ($search) {
                    $like = '%'.$search.'%';
                    $inner->where('remark', 'like', $like)
                        ->orWhereHas('deal', fn ($deal) => $deal->where('name', 'like', $like))
                        ->orWhereHas('lead', fn ($lead) => $lead->where('client_name', 'like', $like)
                            ->orWhere('company_name', 'like', $like))
                        ->orWhereHas('meetingType', fn ($type) => $type->where('name', 'like', $like));
                }));
        };

        $applyFilters = function ($query) use ($applyDateWindow, $applyNonDateFilters) {
            $applyDateWindow($query);

            return $applyNonDateFilters($query);
        };

        // Ids the "next up" cards will claim, so the list below can leave
        // them out — a meeting belongs on the page once.
        //
        // The tab tallies deliberately do NOT exclude them: a badge reading
        // "Upcoming 4" answers how many upcoming meetings you have, not how
        // many rows the table happens to be drawing. Moving one into a card
        // must not make it look like the meeting went away.
        //
        // The strip can be hidden, and that is a browser-side preference the
        // list query depends on, so it rides along in a cookie the same way
        // the page size does. Hidden means no exclusions at all.
        $nextUpIds = $redesign && $request->cookie('hibarr_meetings_next_up', '1') !== '0'
            ? $this->upcomingSoonIds($userId, $scopeLive, $now)
            : [];

        // ── Overview stats ─────────────────────────────────────────────
        $weekStart = Carbon::now('UTC')->startOfWeek();
        $weekEnd = Carbon::now('UTC')->endOfWeek();

        // One pass with conditional sums instead of four trips over the same
        // table. The live count used to pull every past-dated scheduled meeting
        // into memory to filter in PHP — unbounded, and growing with history.
        // The end-time expression matches the one the Upcoming/Past queries below use.
        // The last three sums are the redesign's tab tallies; they restate the
        // scopes above in SQL so a tab counts exactly the meetings that tab is
        // about — including any the "next up" cards have lifted out of the
        // table, which are still yours and still upcoming.
        $liveSql = "status = 'scheduled'"
            .' AND next_follow_up_date <= ?'
            .' AND DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) >= ?';
        // Mirror $scopePast: ended (start+duration < now) or no longer scheduled.
        // Live meetings must not inflate the Past tab count.
        $pastSql = "status != 'scheduled'"
            .' OR DATE_ADD(next_follow_up_date, INTERVAL COALESCE(duration, ?) MINUTE) < ?';

        $counts = $applyFilters(
            MeetingVisibilityService::scopeVisibleToUser(DealFollowUp::query(), $userId)
        )
            ->selectRaw(
                'COUNT(*) as total,'
                .' SUM(next_follow_up_date > ?) as upcoming,'
                .' SUM(next_follow_up_date BETWEEN ? AND ?) as this_week,'
                ." SUM($liveSql) as live,"
                ." SUM(status = 'completed') as completed,"
                .' SUM(next_follow_up_date > ?) as upcoming_tab,'
                ." SUM($pastSql) as past_tab",
                [
                    $now, $weekStart, $weekEnd,
                    $now, $defaultDuration, $now,
                    $now,
                    $defaultDuration, $now,
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
            'past' => (int) ($counts->past_tab ?? 0),
        ];

        // An attendance deep link is about meetings that already happened, so
        // it also picks the tab the page lands on.
        $attendanceFilter = $attendanceValues[0] ?? null;

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

            // The page sizes itself to the browser window, and leaves the
            // size it settled on in a cookie. Reading it here means a cold
            // load already arrives at the right length instead of always
            // spending a second request to correct a guessed default.
            $hinted = (int) $request->cookie('hibarr_meetings_per_page_hint', 0);
            $default = $hinted > 0 ? $hinted : 9;

            $perPage = max(3, min(60, (int) $request->get('per_page', $default)));

            $listQuery = MeetingVisibilityService::scopeVisibleToUser(
                DealFollowUp::with($eagerLoads),
                $userId
            )->when($nextUpIds, fn ($q) => $q->whereNotIn('id', $nextUpIds));

            // Upcoming reads forwards (soonest first); Past and All read
            // backwards (most recent first).
            $ascending = $activeTab === 'upcoming';

            if ($activeTab === 'past') {
                $listQuery->where($scopePast);
            } elseif ($activeTab === 'upcoming') {
                $listQuery->where($scopeUpcoming);
            }
            // 'all' takes every bucket — no extra scope.

            $meetings = $applyFilters($listQuery)
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

        foreach ($paginators as $paginator) {
            DealFollowUp::attachParticipantUsers($paginator->getCollection());
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

            // Separates "you have never booked a meeting" from "you have no
            // meetings *left*", which read very differently on an empty list.
            // Only costs a query when the list came back empty; a non-empty
            // page has already answered the question.
            $props['hasAnyMeetings'] = $meetings->total() > 0
                || MeetingVisibilityService::scopeVisibleToUser(
                    DealFollowUp::query(),
                    $userId
                )->exists();

            // Filter-modal chrome. All three are deferred: the modal is closed
            // on first paint, the facet counts are several GROUP BY queries,
            // and none of it is needed to render the list.
            $props['filterPeople'] = Inertia::defer(fn () => $this->filterPeople($userId));
            $props['filterFacets'] = Inertia::defer(
                fn () => app(MeetingFilterFacetsService::class)->facets($userId)
            );
            $props['savedViews'] = Inertia::defer(fn () => $this->savedViewsForUser($userId));

            // The "next up" cards above the list. Deliberately NOT filtered
            // and not tab-scoped: the strip answers "what is next for me",
            // which is a constant. Scoping it to the list's filters would
            // empty it the moment someone looked at Past meetings, which is
            // exactly when knowing what is next is most useful.
            $props['upcomingSoon'] = Inertia::defer(
                fn () => $this->upcomingSoon($nextUpIds, $eagerLoads)
            );

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
                    fn () => $this->calendarPayload($calendarMonth, $userId, $now, $defaultDuration, $applyNonDateFilters)
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
        // The month group is bounded to 01-12 here rather than left to
        // Carbon/DateTime::createFromFormat, which silently rolls an
        // out-of-range month over (2026-13 becomes January 2027) instead of
        // failing — a malformed link would otherwise land on a real but
        // wrong month rather than falling back to the current one below.
        if (is_string($value) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $value)) {
            $parsed = Carbon::createFromFormat('Y-m-d', $value.'-01', 'UTC');

            if ($parsed !== false) {
                return $parsed->startOfMonth();
            }
        }

        return Carbon::now('UTC')->startOfMonth();
    }

    /**
     * Month of meetings for the calendar view. The window is padded by a day
     * on each side because cells are placed by the *viewer's* local date,
     * which can pull a boundary meeting into the neighbouring month.
     */
    private function calendarPayload(
        Carbon $month,
        int $userId,
        Carbon $now,
        int $defaultDuration,
        ?callable $applyNonDateFilters = null
    ): array {
        $windowStart = $month->copy()->startOfMonth()->subDay();
        $windowEnd = $month->copy()->endOfMonth()->addDay();

        $query = MeetingVisibilityService::scopeVisibleToUser(
            DealFollowUp::with([
                'deal:id,name',
                'lead:id,client_name,salutation,company_name',
                'meetingType:id,name',
            ]),
            $userId
        );

        // The month grid shows the same filtered set as the list — switching
        // to the calendar with a filter on must not quietly widen it. The
        // date window is the one exception: the month itself is the window,
        // so the caller passes the non-date filters only.
        if ($applyNonDateFilters) {
            $applyNonDateFilters($query);
        }

        $records = $query
            ->whereBetween('next_follow_up_date', [$windowStart, $windowEnd])
            ->orderBy('next_follow_up_date', 'asc')
            // A month of meetings is a bounded set in practice; the cap only
            // stops a pathological account from rendering thousands of chips.
            ->limit(self::CALENDAR_EVENT_LIMIT)
            ->get();

        // Names for the hover card. One lookup for every person on the month's
        // meetings, rather than a relation load per row.
        $nameIds = $records->flatMap(fn (DealFollowUp $followUp) => array_filter(array_merge(
            $followUp->participants ?? [],
            [$followUp->host_id, $followUp->added_by]
        )))->unique()->values();

        $names = User::whereIn('id', $nameIds)->pluck('name', 'id');

        $events = $records->map(function (DealFollowUp $followUp) use ($now, $defaultDuration, $names) {
            $duration = $followUp->getEffectiveDuration() ?: $defaultDuration;
            $start = $followUp->next_follow_up_date;
            $end = $start ? $start->copy()->addMinutes($duration) : null;

            $live = $followUp->status === 'scheduled'
                && $start && $start->lessThanOrEqualTo($now)
                && $end && $end->greaterThanOrEqualTo($now);

            return [
                'id' => $followUp->id,
                'start' => $start?->toIso8601String(),
                'timezone' => $followUp->timezone,
                'duration' => $duration,
                'location' => $followUp->location,
                'status' => $followUp->status,
                'bucket' => $live ? 'live' : (($start && $start->lessThan($now)) ? 'past' : 'upcoming'),
                'title' => $followUp->meetingType?->name,
                'record_name' => $followUp->deal?->name
                    ?? $followUp->lead?->client_name_salutation
                    ?? $followUp->lead?->client_name,
                'participants' => array_values($followUp->participants ?? []),
                // Everything below is for the hover card, which is the only
                // place a chip's detail can be read without opening it.
                'record_type' => $followUp->deal_id ? 'deal' : ($followUp->lead_id ? 'lead' : null),
                'host_name' => $names[$followUp->host_id ?? $followUp->added_by] ?? null,
                'participant_names' => collect($followUp->participants ?? [])
                    ->map(fn ($id) => $names[$id] ?? null)
                    ->filter()
                    ->values()
                    ->all(),
                'has_link' => filled($followUp->meeting_link),
                'agenda' => $followUp->remark
                    ? Str::limit(strip_tags($followUp->remark), 160)
                    : null,
                'attendance' => $followUp->client_attended === null
                    ? null
                    : ($followUp->client_attended ? 'attended' : 'no_show'),
            ];
        })->values();

        return [
            'month' => $month->format('Y-m'),
            'events' => $events,
        ];
    }

    /**
     * File a follow-up report against a meeting that has taken place.
     *
     * The report is written as the meeting's `MeetingSummary` — the same
     * record the AI summariser writes to — so a meeting has exactly one
     * "what happened", whoever produced it, and the detail dialog's Summary
     * tab renders both without knowing the difference. Re-filing a report
     * overwrites the previous one rather than accumulating orphan rows.
     */
    public function report(Request $request, DealFollowUp $followUp)
    {
        abort_403(! (
            $this->editFollowUpPermission == 'all'
            || ($this->editFollowUpPermission == 'added' && $followUp->added_by == user()->id)
        ));

        // Visible on the list is the bar for writing to it, same as show().
        abort_403(! MeetingVisibilityService::scopeVisibleToUser(
            DealFollowUp::query()->whereKey($followUp->getKey()),
            user()->id
        )->exists());

        $validated = $request->validate([
            'discussed' => 'required|string|max:5000',
            'outcome' => 'nullable|string|max:5000',
            'next_steps' => 'nullable|string|max:5000',
            'client_attended' => 'present|nullable|boolean',
            'mark_completed' => 'boolean',
        ]);

        if ($followUp->next_follow_up_date && $followUp->next_follow_up_date->isFuture()) {
            return response()->json([
                'success' => false,
                'message' => 'A meeting can only be reported on once it has started.',
            ], 422);
        }

        // Only the answered prompts are stored: the Summary tab renders the
        // object key by key, so an empty "Next steps" would otherwise show as
        // a heading with nothing under it.
        $summaryObject = array_filter([
            'discussed' => trim($validated['discussed']),
            'outcome' => trim($validated['outcome'] ?? ''),
            'next_steps' => trim($validated['next_steps'] ?? ''),
        ], 'strlen');

        DB::transaction(function () use ($followUp, $summaryObject, $validated) {
            $summary = $followUp->meetingSummary;

            if ($summary) {
                $summary->update([
                    'summary_object' => $summaryObject,
                    'meeting_type_id' => $followUp->meeting_type_id,
                ]);
            } else {
                $summary = MeetingSummary::create([
                    'summary_object' => $summaryObject,
                    'meeting_type_id' => $followUp->meeting_type_id,
                    // Nullable: a meeting booked against a lead alone has no
                    // deal to hang the summary off, and still gets a report.
                    'deal_id' => $followUp->deal_id,
                ]);
                $followUp->summary_id = $summary->id;
            }

            $attended = $validated['client_attended'];
            $followUp->client_attended = $attended === null ? null : (bool) $attended;

            if (($validated['mark_completed'] ?? false) && $followUp->status !== 'cancelled') {
                $followUp->status = 'completed';
            }

            $followUp->last_updated_by = user()->id;
            $followUp->save();
        });

        return response()->json([
            'success' => true,
            'message' => __('messages.updateSuccess'),
        ]);
    }

    /**
     * The signed-in user's own Zoho Calendar events for a month, shaped like
     * the rows `/account/my-calendar` returns.
     *
     * Matching that shape is the point: the meetings calendar already renders
     * an overlay of the viewer's other commitments, so Zoho events join it as
     * one more type rather than as a second parallel rendering path.
     *
     * A failure here answers with an empty list, not an error. The month grid
     * is useful without the overlay, and an unreachable third-party calendar
     * must not blank a page whose subject is the CRM's own meetings.
     */
    public function zohoEvents(Request $request, CalendarSyncService $syncService)
    {
        if (! FeatureFlags::enabled('integrations.zoho-calendar-sync')) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $month = $this->resolveCalendarMonth($request->get('month'));

        // Padded a day either side for the same reason the meeting query is:
        // cells are placed by the viewer's local date, which can pull a
        // boundary event into the neighbouring month.
        $rows = $syncService->listUserEvents(
            (int) user()->id,
            $month->copy()->startOfMonth()->subDay(),
            $month->copy()->endOfMonth()->addDay(),
        );

        if ($rows === null) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $events = collect($rows)
            ->map(function (array $row) {
                // The contract carries times in two places: a flat
                // `start`/`end` pair and a `dateandtime` object. Prefer the
                // latter when present, since it is the one that names a zone.
                $start = $row['dateandtime']['start'] ?? $row['start'] ?? null;
                $end = $row['dateandtime']['end'] ?? $row['end'] ?? null;

                if (! $start) {
                    return null;
                }

                return [
                    'id' => $row['uid'] ?? null,
                    'title' => $row['title'] ?? null,
                    'start' => $start,
                    'end' => $end,
                    'event_type' => 'zoho',
                    'extendedProps' => [
                        'bg_color' => '#e04c3e',
                        'name' => $row['organizer'] ?? null,
                    ],
                ];
            })
            ->filter()
            ->values()
            ->all();

        return response()->json(['success' => true, 'data' => $events]);
    }

    /**
     * The viewer's saved meeting filter views, plus anything shared with the
     * team. Shape matches the lead/task presenters, because one frontend
     * component renders all three.
     *
     * @return array<int, array<string, mixed>>
     */
    private function savedViewsForUser(int $userId): array
    {
        return MeetingSavedView::query()
            ->visibleTo($userId)
            ->with('owner:id,name')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (MeetingSavedView $view) => [
                'id' => $view->id,
                'name' => $view->name,
                'filters' => $view->filters,
                'visibility' => $view->visibility,
                'pinned' => $view->pinned,
                'is_owner' => (int) $view->user_id === $userId,
                'owner_name' => $view->owner?->name,
                'updated_at' => $view->updated_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * Ids of the viewer's next few meetings, soonest first — what the cards
     * above the list will show, and therefore what the list leaves out.
     *
     * Deliberately unfiltered and not tab-scoped: the strip answers "what is
     * next for me", which is a constant. Scoping it to the list's filters
     * would empty it the moment someone looked at Past meetings, which is
     * exactly when knowing what is next is most useful.
     *
     * Live meetings are included so the strip can call them out, but they
     * must not consume the "next up" slots: an in-progress meeting is
     * happening now, not next. The limit applies only to meetings that
     * have not started yet.
     *
     * @return array<int, int>
     */
    private function upcomingSoonIds(int $userId, callable $scopeLive, Carbon $now): array
    {
        $visible = function () use ($userId) {
            return MeetingVisibilityService::scopeVisibleToUser(
                DealFollowUp::query(),
                $userId
            )->where('status', '!=', 'cancelled');
        };

        $liveIds = $visible()
            ->where($scopeLive)
            ->orderBy('next_follow_up_date', 'asc')
            ->pluck('id')
            ->all();

        $futureIds = $visible()
            ->where('next_follow_up_date', '>', $now)
            ->orderBy('next_follow_up_date', 'asc')
            ->limit(self::UPCOMING_SOON_LIMIT)
            ->pluck('id')
            ->all();

        return array_values(array_unique([...$liveIds, ...$futureIds]));
    }

    /**
     * The cards themselves, for ids `upcomingSoonIds()` already settled on.
     *
     * Loading by id rather than re-running the window query is what keeps the
     * strip and the list in agreement: the list excluded exactly these rows,
     * so re-deriving them here could only introduce a disagreement.
     *
     * @param  array<int, int>  $ids
     * @param  array<int, string>  $eagerLoads
     * @return array<int, \App\Models\DealFollowUp>
     */
    private function upcomingSoon(array $ids, array $eagerLoads): array
    {
        if ($ids === []) {
            return [];
        }

        $records = DealFollowUp::with($eagerLoads)
            ->whereIn('id', $ids)
            ->orderBy('next_follow_up_date', 'asc')
            ->get();

        DealFollowUp::attachParticipantUsers($records);

        return $records->values()->all();
    }

    /**
     * People who appear on the viewer's visible meetings, as the named host
     * or as the person who booked it — the options for the host filter.
     *
     * Drawn from the meetings themselves rather than from the whole user
     * table, so the filter can't offer a name that would return nothing.
     */
    private function filterPeople(int $userId): array
    {
        $ids = MeetingVisibilityService::scopeVisibleToUser(DealFollowUp::query(), $userId)
            ->selectRaw('COALESCE(host_id, added_by) as person_id')
            ->distinct()
            ->pluck('person_id')
            ->filter()
            ->values();

        return User::whereIn('id', $ids)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name])
            ->values()
            ->toArray();
    }

    /**
     * One meeting, shaped exactly like a row of the index list.
     *
     * The calendar carries only enough per chip to draw it (time, location,
     * record name); opening one has to show the full meeting, and it may not
     * be on the list page currently loaded. Fetching it by id keeps that a
     * single small request instead of pulling the whole list back.
     */
    public function show(DealFollowUp $followUp)
    {
        abort_403($this->viewFollowUpPermission === 'none');

        // Visibility is the list's own rule, restated for one record — a
        // meeting you can't see on the index must not be readable by id.
        $visible = MeetingVisibilityService::scopeVisibleToUser(
            DealFollowUp::query()->whereKey($followUp->getKey()),
            user()->id
        )->exists();

        abort_403(! $visible);

        $followUp->load([
            'deal:id,name,agent_id,value,currency_id,pipeline_stage_id',
            'deal.leadStage:id,name,slug,label_color',
            'deal.contact:id,client_name',
            'deal.currency:id,currency_symbol',
            'lead:id,client_name,salutation,company_name',
            'addedBy:id,name,image',
            'host:id,name,image',
            'meetingType',
            'meetingSummary',
        ]);

        DealFollowUp::attachParticipantUsers(collect([$followUp]));

        return response()->json([
            'success' => true,
            'data' => $followUp,
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
            'timezone' => [
                'nullable',
                'string',
                Rule::in(DateTimeZone::listIdentifiers()),
            ],
        ]);

        $newDateTime = UserTimezone::interpretWallClock(
            user(),
            company(),
            $request->next_follow_up_date.' '.$request->start_time,
            'd-m-Y H:i:s',
            $request->timezone
        );

        $followUp->next_follow_up_date = $newDateTime;
        $followUp->status = 'scheduled';

        if ($request->has('duration')) {
            $followUp->duration = $request->duration;
        }

        $followUp->save();

        app(CalendarSyncDispatcher::class)->scheduleSync($followUp->fresh());

        app(MeetingReminderSync::class)->syncFromFollowUp($followUp);

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
