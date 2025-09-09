<?php

namespace Modules\Payroll\DataTables;

use App\DataTables\BaseDataTable;
use App\Models\Role;
use Yajra\DataTables\Html\Column;
use Modules\Payroll\Entities\OvertimeRequest;
use Modules\Payroll\Entities\PayrollSetting;

class OvertimeRequestDataTable extends BaseDataTable
{
    private $roleId;
    private $payrollSetting;
    private $payCode;

    /**
     * Build DataTable class.
     *
     * @param mixed $query Results from query() method.
     * @return \Yajra\DataTables\DataTableAbstract
     */
    public function dataTable($query)
    {
        $this->roleId = self::getUserSecondRole();
        $this->payrollSetting = PayrollSetting::first();
        return datatables()
            ->eloquent($query)
            ->addColumn('action', function ($row) {
                $allowRoles = $row->policy->allow_roles ?? [];
                $this->payCode = $row->policy->payCode;
                $reportingTo = user()->employeeDetails->reporting_to;
                $action = '';

                if ($row->status == 'reject') {
                    $statusColor = 'danger';
                    $status = __('app.rejected');
                }
                elseif ($row->status == 'pending') {
                    $statusColor = 'warning';
                    $status = __('app.pending');
                }
                else {
                    $statusColor = 'success';
                    $status = __('app.accepted');
                }

                if ($row->status == 'pending' && (user()->hasRole('admin') || in_array($this->roleId, $allowRoles) || $reportingTo == user()->id)) {
                    $action .= '<button type="button" id="edit"  data-request-id="' . $row->id . '" data-type="edit" class="btn-primary btn-sm rounded f-14 p-2 editRequest mr-1"> <i class="fa fa-edit "></i> </button>';
                    $action .= '<button type="button" id="reject"  data-request-id="' . $row->id . '" data-type="reject" class="btn-danger btn-sm rounded f-14 p-2 acceptButton"> <i class="fa fa-times mr-1"></i> '.__('app.reject').'</button>';

                    $action .= ' <button type="button" id="acceptButton"  data-request-id="' . $row->id . '" data-type="accept" class="btn-primary btn-sm rounded f-14 p-2 acceptButton">  <i class="fa fa-check mr-1"></i>'.__('app.accept').'</button>';
                }

                if($row->status != 'pending'){
                    return '<i class="mr-1 fa fa-circle text-'.$statusColor.'" ></i>' . $status.'<br> <p>'.__('payroll::modules.payroll.actionBy').' : '.$row->actionByName.'</p>';
                }

                return $action;
            })

            ->editColumn('user_id', function ($row) {
                return view('components.employee', [
                    'user' => $row->user
                ]);
            })

            ->editColumn('date', function ($row) {
                return $row->date->format(company()->date_format) ?? '--';
            })

            ->editColumn('created_at', function ($row) {
                return $row->created_at->format(company()->date_format) ?? '--';
            })

            ->editColumn('overtime_reason', function ($row) {
                return $row->overtime_reason ? '<p data-toggle="tooltip" data-original-title="' . $row->overtime_reason . '">'. mb_strimwidth($row->overtime_reason, 0, 40, '...') . '</p>' : '--';
            })

            ->editColumn('hours', function ($row) {
                $typeLabel = __('payroll::modules.payroll.'.$row->type);
                $type = '<span class="badge badge-primary mr-1" >' . $typeLabel . '</span>';
                $hours = $row->hours .' '.__('app.hour');
                $minutes = ( $row->minutes != 0) ? $row->minutes .' '. __('app.minute') : '';
                return $hours.' '.$minutes.' '.$type;
            })

            ->editColumn('amount', function ($row) {
                $currencySymbol = ($this->payrollSetting->currency ? $this->payrollSetting->currency->currency_symbol : company()->currency->currency_symbol);
                $calculation = '';
                $hourlyRate = $row->user->employeeDetail->overtime_hourly_rate;

                $minutes = round(((($row->hours * 60) + $row->minutes) / 60), 1);

                // Determine hourly rate based on request type
                if ($row->type == 'working') {
                    if ($row->policy->payCode->fixed == 1) {
                        $calculation = '('. $row->regular_fixed_amount .' '.__('payroll::app.fixed') .') * '. $minutes;
                    }
                    else {
                        $calculation = '( '.$hourlyRate.' ( *'. $row->policy->payCode->regular_time_rate .' '.__('payroll::app.times') .') * '. $minutes.')';
                    }
                }
                elseif ($row->type == 'holiday') {
                    if ($row->policy->payCode->fixed == 1) {
                        $calculation = '('. $row->holiday_fixed_amount  .' '.__('payroll::app.fixed') .') * '. $minutes;
                    }
                    else {
                        $calculation = '( '.$row->policy->payCode->holiday_time_rate .' '.__('payroll::app.times') .') * '. $minutes.')';
                    }

                }
                elseif ($row->type == 'dayoff') {
                    if ($row->policy->payCode->fixed == 1) {
                        $calculation = '( '.$row->day_off_fixed_amount  .' '.__('payroll::app.fixed') .') * '. $minutes;
                    }
                    else {
                        $calculation = '( '.$hourlyRate.' ( *'. $row->policy->payCode->day_off_time_rate .' '.__('payroll::app.times') .') * '. $minutes.')';
                    }
                }

                return $currencySymbol.' '.$row->amount.' '.$calculation;
            })

            ->addIndexColumn()
            ->rawColumns(['action', 'overtime_reason', 'status', 'hours']);
    }

