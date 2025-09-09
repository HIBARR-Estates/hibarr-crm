<?php

namespace Modules\Payroll\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\Currency;
use App\Models\EmployeeDetails;
use App\Models\User;
use Illuminate\Http\Request;
use Modules\Payroll\DataTables\EmployeeHourlyDataTable;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Entities\SalaryComponent;
use Modules\Payroll\Entities\SalaryGroup;
use Modules\Payroll\Entities\SalaryPaymentMethod;
use Modules\Payroll\Entities\SalaryTds;

class PayrollSettingController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'payroll::app.menu.payrollSettings';
        $this->activeSettingMenu = 'payroll_settings';
        $this->middleware(function ($request, $next) {
            abort_403(! in_array(PayrollSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    public function index()
    {
        $tab = request('tab');
        $this->payrollSetting = PayrollSetting::first();
        $payrollCurrency = $this->payrollSetting->currency_id;
        $this->payrollCurrency = ($payrollCurrency) ? $payrollCurrency : company()->currency_id;

        switch ($tab) {
        case 'salary-components':
            $this->salaryComponentPermission = user()->permission('manage_salary_component');
            abort_403($this->salaryComponentPermission !== 'all');

            $this->salaryComponents = SalaryComponent::all();
            $this->view = 'payroll::payroll-setting.ajax.salary-components';
            break;

        case 'salary-tds':

            $this->salaryTdsPermission = user()->permission('manage_salary_tds');
            abort_403($this->salaryTdsPermission !== 'all');

            $this->salaryTds = SalaryTds::orderBy('id', 'asc')->get();
            $this->view = 'payroll::payroll-setting.ajax.salary-tds';
            break;

        case 'payment-methods':
            $this->paymentMethodPermission = user()->permission('manage_salary_payment_method');
            abort_403($this->paymentMethodPermission !== 'all');

            $this->paymentMethods = SalaryPaymentMethod::all();
            $this->view = 'payroll::payroll-setting.ajax.payment-methods';
            break;

        case 'salary-groups':
            $this->salaryGroupPermission = user()->permission('manage_salary_group');
            abort_403($this->salaryGroupPermission !== 'all');

            $this->salaryGroups = SalaryGroup::with('components', 'components.component')->withCount('employee')->get();
            $this->view = 'payroll::payroll-setting.ajax.salary-groups';
            break;

        case 'salary-setting':
            $employee = new EmployeeDetails;
            $this->fields = $employee->getCustomFieldGroupsWithFields() && $employee->getCustomFieldGroupsWithFields()->fields ? $employee->getCustomFieldGroupsWithFields()->fields : collect([]);
            $this->extraFields = [];

            if ($this->payrollSetting->extra_fields) {
                $this->extraFields = json_decode($this->payrollSetting->extra_fields);
            }

            $this->view = 'payroll::payroll-setting.ajax.salary-setting';
            break;

        case 'payroll-currency-setting':
            $this->currencies = Currency::all();

            if ($this->payrollSetting->currency_id == null) {
                $this->payrollSetting->currency_id = company()->currency_id;
                $this->payrollSetting->save();
            }

            $this->view = 'payroll::payroll-setting.ajax.payroll-currency-setting';
            break;

        default:
            $this->salaryComponentPermission = user()->permission('manage_salary_component');
            abort_403($this->salaryComponentPermission !== 'all');

            $this->salaryComponents = SalaryComponent::all();
            $this->view = 'payroll::payroll-setting.ajax.salary-components';
            break;

        }

        $this->activeTab = $tab ?: 'salary-components';

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle, 'activeTab' => $this->activeTab]);
        }

        return view('payroll::payroll-setting.index', $this->data);
    }

}
