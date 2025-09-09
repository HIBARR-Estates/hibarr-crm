@if (!in_array('client', user_roles()) && (user()->permission('manage_salary_payment_method') == 'all' || user()->permission('manage_salary_component') == 'all' || user()->permission('manage_salary_group') == 'all' || user()->permission('manage_salary_tds') == 'all'))
    @if(in_array(\Modules\Payroll\Entities\PayrollSetting::MODULE_NAME, user_modules()))
        <x-setting-menu-item :active="$activeMenu" menu="payroll_settings" :href="route('payroll.payroll_settings')"
                             :text="__('payroll::app.menu.payrollSettings')"/>
        <x-setting-menu-item :active="$activeMenu" menu="overtime_settings" :href="route('payroll.overtime_settings')"
                             :text="__('payroll::app.menu.overtimeSettings')"/>
    @endif
@endif