    /**
     * Get query source of dataTable.
     *
     * @param  $model
     * @return \Illuminate\Database\Eloquent\Builder
     */
    //phpcs:ignore
    public function query(OvertimeRequest $model)
    {
        $request = $this->request();

        $roleId = self::getUserSecondRole();

        $overtimeRequest = $model->with('actionBy', 'user', 'company', 'policy', 'policy.payCode')
            ->select('overtime_requests.*', 'users.name', 'users.email as user_email', 'actionby.email', 'actionby.name as actionByName', 'pay_codes.fixed', 'pay_codes.fixed_amount', 'pay_codes.regular_fixed_amount',
            'pay_codes.regular_time_rate', 'pay_codes.weekend_fixed_amount', 'pay_codes.weekend_time_rate', 'pay_codes.holiday_fixed_amount', 'pay_codes.day_off_fixed_amount', 'pay_codes.holiday_time_rate', 'employee_details.overtime_hourly_rate')
            ->leftJoin('users', 'users.id', '=', 'overtime_requests.user_id')
            ->leftJoin('overtime_policy_employees', 'users.id', '=', 'overtime_policy_employees.user_id')
            ->leftJoin('overtime_policies', 'overtime_policies.id', '=', 'overtime_policy_employees.overtime_policy_id')
            ->leftJoin('pay_codes', 'pay_codes.id', '=', 'overtime_policies.pay_code_id')
            ->leftJoin('employee_details', 'users.id', '=', 'employee_details.user_id')
            ->leftJoin('users as actionby', 'actionby.id', '=', 'overtime_requests.action_by');

        if (!in_array('admin', user_roles()))
        {

            $overtimeRequest = $overtimeRequest->where(function ($query) use ($roleId) {
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

        if ($request->designation != 'all' && $request->designation != '') {
            $overtimeRequest = $overtimeRequest->where('employee_details.designation_id', $request->designation);
        }

        if ($request->year != 'all' && $request->year != '') {
            $overtimeRequest = $overtimeRequest->whereYear('overtime_requests.date', $request->year);
        }

        if ($request->month != 'all' && $request->month != '') {
            $overtimeRequest = $overtimeRequest->whereMonth('overtime_requests.date', $request->month);
        }

        if ($request->employee != 'all' && $request->employee != '') {
            $overtimeRequest = $overtimeRequest->whereMonth('overtime_requests.user_id', $request->employee);
        }

        return $overtimeRequest->groupBy('overtime_requests.id');
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        return parent::setBuilder('overtime-request')
            ->parameters([
                'initComplete' => 'function () {
                    window.LaravelDataTables["overtime-request"].buttons().container()
                     .appendTo( "#table-actions")
                 }',
                'fnDrawCallback' => 'function( oSettings ) {
                   //
                   $(".select-picker").selectpicker();
                    $("body").tooltip({
                        selector: \'[data-toggle="tooltip"]\'
                    })
                 }',
            ]);
    }

    /**
     * Get columns.
     *
     * @return array
     */
    protected function getColumns()
    {
        return [
            __('app.employee') => ['data' => 'user_id', 'name' => 'user_id', 'exportable' => false, 'title' => __('app.employee')],
            __('payroll::modules.payroll.requestDate') => ['data' => 'created_at', 'name' => 'created_at', 'title' => __('payroll::modules.payroll.requestDate')],
            __('payroll::modules.payroll.overtimeDate') => ['data' => 'date', 'name' => 'date', 'title' => __('payroll::modules.payroll.overtimeDate')],
            __('payroll::modules.payroll.duration') => ['data' => 'hours', 'name' => 'hours', 'title' => __('payroll::modules.payroll.duration')],
            __('app.reason') => ['data' => 'overtime_reason', 'name' => 'overtime_reason', 'title' => __('app.reason')],
            __('app.amount') => ['data' => 'amount', 'name' => 'amount', 'title' => __('app.amount')],

            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->addClass('text-right pr-20')
        ];
    }

    static public function getUserSecondRole()
    {
        $roles = Role::all();

        $roleIds = user()->roles()->pluck('role_id')->toArray();

        if(count($roleIds) > 1){
            if(isset($roleIds[1]))
            {
                $userRole = $roles->filter(function ($value, $key) use ($roleIds) {
                    return $value->id == $roleIds[1];
                })->first();

                $userSecondRole = ($userRole->name != 'employee') ? $roleIds[1] : $roleIds[0];

            }
            else{
                $userSecondRole = $roleIds[0];
            }
        }
        else{
            $userSecondRole = $roleIds[0];
        }

        return $userSecondRole;
    }

}
