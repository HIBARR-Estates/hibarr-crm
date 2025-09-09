@if (in_array(\Modules\Zoom\Entities\ZoomSetting::MODULE_NAME, user_modules()) && in_array('admin', user_roles()))
    <x-setting-menu-item :active="$activeMenu" menu="zoom_settings" :href="route('zoom-settings.index')"
                         :text="__('zoom::app.menu.zoomSetting')"/>
@endif
