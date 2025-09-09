@if (in_array('admin', user_roles()))
    <x-setting-menu-item :active="$activeMenu" menu="cybersecurity" :href="route('cybersecurity.index')"
        :text="__('cybersecurity::app.menu.cybersecurity')"/>
@endif
