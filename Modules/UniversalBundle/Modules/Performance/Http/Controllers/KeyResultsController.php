<?php

namespace Modules\Performance\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\EmployeeDetails;
use Carbon\Carbon;
use Modules\Performance\Entities\GoalType;
use Modules\Performance\Entities\KeyResults;
use Modules\Performance\Entities\KeyResultsMetrics;
use Modules\Performance\Entities\Objective;
use Modules\Performance\Entities\ObjectiveOwner;
use Modules\Performance\Entities\PerformanceSetting;
use Modules\Performance\Events\CheckInReminderEvent;
use Modules\Performance\Http\Requests\CreateKeyResultsRequest;
use Modules\Performance\Notifications\CheckInReminderNotification;

class KeyResultsController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'performance::app.keyResults';

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
        abort(404);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $this->pageTitle = __('performance::app.addKeyResults');
        $objectiveId = request()->objectiveId;
        $this->objectiveId  = [];

        if ($objectiveId) {
            $this->objectiveId = Objective::findOrFail($objectiveId);
        }

        $this->metrics = KeyResultsMetrics::all();
        $this->objectives = Objective::all();

        $this->meetingId = request()->meetingId;

        $this->currentUrl = ($this->meetingId && $this->meetingId != 'null' && $this->meetingId != null)
            ? route('meetings.show', ['meeting' => $this->meetingId]) . '?view=action'
            : (request()->currentUrl ?: route('objectives.index'));

        if (request()->ajax()) {
            $html = view('performance::key-results.ajax.create', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'performance::key-results.ajax.create';

        return view('performance::key-results.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(CreateKeyResultsRequest $request)
    {
        $keyResult = new KeyResults();
        $keyResult->objective_id = $request->objective_id;
        $keyResult->title = $request->title;
        $keyResult->description = $request->description;
        $keyResult->metrics_id = $request->metrics_id;
        $keyResult->target_value = $request->target_value;
        $keyResult->current_value = $request->current_value;
        $keyResult->original_current_value = $request->current_value;

        if ($request->current_value != 0 && $request->target_value != 0 && $request->current_value == $request->target_value) {
            $percentage = round(($request->current_value / $request->target_value) * 100, 2);
            $keyResult->key_percentage = $percentage;

        }
        else {
            $keyResult->key_percentage = 0.00;
        }

        // next_check_in
        $objective = Objective::findOrFail($request->objective_id);
        $nextCheckIn = $this->checkFrequency($objective);
        $keyResult->next_check_in = $nextCheckIn->format('Y-m-d');
        $keyResult->save();

        return Reply::successWithData(__('messages.recordSaved'), ['redirectUrl' => $request->currentUrl]);
    }

    /**
     * Show the specified resource.
     */
    public function show($id)
    {
        $this->pageTitle = __('performance::app.keyResult');
        $this->view = 'performance::key-results.ajax.show';
        $this->keyResult = KeyResults::findOrFail($id);
        $this->managePermission = $this->checkManageAccess($this->keyResult->objective_id);

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('performance::key-results.create', $this->data);
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

        return (user()->hasRole('admin') ||
            $objective->created_by == user()->id ||
            ($goal && $goal->manage_by_owner == 1 && in_array(user()->id, $ownerIds)) ||
            ($goal && $goal->manage_by_manager == 1 && in_array(user()->id, $managerIds)) ||
            (!empty($manageByRoles) && array_intersect($currentUserRoleIds, $manageByRoles)));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $this->pageTitle = __('performance::app.editKeyResults');

        $this->metrics = KeyResultsMetrics::all();
        $this->keyResult = KeyResults::findOrFail($id);
        $this->objectives = Objective::all();
        $this->currentUrl = request()->currentUrl ? request()->currentUrl : route('objectives.index');

        if (request()->ajax()) {
            $html = view('performance::key-results.ajax.edit', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'performance::key-results.ajax.edit';

        return view('performance::key-results.create', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(CreateKeyResultsRequest $request, $id)
    {
        $keyResult = KeyResults::findOrFail($id);
        $keyResult->objective_id = $request->objective_id;
        $keyResult->title = $request->title;
        $keyResult->description = $request->description;
        $keyResult->metrics_id = $request->metrics_id;
        $keyResult->target_value = $request->target_value;

        $latestCheckIn = $keyResult->checkIns()->latest()->first();

        if ($latestCheckIn) {
            $keyResult->current_value = $latestCheckIn->current_value;
        }
        else {
            $keyResult->current_value = $request->current_value;
        }

        $keyResult->original_current_value = $request->current_value;
        $keyResult->save();

        return Reply::successWithData(__('messages.updateSuccess'), ['redirectUrl' => $request->currentUrl]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $keyResult = KeyResults::findOrFail($id);

        if ($keyResult) {
            $keyResult->checkIns()->delete();
            $keyResult->delete();

            return Reply::success(__('messages.deleteSuccess'));
        }

        return Reply::error(__('performance::messages.keyResultsNotFound'));
    }

    public function showDescription($id)
    {
        $this->objective = KeyResults::findOrFail($id);
        return view('performance::objectives.ajax.show-description', $this->data);
    }

    public function sendReminder($id)
    {
        if (request()->type == 'objective') {
            $objective = Objective::findOrFail($id);

            if ($objective) {
                $owners = ObjectiveOwner::where('objective_id', $objective->id)->with('user')->get();

                if ($owners) {
                    event(new CheckInReminderEvent($objective, $owners));
                }

                return Reply::successWithData(__('performance::messages.reminderSent'), ['status' => 'success']);
            }
            else {
                return Reply::error(__('messages.keyResultNotFound'));
            }
        }
        else {
            $keyResult = KeyResults::findOrFail($id);

            if ($keyResult) {
                $objective = Objective::findOrFail($keyResult->objective_id);
                $owners = ObjectiveOwner::where('objective_id', $keyResult->objective_id)->with('user')->get();

                if ($owners) {
                    event(new CheckInReminderEvent($objective, $owners, $keyResult));
                }

                return Reply::successWithData(__('performance::messages.reminderSent'), ['status' => 'success']);
            }
            else {
                return Reply::error(__('messages.keyResultNotFound'));
            }
        }
    }

    private function checkFrequency($objective)
    {
        $startDate = Carbon::parse($objective->start_date);
        $frequency = $objective->check_in_frequency;

        if ($frequency == 'monthly' || $frequency == 'quarterly') {
            $schedule = $objective->rotation_date;
        }
        else {
            $schedule = $objective->schedule_on;
        }

        switch ($frequency) {
            case 'daily':
                // For daily, just add one day
                $nextCheckIn = $startDate->addDay();
                break;

            case 'weekly':
                // For weekly, calculate the next weekday (e.g., Monday)
                $nextCheckIn = $this->getNextWeekDay($startDate, $schedule);
                break;

            case 'bi-weekly':
                // For bi-weekly, calculate the next weekday with a 2-week interval
                $nextCheckIn = $this->getNextWeekDay($startDate, $schedule, 2); // bi-weekly
                break;

            case 'monthly':
                // For monthly, calculate based on a specific date (e.g., 15th or the specific weekday)
                $nextCheckIn = $this->getNextMonthDay($startDate, $schedule);
                break;

            case 'quarterly':
                // For quarterly, calculate based on quarterly schedule
                $nextCheckIn = $this->getNextQuarterDay($startDate, $schedule);
                break;

            default:
                // If no match, return the start date
                $nextCheckIn = $startDate;
                break;
        }

        return $nextCheckIn;
    }

    /**
     * Helper function to get the next weekday (e.g., Monday, Tuesday, etc.)
     *
     * @param Carbon $startDate
     * @param string $schedule (Day of the week, e.g., "Monday")
     * @param int $interval Interval to add in case of bi-weekly (default 1)
     * @return Carbon
     */
    private function getNextWeekDay(Carbon $startDate, $schedule, $interval = 1)
    {
        $daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        $dayOfWeek = str_replace('every-', '', $schedule);
        $targetDay = array_search(ucfirst($dayOfWeek), $daysOfWeek);

        $nextCheckIn = $startDate->copy();

        // Check if the start date is before the target weekday, if not, move forward by a week
        while ($nextCheckIn->dayOfWeek !== $targetDay) {
            $nextCheckIn->addDay();
        }

        // If the next target day is already past, add a week (for weekly or bi-weekly)
        if ($nextCheckIn->lt($startDate)) {
            $nextCheckIn->addWeeks(1);
        }

        // If it's bi-weekly, add 2 weeks after finding the first match
        $nextCheckIn->addWeeks(($interval - 1));

        return $nextCheckIn;
    }

    /**
     * Helper function to get the next day for monthly frequency
     *
     * @param Carbon $startDate
     * @param string $schedule
     * @return Carbon
     */
    private function getNextMonthDay(Carbon $startDate, $schedule)
    {
        $nextDate = $startDate->copy();
        $nextDate->day = $schedule;

        // Check if the schedule day exceeds the days in the current month
        if ($nextDate->month != $startDate->month) {
            // Check for February
            if ($nextDate->month == 2) {
                $daysInMonth = $nextDate->isLeapYear() ? 29 : 28;
            }
            else {
                $daysInMonth = $nextDate->daysInMonth;
            }

            if ($schedule > $daysInMonth) {
                $nextDate->day = $daysInMonth;
            }
        }

        // If the next calculated date is earlier than the start date, increment by one month
        if ($nextDate->lessThan($startDate)) {
            $nextDate->addMonth();
        }

        return $nextDate;
    }

    /**
     * Helper function to get the next quarterly date
     *
     * @param Carbon $startDate
     * @param string $schedule
     * @return Carbon
     */
    private function getNextQuarterDay(Carbon $startDate, $schedule)
    {
        // $quarterMonth = (int) $schedule;

        // $nextQuarter = $startDate->copy();
        // $nextQuarter->month = $quarterMonth;

        // if ($nextQuarter->lessThan($startDate)) {
        //     $nextQuarter->addMonths(3);
        // }

        // return $nextQuarter;

        $nextDate = $startDate->copy();
        $nextDate->day = $schedule;
        $nextDate->addMonths(3);
        $daysInMonth = $nextDate->daysInMonth;

        // If the schedule day exceeds the number of days in the month, set the date to the last valid day of the month
        if ($schedule > $daysInMonth) {
            $nextDate->day = $daysInMonth;
        }

        // If the next calculated date is earlier than the start date, increment by one more quarter
        if ($nextDate->lessThan($startDate)) {
            $nextDate->addMonths(3);
        }

        return $nextDate;
    }

}
