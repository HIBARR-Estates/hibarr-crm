<?php

namespace Modules\Performance\Http\Controllers;

use Carbon\Carbon;
use App\Helper\Reply;
use Illuminate\Http\Request;
use App\Models\EmployeeDetails;
use Illuminate\Support\Facades\DB;
use Modules\Performance\Entities\Meeting;
use Modules\Performance\Entities\CheckIn;
use Modules\Performance\Entities\GoalType;
use Modules\Performance\Entities\Objective;
use App\Http\Controllers\AccountBaseController;
use Modules\Performance\Entities\PerformanceSetting;

class DashboardController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'performance::app.dashboard';
        $this->objectiveProgress = 'performance::app.objectiveProgress';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array(PerformanceSetting::MODULE_NAME, $this->user->modules));
            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $this->objectives = Objective::all();
        $this->currentCurrencyId = $this->company->currency_id;

        $this->startDate = (request('startDate') != '') ? Carbon::createFromFormat($this->company->date_format, request('startDate')) : now($this->company->timezone)->subMonths(3);
        $this->endDate = (request('endDate') != '') ? Carbon::createFromFormat($this->company->date_format, request('endDate')) : now($this->company->timezone);

        return view('performance::dashboard.index', $this->data);
    }

    public function objectiveChartData(Request $request)
    {
        $startDate = $request->startDate ? companyToDateString($request->startDate) : now($this->company->timezone)->startOfMonth()->toDateString();
        $endDate = $request->endDate ? companyToDateString($request->endDate) : now($this->company->timezone)->toDateString();

        $objectives = Objective::with(['status', 'goalType', 'keyResults.checkIns' => function ($query) use ($startDate, $endDate) {
                // $query->where('check_in_date', '>=', $startDate)
                //     ->orWhere('check_in_date', '<=', $endDate)
                    // $query->whereDate('check_in_date', '>=', $startDate)
                    //     ->orwhereDate('check_in_date', '<=', $endDate)

                    $startDate = Carbon::parse($startDate)->copy()->addDays(1);
                    $endDate = Carbon::parse($endDate)->copy()->addDays(1);

                    $query->whereBetween('check_in_date', [$startDate, $endDate])
                        ->select('key_result_id', 'objective_percentage', 'check_in_date');
            }])
            ->where(function ($query) use ($startDate, $endDate) {
                $query->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate]);
                // $query->whereBetween('start_date', [$startDate, $endDate])
                    // ->orWhereBetween('end_date', [$startDate, $endDate]);
            })
            ->orderBy('start_date', 'ASC')
            ->get([
                'id', 'title', 'goal_type', 'start_date', 'end_date', 'rotation_date',
                DB::raw('DATE_FORMAT(start_date, "%d-%M-%y") as start_date_formatted'),
                DB::raw('YEAR(start_date) as year, MONTH(start_date) as month'),
                DB::raw('DATE_FORMAT(end_date, "%d-%M-%y") as end_date_formatted')
            ]);

        // Filter objectives based on user access
        $objectives = $objectives->filter(function ($objective) {
            $objective->has_access = !$this->checkManageAccess($objective->id);
            return !$this->checkViewAccess($objective->id);
        });

        /* Objective count start */
        $objectivesForCount = $objectives;
        $statusCounts = $objectivesForCount->groupBy('status.status')->map->count();
        $counts = [
            'total' => $objectivesForCount->count(),
            'onTrack' => $statusCounts->get('onTrack', 0),
            'offTrack' => $statusCounts->get('offTrack', 0),
            'atRisk' => $statusCounts->get('atRisk', 0),
            'completed' => $statusCounts->get('completed', 0),
        ];
        /* Objective count end */

        /* Objective chart start */
        $allCheckInDates = collect();
        $data = [];
        $colors = $this->generateRandomColors(count($objectives));

        foreach ($objectives as $objective) {

            $objectiveCheckIns = $objective->keyResults->flatMap(function ($keyResult) {
                return $keyResult->checkIns->map(fn($checkIn) => [
                    'date' => Carbon::parse($checkIn->check_in_date)->format('Y-m-d H:i'),
                    'percentage' => $checkIn->objective_percentage,
                ]);
            });

            $objectiveCheckIns = $objectiveCheckIns
                ->groupBy('date')
                ->map(fn($group) => $group->sortByDesc('percentage')->last())
                ->sortBy('date');

            $allCheckInDates->push(Carbon::parse($objective->start_date)->format('Y-m-d H:i'));
            $allCheckInDates = $allCheckInDates->merge($objectiveCheckIns->pluck('date'))->unique()->sort()->values();

            $dataPoints = [
                ['x' => Carbon::parse($objective->start_date)->format('Y-m-d H:i'), 'y' => 0]
            ];

            foreach ($objectiveCheckIns as $checkIn) {
                $dataPoints[] = ['x' => $checkIn['date'], 'y' => $checkIn['percentage'] ?? 0];
            }

            $data[] = [
                'name' => str()->limit($objective->title, 12),
                'data' => $dataPoints,
                'start_date' => Carbon::parse($objective->start_date)->format('Y-m-d H:i'),
                'end_date' => Carbon::parse($objective->end_date)->format('Y-m-d H:i'),
            ];
        }

        $this->chartData = $data;
        $this->colors = $colors;
        $this->allDates = $allCheckInDates->values()->all();
        /* Objective chart end */

        /* Check-in data start */
        $checkInstats = [];

        $objectives = Objective::with(['keyResults.checkIns'])
            ->orderByDesc('id');

        if (request()->startDate != 'all' && request()->endDate != '') {
            $startDate = Carbon::createFromFormat($this->company->date_format, request()->startDate)->format('Y-m-d');
            $endDate = Carbon::createFromFormat($this->company->date_format, request()->endDate)->format('Y-m-d');

            $objectives->where(function ($query) use ($startDate, $endDate) {
                return $query->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate]);
            });
        }

        $allObjectives = $objectives->get();

        // Filter objectives based on user access
        $allObjectives = $allObjectives->filter(function ($objective) {
            $objective->has_access = !$this->checkManageAccess($objective->id);
            return !$this->checkViewAccess($objective->id);
        });

        $currentDate = Carbon::now();

        foreach ($allObjectives as $objective) {

            $startDate = Carbon::parse($objective->start_date);
            $endDate = Carbon::parse($objective->end_date);

            // Frequency and schedule logic
            $frequency = $objective->check_in_frequency;
            $schedule = $objective->schedule_on;

            // $pendingCheckIns = 0;
            $totalPendingCheckIns = 0;
            $totalUpcomingCheckIns = 0;

            foreach ($objective->keyResults as $key => $keyResult) {

                $pendingCheckIns = 0;
                $upcomingCheckIns = 0;

                $existingCheckIns = CheckIn::where('key_result_id', $keyResult->id)->pluck('check_in_date')
                    ->map(function ($date) {
                        return Carbon::parse($date)->format('Y-m-d');
                    })->unique()->toArray();

                $checkInDates = [];

                // Generating check-in dates based on the frequency
                switch ($frequency) {
                    case 'daily':
                        // Daily check-ins from start date to end date
                        $checkInDates = $this->generateDailyCheckIns($startDate, $endDate);
                        break;

                    case 'weekly':
                        // Weekly check-ins based on schedule (e.g., every Monday)
                        $checkInDates = $this->generateWeeklyCheckIns($startDate, $endDate, $schedule);
                        break;

                    case 'bi-weekly':
                        // Bi-weekly check-ins based on schedule (e.g., every other Monday)
                        $checkInDates = $this->generateBiWeeklyCheckIns($startDate, $endDate, $schedule);
                        break;

                    case 'monthly':
                        // Monthly check-ins based on rotation date (e.g., 1st, 15th)
                        $checkInDates = $this->generateMonthlyCheckIns($startDate, $endDate, $objective->rotation_date);
                        break;

                    case 'quarterly':
                        // Quarterly check-ins based on rotation date (e.g., month 1, 4, 7, 10)
                        $checkInDates = $this->generateQuarterlyCheckIns($startDate, $endDate, $objective->rotation_date);
                        break;
                }

                // If there are no existing check-ins, we still need to count pending and upcoming check-ins
                if (empty($existingCheckIns)) {

                    // Loop through check-in dates and classify them based on today's date
                    foreach ($checkInDates as $date) {
                        $checkInDate = Carbon::createFromFormat('Y-m-d', $date);

                        if ($checkInDate->isToday() || $checkInDate->lt(Carbon::today())) {
                            $pendingCheckIns++;
                        }
                        else {
                            $upcomingCheckIns++;
                        }
                    }
                }
                else {
                    // Removing existing check-ins from the generated check-in dates
                    // $checkInDates = array_diff($checkInDates, $existingCheckIns);

                    // Step 1: Count the total check-in dates before or on today
                    $totalCheckInDatesTillToday = collect($checkInDates)
                        ->filter(function ($checkInDate) use ($currentDate) {
                            return Carbon::parse($checkInDate)->lte($currentDate);
                        })
                        ->count();

                    // Step 2: Count the existing check-ins before or on today
                    $existingCheckInsTillToday = collect($existingCheckIns)
                        ->filter(function ($existingDate) use ($currentDate) {
                            return Carbon::parse($existingDate)->lte($currentDate);
                        })
                        ->count();

                    // Step 3: Calculate the pending check-ins
                    if ($totalCheckInDatesTillToday > $existingCheckInsTillToday) {
                        $pendingCheckIns = $totalCheckInDatesTillToday - $existingCheckInsTillToday;
                    }

                    // if ($frequency == 'quarterly') {
                    //     dd($keyResult, $checkInDates, $totalCheckInDatesTillToday, $existingCheckInsTillToday, $pendingCheckIns);
                    // }

                    foreach ($checkInDates as $checkInDate) {
                        $checkInDate = Carbon::parse($checkInDate);

                        if ($checkInDate > $currentDate && $checkInDate <= $endDate) {
                            $upcomingCheckIns++;
                        }
                    }
                }

                // Store the results for the key result
                $keyResult->pendingCheckIns = $pendingCheckIns;
                $keyResult->upcomingCheckIns = $upcomingCheckIns;
                $totalPendingCheckIns += $pendingCheckIns;
                $totalUpcomingCheckIns += $upcomingCheckIns;
            }

            // Store statistics for the objective
            $checkInstats[] = [
                'objective_id' => $objective->id,
                'objective_title' => $objective->title,
                'pending' => $totalPendingCheckIns,
                'upcoming' => $totalUpcomingCheckIns,
            ];
        }
         /* Check-in data end */

        /* Meeting data start */
        $query = Meeting::with(['meetingBy', 'meetingFor', 'agendas', 'actions'])
        ->whereHas('meetingBy', function ($query) {
            $query->where('status', 'active');
        })->select('performance_meetings.*');

        if (request()->startDate != 'all' && request()->endDate != '') {
            $startDate = Carbon::createFromFormat($this->company->date_format, request()->startDate)->format('Y-m-d');
            $endDate = Carbon::createFromFormat($this->company->date_format, request()->endDate)->format('Y-m-d');

            $query->where(function ($q) use ($startDate, $endDate) {
                return $q->whereBetween('start_date_time', [$startDate, $endDate])
                    ->orWhereBetween('end_date_time', [$startDate, $endDate]);
            });
        }

        $allEvents = $query->orderBy('start_date_time', 'asc')->get();

        // Filter objectives based on user access
        $meetings = $allEvents->filter(function ($meeting) {
            $meeting->has_access = !$this->checkMeetingManageAccess($meeting->id);
            return !$this->checkMeetingViewAccess($meeting->id);
        })->groupBy(function ($meeting) {
            return $meeting->meetingBy->name;
        });

        // Initialize an array to store the statistics for each group
        $statistics = [];

        foreach ($meetings as $meetingBy => $meetingGroup) {
            $meetingGroup = collect($meetingGroup);

            $totalMeetings = $meetingGroup->count();
            $onTimeMeetings = $meetingGroup->filter(function ($meeting) {
                return $meeting->status == 'completed' && $meeting->end_date_time >= now();
            })->count();
            $delayedMeetings = $meetingGroup->filter(function ($meeting) {
                return $meeting->status == 'pending' && $meeting->start_date_time < now();
            })->count();
            $pendingMeetings = $meetingGroup->filter(function ($meeting) {
                return $meeting->status == 'pending';
            })->count();
            $pendingMeetingIds = $meetingGroup->filter(function ($meeting) {
                return $meeting->status == 'pending';
            })->pluck('id')->toArray();

            // Store the statistics for this meetingBy group
            $statistics[$meetingBy] = [
                'total' => $totalMeetings,
                'onTime' => $onTimeMeetings,
                'delayed' => $delayedMeetings,
                'pending' => $pendingMeetings,
                'pendingIds' => $pendingMeetingIds
            ];
        }

        /* Meeting data end */

        $html = view('performance::dashboard.chart', $this->data)->render();
        $html2 = view('performance::dashboard.counts', $counts)->render();
        $checkinsHtml = view('performance::dashboard.checkins', ['checkInstats' => $checkInstats])->render();
        $meetingsHtml = view('performance::dashboard.meetings', ['meetings' => $meetings, 'statistics' => $statistics])->render();

        return Reply::dataOnly(['status' => 'success', 'html' => $html, 'html2' => $html2, 'checkins' => $checkinsHtml, 'meetings' => $meetingsHtml, 'chartData' => count($this->chartData), 'title' => $this->pageTitle]);
    }

    protected function checkMeetingViewAccess($id)
    {
        $meetingSetting = PerformanceSetting::first();
        $canViewManager = $meetingSetting->view_meeting_manager;
        $canViewParticipant = $meetingSetting->view_meeting_participant;

        $meeting = Meeting::with(['meetingBy', 'meetingFor'])->findOrFail($id);

        $ownerId = $meeting->added_by;
        $participantIds = array($meeting->meeting_for, $meeting->meeting_by);

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->whereIn('user_id', $participantIds)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $viewByRoles = json_decode($meetingSetting->view_meeting_roles, true) ?? [];

        return !(user()->hasRole('admin') || $ownerId == user()->id ||
            ($canViewManager == 1 && in_array(user()->id, $managerIds)) ||
            ($canViewParticipant == 1 && in_array(user()->id, $participantIds)) ||
            (!empty($viewByRoles) && array_intersect($currentUserRoleIds, $viewByRoles)));
    }

    protected function checkMeetingManageAccess($id)
    {
        $meetingSetting = PerformanceSetting::first();
        $canManageManager = $meetingSetting->create_meeting_manager;
        $canManageParticipant = $meetingSetting->create_meeting_participant;

        $meeting = Meeting::with(['meetingBy', 'meetingFor'])->findOrFail($id);

        $ownerId = $meeting->added_by;
        $participantIds = array($meeting->meeting_for, $meeting->meeting_by);

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->whereIn('user_id', $participantIds)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $manageByRoles = json_decode($meetingSetting->create_meeting_roles, true) ?? [];

        return !(user()->hasRole('admin') || $ownerId == user()->id ||
            ($canManageManager == 1 && in_array(user()->id, $managerIds)) ||
            ($canManageParticipant == 1 && in_array(user()->id, $participantIds)) ||
            (!empty($manageByRoles) && array_intersect($currentUserRoleIds, $manageByRoles)));
    }

    protected function checkViewAccess($id)
    {
        $objective = Objective::with('owners')->findOrFail($id);
        $ownerIds = $objective->owners->pluck('id')->toArray();
        $goal = GoalType::find($objective->goal_type);

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->whereIn('user_id', $ownerIds)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $viewByRoles = json_decode($goal->view_by_roles, true) ?? [];

        return !(($goal && $goal->view_by_owner == 1 && in_array(user()->id, $ownerIds)) ||
            ($goal && $goal->view_by_manager == 1 && in_array(user()->id, $managerIds)) ||
            (!empty($viewByRoles) && array_intersect($currentUserRoleIds, $viewByRoles)) ||
            user()->hasRole('admin') || $objective->created_by == user()->id);
    }

    protected function checkManageAccess($id)
    {
        $objective = Objective::with('owners')->findOrFail($id);
        $ownerIds = $objective->owners->pluck('id')->toArray();
        $goal = GoalType::find($objective->goal_type);

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->whereIn('user_id', $ownerIds)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $manageByRoles = json_decode($goal->manage_by_roles, true) ?? [];

        return !(user()->hasRole('admin') ||
            $objective->created_by == user()->id ||
            ($goal && $goal->manage_by_owner == 1 && in_array(user()->id, $ownerIds)) ||
            ($goal && $goal->manage_by_manager == 1 && in_array(user()->id, $managerIds)) ||
            (!empty($manageByRoles) && array_intersect($currentUserRoleIds, $manageByRoles)));
    }

    protected function generateRandomColors($count)
    {
        $colors = [];

        for ($i = 0; $i < $count; $i++) {
            // Generate random HSL values
            // Hue: 0-360, Saturation: 60-90%, Lightness: 45-65%
            $hue = rand(0, 360);
            $saturation = rand(60, 90);
            $lightness = rand(45, 65);

            // Convert HSL to RGB
            $h = $hue / 360;
            $s = $saturation / 100;
            $l = $lightness / 100;

            if ($s == 0) {
                $r = $g = $b = $l;
            }
            else {
                $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
                $p = 2 * $l - $q;

                $r = $this->hue2rgb($p, $q, $h + 1 / 3);
                $g = $this->hue2rgb($p, $q, $h);
                $b = $this->hue2rgb($p, $q, $h - 1 / 3);
            }

            // Convert RGB to hex
            $hex = sprintf("#%02x%02x%02x",
                round($r * 255),
                round($g * 255),
                round($b * 255)
            );

            $colors[] = $hex;
        }

        return $colors;
    }

    protected function hue2rgb($p, $q, $t)
    {
        if ($t < 0) {
            $t += 1;
        }

        if ($t > 1) {
            $t -= 1;
        }

        if ($t < 1 / 6) {
            return $p + ($q - $p) * 6 * $t;
        }

        if ($t < 1 / 2) {
            return $q;
        }

        if ($t < 2 / 3) {
            return $p + ($q - $p) * (2/3 - $t) * 6;
        }

        return $p;
    }

    // Helper Functions to generate check-in dates
    private function generateDailyCheckIns($startDate, $endDate)
    {
        $checkInDates = [];
        $currentDate = $startDate->copy();

        while ($currentDate <= $endDate) {
            $checkInDates[] = $currentDate->format('Y-m-d');
            $currentDate->addDay();
        }

        return $checkInDates;
    }

    private function generateWeeklyCheckIns($startDate, $endDate, $schedule)
    {
        $checkInDates = [];
        $dayOfWeek = $this->getDayOfWeekFromSchedule($schedule);
        $currentDate = $startDate->copy()->next($dayOfWeek);

        while ($currentDate <= $endDate) {
            $checkInDates[] = $currentDate->format('Y-m-d');
            $currentDate->addWeek();
        }

        return $checkInDates;
    }

    private function generateBiWeeklyCheckIns($startDate, $endDate, $schedule)
    {
        $checkInDates = [];
        $dayOfWeek = $this->getDayOfWeekFromSchedule($schedule);
        $currentDate = $startDate->copy()->next($dayOfWeek);

        while ($currentDate <= $endDate) {
            $checkInDates[] = $currentDate->format('Y-m-d');
            $currentDate->addWeeks(2);
        }

        return $checkInDates;
    }

    private function generateMonthlyCheckIns($startDate, $endDate, $rotationDate)
    {
        $checkinDates = [];
        // Start with the first month
        $currentDate = $startDate->copy();

        // Set to the rotation date in the first month (or last day if rotation date exceeds month length)
        $currentDate->day(min($rotationDate, $currentDate->daysInMonth));

        // If the adjusted current date is before the start date, move to next month
        if ($currentDate->lt($startDate)) {
            $currentDate->addMonthNoOverflow();
            $currentDate->day(min($rotationDate, $currentDate->daysInMonth));
        }

        // Loop until we exceed the end date
        while ($currentDate->lte($endDate)) {
            $checkinDates[] = $currentDate->format('Y-m-d');

            // Move to the first day of the next month
            $currentDate->addMonthNoOverflow();
            $currentDate->day(1);

            // Then set to the rotation date (or last day if rotation date exceeds month length)
            $currentDate->day(min($rotationDate, $currentDate->daysInMonth));
        }

        return $checkinDates;
    }

    private function generateQuarterlyCheckIns($startDate, $endDate, $rotationDate)
    {
        $checkinDates = [];
        // Start with the first quarter
        $currentDate = $startDate->copy();

        // Set to the rotation date in the first quarter (or last day if rotation date exceeds month length)
        $currentDate->day(min($rotationDate, $currentDate->daysInMonth));

        // If the adjusted current date is before the start date, move to next quarter
        if ($currentDate->lt($startDate)) {
            $currentDate->addMonthsNoOverflow(3);
            $currentDate->day(min($rotationDate, $currentDate->daysInMonth));
        }

        // Skip first date if it's in the same month as start date
        if ($currentDate->format('Y-m') != $startDate->format('Y-m')) {
            // Loop until we exceed the end date
            while ($currentDate->lte($endDate)) {
                $checkinDates[] = $currentDate->format('Y-m-d');

                // Move to the first day of the next quarter (3 months later)
                $currentDate->addMonthsNoOverflow(3);
                $currentDate->day(1);

                // Then set to the rotation date (or last day if rotation date exceeds month length)
                $currentDate->day(min($rotationDate, $currentDate->daysInMonth));
            }
        }
        else {
            // Skip the first date and start with the next quarter
            $currentDate->addMonthsNoOverflow(3);
            $currentDate->day(1);
            $currentDate->day(min($rotationDate, $currentDate->daysInMonth));

            // Loop until we exceed the end date
            while ($currentDate->lte($endDate)) {
                $checkinDates[] = $currentDate->format('Y-m-d');

                // Move to the first day of the next quarter (3 months later)
                $currentDate->addMonthsNoOverflow(3);
                $currentDate->day(1);

                // Then set to the rotation date (or last day if rotation date exceeds month length)
                $currentDate->day(min($rotationDate, $currentDate->daysInMonth));
            }
        }

        return $checkinDates;
    }

    private function getDayOfWeekFromSchedule($schedule)
    {
        $daysOfWeek = [
            'sunday' => Carbon::SUNDAY,
            'monday' => Carbon::MONDAY,
            'tuesday' => Carbon::TUESDAY,
            'wednesday' => Carbon::WEDNESDAY,
            'thursday' => Carbon::THURSDAY,
            'friday' => Carbon::FRIDAY,
            'saturday' => Carbon::SATURDAY,
        ];

        $dayName = str_replace('every-', '', strtolower($schedule));

        return $daysOfWeek[$dayName] ?? Carbon::MONDAY;
    }

}
