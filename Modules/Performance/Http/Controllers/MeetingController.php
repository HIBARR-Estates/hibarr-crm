<?php

namespace Modules\Performance\Http\Controllers;

use Carbon\Carbon;
use App\Models\User;
use App\Helper\Reply;
use Illuminate\Http\Request;
use App\Models\EmployeeDetails;
use Illuminate\Support\Facades\DB;
use Modules\Performance\Entities\Meeting;
use App\Http\Controllers\AccountBaseController;
use Modules\Performance\Entities\PerformanceSetting;
use Modules\Performance\Events\MeetingInviteEvent;
use Modules\Performance\Events\MeetingReminderEvent;
use Modules\Performance\Http\Requests\StoreMeeting;

class MeetingController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'performance::app.meetings';
    }

    public function index(Request $request)
    {
        $this->hasAccess = !$this->hasManageAccess();
        $this->hasCreateAccess = !$this->hasCreateAccess();
        $this->employees = User::allEmployees(null, true);
        $this->activeTab = $request->status ?? 'upcoming';
        $this->tab = $request->tab ?? 'list';

        $now = Carbon::now()->setTimezone(company()->timezone);
        $this->year = now()->format('Y');
        $this->month = now()->format('m');

        $query = Meeting::with(['meetingBy', 'meetingFor', 'agendas', 'actions'])
            ->select('performance_meetings.*');

        // Status filter
        switch (strtolower($request->status)) {
            case 'upcoming':
                $query->where('start_date_time', '>', $now)
                    ->whereNot('status', 'cancelled');
                break;
            case 'pending':
                $query->where('status', 'pending');
                break;
            case 'recurring':
                $query->whereNotNull('parent_id')
                    ->orWhereIn('id', function ($subQuery) {
                        $subQuery->select('parent_id')
                            ->from('performance_meetings')
                            ->whereNotNull('parent_id');
                    });
                break;
            case 'past':
                $query->where('start_date_time', '<', $now);
                break;
            case 'cancelled':
                $query->where('status', 'cancelled');
                break;
            default:
                $query->where('start_date_time', '>', $now);
        }

        // Month filter
        if ($request->month) {
            $query->whereMonth('start_date_time', $request->month);
        }

        // Year filter
        if ($request->year) {
            $query->whereYear('start_date_time', $request->year);
        }

        // Employee filter
        if ($request->employee && $request->employee != 'all') {
            $query->where(function ($q) use ($request) {
                $q->where('meeting_for', $request->employee)
                    ->orWhere('meeting_by', $request->employee);
            });
        }

        // Search filter
        if (request()->searchText && request()->searchText != 'all') {
            $query->where(function ($meeting) {
                $meeting->orWhereHas('agendas', function ($q) {
                    $q->where('discussion_point', 'like', '%' . request('searchText') . '%');
                })
                    ->orWhereHas('meetingFor', function ($q) {
                        $q->where('name', 'like', '%' . request('searchText') . '%');
                    })
                    ->orWhereHas('meetingBy', function ($q) {
                        $q->where('name', 'like', '%' . request('searchText') . '%');
                    });
            });
        }

        $allEvents = $query->orderBy('start_date_time', 'asc')->get();

        // Count the total past meetings
        if ($request->month) {
            $selectedMonthStart = Carbon::createFromFormat('Y-m', $request->year . '-' . $request->month)->startOfMonth();
        }
        else {
            $selectedMonthStart = Carbon::now()->startOfMonth();
        }

        $pastMonthMeetingsCount = Meeting::where('status', 'pending')
            ->where('start_date_time', '<', $selectedMonthStart);

        if ($request->year) {
            $pastMonthMeetingsCount->whereYear('start_date_time', $request->year);
        }

        // Employee filter
        if ($request->employee && $request->employee != 'all') {
            $pastMonthMeetingsCount->where(function ($q) use ($request) {
                $q->where('meeting_for', $request->employee)
                    ->orWhere('meeting_by', $request->employee);
            });
        }

        // Search filter
        if (request()->searchText && request()->searchText != 'all') {
            $pastMonthMeetingsCount->where(function ($meeting) {
                $meeting->orWhereHas('agendas', function ($q) {
                    $q->where('discussion_point', 'like', '%' . request('searchText') . '%');
                })
                    ->orWhereHas('meetingFor', function ($q) {
                        $q->where('name', 'like', '%' . request('searchText') . '%');
                    })
                    ->orWhereHas('meetingBy', function ($q) {
                        $q->where('name', 'like', '%' . request('searchText') . '%');
                    });
            });
        }

        $pastMonthMeetingsCount = $pastMonthMeetingsCount->get();

        // Filter objectives based on user access
        $this->pastMonthMeetingsCount = $pastMonthMeetingsCount->filter(function ($meeting) {
            $meeting->has_access = !$this->checkManageAccess($meeting->id);
            return !$this->checkViewAccess($meeting->id);
        })->groupBy(function ($meeting) {
            return Carbon::parse($meeting->start_date_time)->format('Y-m-d');
        })->count();

        // Filter objectives based on user access
        $this->meetings = $allEvents->filter(function ($meeting) {
            $meeting->has_access = !$this->checkManageAccess($meeting->id);
            return !$this->checkViewAccess($meeting->id);
        })->groupBy(function ($meeting) {
            return Carbon::parse($meeting->start_date_time)->format('Y-m-d');
        });

        $this->view = 'performance::meetings.ajax.meetings-list';

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();

            return Reply::dataOnly(['tab' => $this->tab, 'status' => 'success', 'activeTab' => $this->activeTab, 'html' => $html, 'title' => $this->pageTitle]);
        }

        return view('performance::meetings.list-view', $this->data);
    }

    public function calendarView()
    {
        $this->hasAccess = !$this->hasManageAccess();
        $this->hasCreateAccess = !$this->hasCreateAccess();
        $this->employees = User::allEmployees(null, true);

        if (request('start') && request('end')) {
            $model = Meeting::with(['agendas', 'meetingFor', 'meetingBy']);

            if (request()->employeeId && request()->employeeId != 'all' && request()->employeeId != 'undefined') {
                $empId = request()->employeeId;
                $model->where(function ($q) use ($empId) {
                    $q->where('meeting_by', $empId)
                        ->orWhere('meeting_for', $empId);
                });
            }

            if (request()->searchText && request()->searchText != 'all') {
                $model->where(function ($query) {
                    $query->orWhereHas('agendas', function ($q) {
                        $q->where('discussion_point', 'like', '%' . request('searchText') . '%');
                    })
                        ->orWhereHas('meetingFor', function ($q) {
                            $q->where('name', 'like', '%' . request('searchText') . '%');
                        })
                        ->orWhereHas('meetingBy', function ($q) {
                            $q->where('name', 'like', '%' . request('searchText') . '%');
                        });
                });
            }

            $allEvents = $model->get();

            // Filter objectives based on user access
            $meetings = $allEvents->filter(function ($meeting) {
                $meeting->has_access = !$this->checkManageAccess($meeting->id);
                return !$this->checkViewAccess($meeting->id);
            });

            $eventData = array();

            foreach ($meetings as $key => $event) {

                if (company()->time_format == 'h:i a') {
                    $title = $event->meetingFor ? '- '. $event->meetingFor->name . ' ('. __('performance::app.till') .' '. $event->end_date_time->format('h:i A') . ')' : '--';
                }
                else {
                    $title = $event->meetingFor ? '- '. $event->meetingFor->name . ' ('. __('performance::app.till') .' '. $event->end_date_time->format(company()->time_format) . ')' : '--';
                }

                $eventData[] = [
                    'id' => $event->id,
                    'title' => $title,
                    'organizer' => $event->meetingBy ? $event->meetingBy->name : '',
                    'start' => $event->start_date_time,
                    'end' => $event->end_date_time,
                    'status' => $event->status,
                ];
            }

            return $eventData;
        }

        return view('performance::meetings.index', $this->data);
    }

    public function create()
    {
        abort_403($this->hasCreateAccess());
        $this->pageTitle = __('performance::app.addMeeting');

        $this->tab = request()->tab ?? 'calendar';
        $this->employees = User::allEmployees(null, true);
        $this->view = 'performance::meetings.ajax.create';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('performance::meetings.create', $this->data);
    }

    public function store(StoreMeeting $request)
    {
        DB::beginTransaction();

        $meeting = new Meeting();
        $meeting->company_id = company()->id;
        $start_date_time = Carbon::createFromFormat($this->company->date_format, $request->meeting_date, $this->company->timezone)->format('Y-m-d') . ' ' . Carbon::createFromFormat($this->company->time_format, $request->start_time)->format('H:i:s');
        $meeting->start_date_time = Carbon::parse($start_date_time)->setTimezone('UTC');
        $end_date_time = Carbon::createFromFormat($this->company->date_format, $request->meeting_date, $this->company->timezone)->format('Y-m-d') . ' ' . Carbon::createFromFormat($this->company->time_format, $request->end_time)->format('H:i:s');
        $meeting->end_date_time = Carbon::parse($end_date_time)->setTimezone('UTC');
        $meeting->repeat = $request->repeat ? $request->repeat : 'no';
        $meeting->repeat_every = $request->repeat_count;
        $meeting->repeat_cycles = $request->repeat_cycles;
        $meeting->repeat_type = $request->repeat_type;
        $meeting->meeting_for = $request->meeting_for;
        $meeting->meeting_by = $request->meeting_by;
        $meeting->added_by = user()->id;
        $meeting->save();

        // Add repeated event
        if ($request->has('repeat') && $request->repeat == 'yes') {
            $repeatCount = $request->repeat_count;
            $repeatType = $request->repeat_type;
            $repeatCycles = $request->repeat_cycles;
            $startDate = Carbon::createFromFormat($this->company->date_format, $request->meeting_date);
            $dueDate = Carbon::createFromFormat($this->company->date_format, $request->meeting_date);

            if ($repeatType == 'monthly-on-same-day') {

                $startDateOriginal = $startDate->copy();
                $dueDateDiff = $dueDate->diffInDays($startDate);
                $weekOfMonth = $startDateOriginal->weekOfMonth;
                $weekDay = $startDateOriginal->dayOfWeek;
                $startDateOriginal->startOfMonth();

                for ($i = 1; $i < $repeatCycles; $i++) {
                    $eventStartDate = $startDateOriginal->addMonths($repeatCount)->copy();

                    if ($weekOfMonth == 1) {
                        $eventStartDate->startOfMonth();
                        $eventStartDateCopy = $eventStartDate->copy();
                        $eventStartDate->addWeeks($weekOfMonth - 1);
                        $eventStartDate->startOfWeek();
                        $eventStartDate->addDays($weekDay - 1);

                        if ($eventStartDateCopy->month != $eventStartDate->month) {
                            $eventStartDate->addWeek();
                        }
                    } elseif ($weekOfMonth == 5) {
                        $eventStartDate->endOfMonth();
                        $eventStartDate->startOfWeek();
                        $eventStartDateCopy = $eventStartDate->copy();
                        $eventStartDate->addDays($weekDay - 1);

                        if ($eventStartDateCopy->month != $eventStartDate->month) {
                            $eventStartDate->subWeek();
                        }

                        if ($eventStartDate->copy()->addWeek()->month == $eventStartDate->month) {
                            $eventStartDate->addWeek();
                        }
                    } else {
                        $eventStartDate->startOfMonth();
                        $eventStartDate->addWeeks($weekOfMonth - 1);
                        $eventStartDate->startOfWeek();
                        $eventStartDate->addDays($weekDay - 1);

                        if ($eventStartDate->weekOfMonth != $weekOfMonth && $eventStartDate->copy()->addWeek()->month == $eventStartDate->month) {
                            $eventStartDate->addWeek();
                        }
                    }

                    $eventDueDate = $eventStartDate->copy()->addDays($dueDateDiff);

                    $this->addRepeatEvent($meeting, $request, $eventStartDate, $eventDueDate);
                }
            } else {
                for ($i = 1; $i < $repeatCycles; $i++) {
                    $startDate = $startDate->add($repeatCount, str_plural($repeatType));
                    $dueDate = $dueDate->add($repeatCount, str_plural($repeatType));

                    $this->addRepeatEvent($meeting, $request, $startDate, $dueDate);
                }
            }
        }

        if ($meeting->meeting_for && $request->send_mail != 'no') {
            event(new MeetingInviteEvent($meeting, $meeting->meetingFor, $meeting->meetingBy));
        }

        DB::commit();

        $tab = $request->tab ?? 'list';

        return Reply::successWithData(__('messages.recordSaved'), ['tab' => $tab, 'meeting_id' => $meeting->id]);
    }

    private function addRepeatEvent($parentEvent, $request, $startDate, $dueDate)
    {
        $meeting = new Meeting();
        $meeting->company_id = company()->id;
        $meeting->parent_id = $parentEvent->id;
        $meeting->start_date_time = $startDate->format('Y-m-d') . '' . Carbon::parse($request->start_time)->format('H:i:s');
        $meeting->end_date_time = $dueDate->format('Y-m-d') . ' ' . Carbon::parse($request->end_time)->format('H:i:s');
        $meeting->repeat = $request->repeat ? $request->repeat : 'no';
        $meeting->repeat_every = $request->repeat_count;
        $meeting->repeat_cycles = $request->repeat_cycles;
        $meeting->repeat_type = $request->repeat_type;
        $meeting->meeting_for = $request->meeting_for;
        $meeting->meeting_by = $request->meeting_by;
        $meeting->added_by = user()->id;
        $meeting->save();
    }

    public function show($id)
    {
        abort_403($this->checkViewAccess($id));
        $this->hasAccess = !$this->checkManageAccess($id);

        $this->pageTitle = __('performance::app.meeting') . ' ' . __('app.details');

        $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'agendas', 'agendas.addedBy', 'actions', 'actions.addedBy'])->select('performance_meetings.*')->where('id', $id)->first();
        $this->indexView = request('tab');

        $tab = request('view');
        $this->activeTab = $tab ?: 'detail';

        switch ($tab) {
        case 'discussion':
            $this->tab = 'performance::meetings.ajax.discussion';
            break;
        case 'action':
            $this->tab = 'performance::meetings.ajax.action';
            break;
        default:
            $this->tab = 'performance::meetings.ajax.meeting-detail';
            break;
        }


        if (request()->ajax()) {
            $view = request('json') ? $this->tab : 'performance::meetings.ajax.show';
            $html = view($view, $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'activeTab' => $this->activeTab, 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'performance::meetings.ajax.show';

        return view('performance::meetings.create', $this->data);
    }

    public function edit($id)
    {
        abort_403($this->checkManageAccess($id));

        $this->pageTitle = __('performance::app.editMeeting');
        $this->tab = request()->tab ?? 'calendar';
        $this->meeting = Meeting::findOrFail($id);
        $this->employees = User::allEmployees();

        if (request()->ajax()) {
            $html = view('performance::meetings.ajax.edit', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'performance::meetings.ajax.edit';

        return view('performance::meetings.create', $this->data);
    }

    public function update(StoreMeeting $request, $id)
    {
        abort_403($this->checkManageAccess($id));

        $meeting = Meeting::findOrFail($id);
        $start_date_time = Carbon::createFromFormat($this->company->date_format, $request->meeting_date, $this->company->timezone)->format('Y-m-d') . ' ' . Carbon::createFromFormat($this->company->time_format, $request->start_time)->format('H:i:s');
        $meeting->start_date_time = Carbon::parse($start_date_time)->setTimezone('UTC');
        $end_date_time = Carbon::createFromFormat($this->company->date_format, $request->meeting_date, $this->company->timezone)->format('Y-m-d') . ' ' . Carbon::createFromFormat($this->company->time_format, $request->end_time)->format('H:i:s');
        $meeting->end_date_time = Carbon::parse($end_date_time)->setTimezone('UTC');
        $meeting->repeat = $request->repeat ? $request->repeat : 'no';
        $meeting->repeat_every = $request->repeat_count;
        $meeting->repeat_cycles = $request->repeat_cycles;
        $meeting->repeat_type = $request->repeat_type;
        $meeting->meeting_for = $request->meeting_for;
        $meeting->meeting_by = $request->meeting_by;
        $meeting->status = $request->status;
        $meeting->save();

        return Reply::successWithData(__('messages.updateSuccess'), ['redirectUrl' => route('meetings.index')]);
    }

    public function destroy($id)
    {
        abort_403($this->checkManageAccess($id));

        $meetingDetail = Meeting::findOrFail($id);

        if ($meetingDetail->parent_id && request()->delete == 'all') {
            $id = $meetingDetail->parent_id;
        }

        $meeting = Meeting::findOrFail($id);
        $meeting->delete();

        return Reply::successWithData(__('messages.deleteSuccess'), ['redirectUrl' => route('meetings.index')]);
    }

    public function monthlyOn(Request $request)
    {
        $date = Carbon::createFromFormat($this->company->date_format, $request->date);

        $week = __('app.eventDay.' . $date->weekOfMonth);
        $day = $date->translatedFormat('l');

        return Reply::dataOnly(['message' => __('app.eventMonthlyOn', ['week' => $week, 'day' => $day])]);
    }

    public function markAsComplete($id)
    {
        abort_403($this->checkManageAccess($id));

        $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'agendas'])->select('performance_meetings.*')->where('id', $id)->first();
        $this->meeting->status = 'completed';
        $completedOn = Carbon::now()->setTimezone(company()->timezone);
        $this->meeting->completed_on = $completedOn->shiftTimezone('UTC');
        $this->meeting->save();

        $view = 'performance::meetings.ajax.meeting-detail';
        $html = view($view, $this->data)->render();

        $completedDate = __('app.completedOn'). ': ' .$completedOn->translatedFormat($this->company->date_format);

        return Reply::successWithData(__('messages.recordSaved'), ['status' => 'success', 'activeTab' => 'detail', 'html' => $html, 'completedOn' => $completedDate, 'title' => $this->pageTitle]);
    }

    public function markAsCancelled($id)
    {
        abort_403($this->checkManageAccess($id));

        $this->meeting = Meeting::with(['meetingBy', 'meetingFor', 'agendas', 'actions'])->select('performance_meetings.*')->where('id', $id)->first();
        $this->meeting->status = 'cancelled';
        $this->meeting->save();

        $view = 'performance::meetings.ajax.meeting-detail';
        $html = view($view, $this->data)->render();

        return Reply::successWithData(__('messages.recordSaved'), ['status' => 'success', 'activeTab' => 'detail', 'html' => $html, 'title' => $this->pageTitle]);
    }

    public function sendReminder($id = null)
    {
        $meetingIds = explode(',', request()->meetingIds);
        DB::beginTransaction();
        
        try {
            if ($id) {
                $meeting = Meeting::findOrFail($id);
                $meetingIds = [$meeting->id];
            } else {
                $meetingIds = explode(',', request()->meetingIds);
            }

            foreach ($meetingIds as $meetingId) {
                $meeting = Meeting::find($meetingId);

                if ($meeting && $meeting->meeting_for && $meeting->meeting_by) {
                    event(new MeetingReminderEvent($meeting, $meeting->meetingBy));
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return Reply::error(__('messages.errorOccured') . ': ' . $e->getMessage());
        }

        return Reply::successWithData(__('performance::messages.reminderSent'), ['status' => 'success']);
    }

    public function viewMeetingList(Request $request)
    {
        if ($request->month) {
            $selectedMonthStart = Carbon::createFromFormat('Y-m', $request->year . '-' . $request->month)->startOfMonth();
        }
        else {
            $selectedMonthStart = Carbon::now()->startOfMonth();
        }

        $pastMonthMeetingsCount = Meeting::where('status', $request->status)
            ->where('start_date_time', '<', $selectedMonthStart);

        if ($request->year) {
            $pastMonthMeetingsCount->whereYear('start_date_time', $request->year);
        }

        // Employee filter
        if ($request->employee && $request->employee != 'all') {
            $pastMonthMeetingsCount->where(function ($q) use ($request) {
                $q->where('meeting_for', $request->employee)
                    ->orWhere('meeting_by', $request->employee);
            });
        }

        // Search filter
        if (request()->searchText && request()->searchText != 'all') {
            $pastMonthMeetingsCount->where(function ($meeting) {
                $meeting->orWhereHas('agendas', function ($q) {
                    $q->where('discussion_point', 'like', '%' . request('searchText') . '%');
                })
                    ->orWhereHas('meetingFor', function ($q) {
                        $q->where('name', 'like', '%' . request('searchText') . '%');
                    })
                    ->orWhereHas('meetingBy', function ($q) {
                        $q->where('name', 'like', '%' . request('searchText') . '%');
                    });
            });
        }

        $pastMonthMeetingsCount = $pastMonthMeetingsCount->get();

        // Filter objectives based on user access
        $this->meetings = $pastMonthMeetingsCount->filter(function ($meeting) {
            $meeting->has_access = !$this->checkManageAccess($meeting->id);
            return !$this->checkViewAccess($meeting->id);
        })->groupBy(function ($meeting) {
            return Carbon::parse($meeting->start_date_time)->format('Y-m-d');
        });

        return view('performance::meetings.ajax.past-meeting-list', $this->data);
    }

    protected function checkViewAccess($id)
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

    protected function checkManageAccess($id)
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

    protected function hasManageAccess()
    {
        $userId = user()->id;
        $meetingSetting = PerformanceSetting::first();
        $canManageManager = $meetingSetting->create_meeting_manager;
        $canManageParticipant = $meetingSetting->create_meeting_participant;

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->where('user_id', $userId)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $manageByRoles = json_decode($meetingSetting->create_meeting_roles, true) ?? [];

        return !(user()->hasRole('admin') || $canManageParticipant ||
            ($canManageManager == 1 && in_array(user()->id, $managerIds)) ||
            (!empty($manageByRoles) && array_intersect($currentUserRoleIds, $manageByRoles)));
    }

    protected function hasCreateAccess()
    {
        $userId = user()->id;
        $meetingSetting = PerformanceSetting::first();
        $canManageManager = $meetingSetting->create_meeting_manager;

        $managerIds = EmployeeDetails::whereNotNull('reporting_to')
            ->where('user_id', $userId)
            ->pluck('reporting_to')
            ->toArray();

        $currentUserRoleIds = user()->roles()->pluck('id')->toArray();
        $manageByRoles = json_decode($meetingSetting->create_meeting_roles, true) ?? [];

        return !(user()->hasRole('admin') ||
            ($canManageManager == 1 && in_array(user()->id, $managerIds)) ||
            (!empty($manageByRoles) && array_intersect($currentUserRoleIds, $manageByRoles)));
    }

}
