@if (!in_array('client', user_roles()) && user()->permission('view_payroll') != 'none' && in_array(\Modules\Payroll\Entities\PayrollSetting::MODULE_NAME, user_modules()))
    <x-menu-item icon="wallet" :text="__('payroll::app.menu.payroll')" :addon="App::environment('demo')">
        <x-slot name="iconPath">
            <path
                d="M0 3a2 2 0 0 1 2-2h13.5a.5.5 0 0 1 0 1H15v2a1 1 0 0 1 1 1v8.5a1.5 1.5 0 0 1-1.5 1.5h-12A2.5 2.5 0 0 1 0 12.5V3zm1 1.732V12.5A1.5 1.5 0 0 0 2.5 14h12a.5.5 0 0 0 .5-.5V5H2a1.99 1.99 0 0 1-1-.268zM1 3a1 1 0 0 0 1 1h12V2H2a1 1 0 0 0-1 1z"/>
        </x-slot>

        <div class="accordionItemContent pb-2">
            <x-sub-menu-item :link="route('payroll.index')" :text="__('payroll::app.menu.payroll')"/>
            <x-sub-menu-item :link="route('employee-salary.index')"
                            :text="__('payroll::app.menu.employeeSalary')"
                            :permission="user()->permission('manage_employee_salary') == 'all'"
            />
            <x-sub-menu-item :link="route('payroll-expenses.index')" :text="__('payroll::app.payrollExpenses')"/>
            <x-sub-menu-item :link="route('overtime-requests.index')" :text="__('payroll::modules.payroll.overtimeRequest')"/>
            @if (in_array('admin', user_roles()))
                <x-sub-menu-item :link="route('payroll-reports.index')" :text="__('app.menu.reports')"/>
            @endif
        </div>
    </x-menu-item>
@endif
