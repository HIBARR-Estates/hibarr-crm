@php
    $manageSettingPermission = user()->permission('manage_performance_setting');
@endphp

@if (
    !in_array('client', user_roles()) &&
    module_enabled('Performance') &&
    $manageSettingPermission == 'all' &&
    in_array(\Modules\Performance\Entities\PerformanceSetting::MODULE_NAME, user_modules())
)
    <x-setting-menu-item
        :active="$activeMenu"
        menu="performance_settings"
        :href="route('performance-settings.index')"
        :text="__('performance::app.performanceSettings')"
    />
@endif
