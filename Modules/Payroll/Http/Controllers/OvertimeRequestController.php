<?php

namespace Modules\Payroll\Http\Controllers;

use App\Models\Team;
use App\Models\User;
use App\Helper\Reply;
use App\Models\Designation;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use App\Http\Controllers\AccountBaseController;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Payroll\Entities\EmployeeSalaryGroup;
use Modules\Payroll\Entities\EmployeeMonthlySalary;
use Modules\Payroll\DataTables\OvertimeRequestDataTable;
use Modules\Payroll\Entities\OvertimePolicy;
use Modules\Payroll\Entities\OvertimePolicyEmployee;
use Modules\Payroll\Entities\OvertimeRequest;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Http\Requests\OvertimeRequest\StoreRequest;
use Modules\Payroll\Http\Requests\OvertimeRequest\UpdateRequest;

class OvertimeRequestController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'payroll::app.menu.overtimeRequest';
        $this->middleware(function ($request, $next) {
            abort_403(!in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     * @return Response
     */
    public function index(OvertimeRequestDataTable $dataTable, Request $request)
    {
        $this->departments = Team::all();
        $this->designations = Designation::allDesignations();
        $this->employees = User::allEmployees(active:true);
        $this->userData = User::with('employeeDetail')->find(user()->id);

        $now = now();
        $this->year = $now->format('Y');
        $this->month = $now->format('m');
        $this->months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

        $this->userPolicy = OvertimePolicy::join('overtime_policy_employees', 'overtime_policy_employees.overtime_policy_id', 'overtime_policies.id')
            ->where('overtime_policy_employees.user_id', user()->id)
            ->first();


        return $dataTable->render('payroll::overtime-request.index', $this->data);
    }

    // Get Overtime Data to show on widgets on table page
    public function getOvertimeData(Request $request)
    {
        $roleId = OvertimeRequestDataTable::getUserSecondRole();

        // Get today's records
        $overtimeRequestBase = OvertimeRequest::with(['user'])
            ->join('users', 'users.id', '=', 'overtime_requests.user_id')
            ->leftJoin('users as actionby', 'actionby.id', '=', 'overtime_requests.action_by')
            ->leftJoin('employee_details', 'users.id', '=', 'employee_details.user_id');

        // Apply filters
        if (!is_null($request->designation) && $request->designation != 'all' && $request->designation != '') {
            $overtimeRequestBase = $overtimeRequestBase->where('employee_details.designation_id', $request->designation);
        }

        if (!is_null($request->department) && $request->department != 'all' && $request->department != '') {
            $overtimeRequestBase = $overtimeRequestBase->where('employee_details.department_id', $request->department);
        }

        if ($request->year != 'all' && $request->year != '') {
            $overtimeRequestBase = $overtimeRequestBase->whereYear('overtime_requests.date', $request->year);
        }

        if ($request->month != 'all' && $request->month != '') {
            $overtimeRequestBase = $overtimeRequestBase->whereMonth('overtime_requests.date', $request->month);
        }

        if ($request->employee != 'all' && $request->employee != '') {
            $overtimeRequestBase = $overtimeRequestBase->whereMonth('overtime_requests.user_id', $request->employee);
        }

        if (!in_array('admin', user_roles()))
        {
            $overtimeRequestBase = $overtimeRequestBase->where(function ($query) use ($roleId) {
                // Allow the user to see their own overtime requests
                $query->where('overtime_requests.user_id', user()->id);

                // Check if the user is allowed to see other users' overtime requests based on policies
                $query->orWhereHas('policy', function ($policyQuery) use ($roleId) {
                    // Allow roles
                    $policyQuery->where('allow_roles', 'like', '%"'.$roleId.'"%');

                    // Reporting manager conditions
                    $policyQuery->orWhere(function ($reportingQuery) {
                        $reportingQuery->where('allow_reporting_manager', 1)
                            ->where('employee_details.reporting_to', user()->id);
                    });
                });
            });
        }

        // Clone the base query for each status count
        $requestedCount = (clone $overtimeRequestBase)->count();
        $approvedCount = (clone $overtimeRequestBase)->where('overtime_requests.status', 'accept')->count();
        $rejectedCount = (clone $overtimeRequestBase)->where('overtime_requests.status', 'reject')->count();
        $pendingCount = (clone $overtimeRequestBase)->where('overtime_requests.status', 'pending')->count();

        // Use the base query for summing hours and amounts
        $overtimeHours = $overtimeRequestBase->sum('hours');
        $overtimeMinutes = $overtimeRequestBase->sum('minutes');
        $compensation = $overtimeRequestBase->sum('amount');

        $PayrollSetting = PayrollSetting::first();

        $currencyId = ($PayrollSetting) ? $PayrollSetting->currency_id : company()->currency_id;

        // Getting hours and minutes
        $minutesHours = self::formatMinutesToHours($overtimeHours, $overtimeMinutes);

        // Data for the view
        $this->overtimeData = [
            'requested' => $requestedCount,
            'approved' => $approvedCount,
            'rejected' => $rejectedCount,
            'pending' => $pendingCount,
            'overtimeHours' => $minutesHours,
            'compensation' => currency_format($compensation, $currencyId),
        ];

        return Reply::dataOnly(['overtimeData' => $this->overtimeData]);

    }

    static public function formatMinutesToHours($existedHours, $minutes)
    {
        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;

        if($remainingMinutes > 0 ){
            return sprintf('%d hrs %d mins', ($hours + $existedHours), $remainingMinutes);
        }

        return sprintf('%d hrs', ($hours + $existedHours));

    }

    /**
     * Show the form for creating a new resource.
     * @return Response
     */
    public function create()
    {
        $this->userPolicy = $this->policy = OvertimePolicy::leftJoin('overtime_policy_employees', 'overtime_policy_employees.overtime_policy_id', 'overtime_policies.id')
            ->where('overtime_policy_employees.user_id', user()->id)->first();

            $this->employees = User::select('users.id', 'users.company_id', 'users.name', 'users.email', 'users.created_at', 'users.image', 'designations.name as designation_name', 'users.email_notifications', 'users.mobile', 'users.country_id', 'users.status', 'employee_details.overtime_hourly_rate')
                ->join('employee_details', 'employee_details.user_id', '=', 'users.id')
                ->leftJoin('designations', 'employee_details.designation_id', '=', 'designations.id')
                ->join('overtime_policy_employees', 'overtime_policy_employees.user_id', '=', 'users.id')
                ->groupBy('users.id')
                ->get();

        return view('payroll::overtime-request.ajax.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     * @param Request $request
     * @return Response
     */
    public function store(StoreRequest $request)
    {
        $startDate = Carbon::parse($request->start_date)->format('Y-m-d');
        $endDate = Carbon::parse($request->end_date)->format('Y-m-d');
        $userId = $request->employee;

        $dates = $request->input('date', []);

        if (count($dates) !== count(array_unique($dates))) {
            return Reply::error(__('payroll::messages.duplicateDate'));
        }

        $datesOvertime = $request->date;

        $requestRecords = OvertimeRequest::whereDate('date', '>=', $startDate)
            ->where('user_id', $userId)
            ->whereDate('date', '<=', $endDate)
            ->pluck('date')
            ->map(function ($date) {
                return Carbon::parse($date)->format('Y-m-d');
            })
        ->toArray();

        $userPolicy = OvertimePolicyEmployee::with('policy', 'policy.payCode')->where('user_id', $userId)->first();

        $userData = User::find($userId);

        $convertedDates = array_map(function($datesOvertime) {
            $carbonDate = Carbon::createFromFormat(company()->date_format, $datesOvertime);
            return $carbonDate->format('Y-m-d');
        }, $datesOvertime);

        foreach($convertedDates as $overDates)
        {
            if(in_array($overDates, $requestRecords))
            {
                return Reply::error(__('payroll::messages.recordInsertedAlready'));
            }
        }

        $hours = array_sum($request->overtime_hours);

        if($request->overtime_hours){

            $overtimeHours = $request->overtime_hours;
            $overtimeDates = $request->date;
            $overtimeMinutes = $request->minutes;
            $reasons = $request->overtime_reasons;
            $type = $request->type;

            $batch_key = \Str::random(16);

            foreach($overtimeHours as $key => $hours){

                $minutes = $overtimeMinutes[$key] ?? 0;
                $payCode = $userPolicy->policy->payCode;
                $overtimeType = $type[$key];

                $amount = $this->getAmount($minutes, $payCode, $overtimeType, $userData, $userPolicy, $hours);

                $date = Carbon::createFromFormat(company()->date_format, $overtimeDates[$key])->format('Y-m-d');

                $overtimeRequest = new OvertimeRequest();
                $overtimeRequest->user_id = $userId;
                $overtimeRequest->start_date = $startDate;
                $overtimeRequest->end_date = $endDate;
                $overtimeRequest->minutes = $minutes;
                $overtimeRequest->overtime_policy_id = $userPolicy->overtime_policy_id;
                $overtimeRequest->user_id = $userId;
                $overtimeRequest->date = $date;
                $overtimeRequest->hours = $hours;
                $overtimeRequest->amount = $amount;
                $overtimeRequest->overtime_reason = $reasons[$key] ?? null;
                $overtimeRequest->type = $type[$key];
                $overtimeRequest->save_type = 'draft';
                $overtimeRequest->batch_key = $batch_key;
                $overtimeRequest->save();
            }
        }

        return Reply::success(__('messages.recordSaved'));
    }

    private function getAmount($minutes, $payCode, $overtimeType, $userData, $userPolicy, $hours)
    {
        if($userPolicy->policy->payCode->fixed == 1){
            if($overtimeType == 'working')
            {
                $fixedAmount = $payCode->regular_fixed_amount;
            }

            if($overtimeType == 'holiday')
            {
                $fixedAmount = $payCode->holiday_fixed_amount;
            }

            if($overtimeType == 'dayoff')
            {
                $fixedAmount = $payCode->day_off_fixed_amount;
            }

            $amount = $hours * $fixedAmount;
                $perMinAmount = $fixedAmount / 60;
                $amount = ($amount + ($minutes * $perMinAmount));


        }
        else{

            if($overtimeType == 'working')
            {
                $timeRate = $payCode->regular_time_rate;
            }

            if($overtimeType == 'holiday')
            {
                $timeRate = $payCode->holiday_time_rate;
            }

            if($overtimeType == 'dayoff')
            {
                $timeRate = $payCode->day_off_time_rate;
            }

            $amount = $hours * ($userData->employeeDetail->overtime_hourly_rate * $timeRate);
            $perMinAmount = ($userData->employeeDetail->overtime_hourly_rate * $timeRate) / 60;

            $amount = ($amount + ($minutes * $perMinAmount));
        }

        return round($amount, 2);
    }

    /**
     * Show the specified resource.
     * @param int $id
     * @return Response
     */
    public function show($id)
    {
        $this->overtimeRequest = OvertimeRequest::find($id);
        $this->payrollSetting = PayrollSetting::first();
        $this->currencySymbol = ($this->payrollSetting->currency ? $this->payrollSetting->currency->currency_symbol : company()->currency->currency_symbol);

        $this->employee = $this->overtimeRequest->user;
        $userPolicy = OvertimePolicyEmployee::with('policy', 'policy.payCode')->where('user_id', $this->employee->id)->first();

        if($userPolicy->policy->payCode->fixed == 1){
            $this->amount = $userPolicy->policy->payCode->fixed_amount;
        }
        else{
            $this->amount = $this->employee->employeeDetail->overtime_hourly_rate;
        }


        $this->roleId = OvertimeRequestDataTable::getUserSecondRole();
        $this->allowRoles = $this->overtimeRequest->policy->allow_roles;
        $this->reportingTo = user()->employeeDetails->reporting_to;

        $this->userWiseTotalHours = $this->calculateTotalHours($this->employee->id, $this->overtimeRequest->start_date->format('Y-m-d'), $this->overtimeRequest->end_date->format('Y-m-d'));

        return view('payroll::overtime-request.show', $this->data);
    }

    /**
     * Show the form for editing the specified resource.
     * @param int $id
     * @return Response
     */
    public function edit($id)
    {
        $viewPermission = user()->permission('manage_employee_salary');
        abort_403(!in_array($viewPermission, ['all', 'added']));

        $this->overtimeRequest = OvertimeRequest::find($id);

        $this->policyData = $this->getUserPolicyData($this->overtimeRequest->user_id);

        return view('payroll::overtime-request.ajax.edit', $this->data);
    }

    public function update(UpdateRequest $request, $id)
    {
        $date = Carbon::createFromFormat( company()->date_format, $request->date)->format('Y-m-d');

        $overtimeRequest = OvertimeRequest::find($id);

        $requestRecord = OvertimeRequest::where('user_id', $overtimeRequest->user_id)
            ->whereDate('date', $date)
            ->where('id', '<>', $id)
            ->first();

        if(!is_null($requestRecord))
        {
            return Reply::error(__('payroll::messages.recordInsertedAlready'));
        }

        $userPolicy = OvertimePolicyEmployee::with('policy', 'policy.payCode')->where('user_id', $overtimeRequest->user_id)->first();

        $userData = User::find($overtimeRequest->user_id);

        $hours = floatval($request->overtime_hours);

        $minutes = $request->minutes ? floatval($request->minutes) : 0;

        $payCode = $userPolicy->policy->payCode;

        $overtimeType = $request->type;

        $amount = $this->getAmount($minutes, $payCode, $overtimeType, $userData, $userPolicy, $hours);

        $overtimeRequest->hours = $hours;
        $overtimeRequest->minutes = $request->minutes;
        $overtimeRequest->date = $date;
        $overtimeRequest->amount = $amount;
        $overtimeRequest->type = $overtimeType;
        $overtimeRequest->overtime_reason = $request->overtime_reasons ?? null;
        $overtimeRequest->save();

        return Reply::success(__('payroll::messages.recordUpdated'));
    }

    /**
     * Remove the specified resource from storage.
     * @param int $id
     * @return Response
     */
    public function destroy($id)
    {

        // Deleting Overtime Request
        OvertimeRequest::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }

    static public function policyData($overtimeData, $userPolicy, $userData, $dateData, $type)
    {
        $hours = $overtimeData[$dateData]->overtime_hours;

        if($userPolicy->payCode->fixed == 1){
            $amount = $hours * $userPolicy->payCode->fixed_amount;
        }
        else{
            $amount = $hours * ($userData->employeeDetail->overtime_hourly_rate * $userPolicy->payCode->time);
        }

        return $hours;
    }

    public function totalAttendanceHoursCalculation($startDate, $endDate, $userId)
    {

        $overtimes = DB::table('attendances as a')
            ->leftJoin('employee_shift_schedules as ess', function($join) {
                $join->on('a.employee_shift_id', '=', 'ess.id')
                    ->where('ess.date', '=', DB::raw('DATE(a.shift_start_time)'));
            })
            ->join('employee_shifts as es', function($join) {
                $join->on('ess.employee_shift_id', '=', 'es.id')
                    ->orOn('a.employee_shift_id', '=', 'es.id');
            })
            ->join('users as u', 'a.user_id', '=', 'u.id')
            ->select(
                'u.name as employee_name',
                'es.shift_name',
                DB::raw('DATE(a.shift_start_time) as shift_date'),
                'a.shift_end_time',
                DB::raw('SUM(TIMESTAMPDIFF(HOUR, a.clock_in_time, a.clock_out_time)) as total_work_hours'),
                DB::raw('
                    CASE
                        WHEN es.shift_type = "flexible" THEN es.flexible_total_hours
                        ELSE TIMESTAMPDIFF(HOUR, es.office_start_time, es.office_end_time)
                    END as shift_hours
                '),
                DB::raw('
                    SUM(TIMESTAMPDIFF(HOUR, a.clock_in_time, a.clock_out_time)) -
                    CASE
                        WHEN es.shift_type = "flexible" THEN es.flexible_total_hours
                        ELSE TIMESTAMPDIFF(HOUR, es.office_start_time, es.office_end_time)
                    END as overtime_hours
                ')
            )
            ->where('a.company_id', company()->id)
            ->where('a.user_id', $userId)
            ->whereDate('a.shift_start_time', '>=', $startDate)
            ->whereDate('a.shift_start_time', '<=', $endDate)
            ->groupBy('u.name', 'es.shift_name', 'a.shift_start_time', 'a.shift_end_time')
            ->having('overtime_hours', '>', 0)
            ->get()
            ->keyBy('shift_date')
            ->toArray();

        return $overtimes;

    }

    public function calculateTotalHours($userId, $startDate, $endDate)
    {
        $results = DB::table('attendances as a')
            ->join('employee_shift_schedules as ess', function($join) {
                $join->on('a.user_id', '=', 'ess.user_id')
                    ->on(DB::raw('DATE(a.clock_in_time)'), '=', 'ess.date')
                    ->on('a.employee_shift_id', '=', 'ess.employee_shift_id')
                    ->on('a.shift_start_time', '=', 'ess.shift_start_time');
            })
            ->where('a.user_id', $userId)
            ->whereBetween(DB::raw('DATE(a.clock_in_time)'), [$startDate, $endDate])
            ->select(
                DB::raw('DATE(a.clock_in_time) as work_date'),
                DB::raw('FLOOR(SUM(TIMESTAMPDIFF(MINUTE, a.clock_in_time, a.clock_out_time)) / 60) AS total_hours')
            )
            ->groupBy('work_date')
            ->get();

        $formattedResults = [];

        foreach ($results as $result) {
            $formattedResults[$result->work_date] = (int)$result->total_hours;
        }

        // Output the formatted results
        return $formattedResults;

    }

    public function changeStatus(Request $request)
    {
        $overtimeRequest = OvertimeRequest::find($request->request_id);
        $overtimeRequest->status = $request->status;
        $overtimeRequest->action_by = user()->id;
        $overtimeRequest->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    public function acceptRequest(Request $request, $id)
    {
        $status = $request->type ? $request->type : 'accept';
        $overtimeRequest = OvertimeRequest::find($id);
        $overtimeRequest->status = $status;
        $overtimeRequest->action_by = user()->id;
        $overtimeRequest->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    public function getUserPolicy($id)
    {
        $policyData = $this->getUserPOlicyData($id);
        return Reply::dataOnly(['applyDate' => $policyData['applyDate']->format('Y-m-d'), 'typeOptions' => $policyData['typeOptions'], 'currentMonthDate' => $policyData['currentMonthDate']->format('Y-m-d')]);
    }

    public function getUserPolicyData($id)
    {
        $this->userPolicy = OvertimePolicy::leftJoin('overtime_policy_employees', 'overtime_policy_employees.overtime_policy_id', 'overtime_policies.id')
            ->where('overtime_policy_employees.user_id', $id)->first();

        $currentDate = now();
        $daysBefore = $currentDate->copy()->subDays($this->userPolicy->request_before_days);

        if ($daysBefore->month < $currentDate->month) {
            $resultDate = $currentDate->copy()->startOfMonth();
        }
        else {
            $resultDate = $daysBefore;
        }

        $typeOptions = '';

        if($this->userPolicy->working_days == 1)
        {
            $typeOptions .= '<option value="working">'.__('payroll::modules.payroll.workingDay').'</option>';
        }

        if($this->userPolicy->week_end == 1)
        {
            $typeOptions .= '<option value="dayoff">'.__('payroll::modules.payroll.dayOff').'</option>';
        }

        if($this->userPolicy->holiday == 1)
        {
            $typeOptions .= '<option value="holiday">'. __('payroll::modules.payroll.holiday').'</option>';
        }

        return ['applyDate' => $resultDate, 'currentMonthDate' => $currentDate->copy(), 'typeOptions' => $typeOptions];
    }

}
