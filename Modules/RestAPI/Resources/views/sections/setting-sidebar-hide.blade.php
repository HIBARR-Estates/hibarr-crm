@if (user()->permission('manage_test_push_notification') == 'all' && user()->permission('manage_rest_api_settings')  == 'all' && !in_array('client', user_roles()) && in_array(\Modules\RestAPI\Entities\RestAPISetting::MODULE_NAME, user_modules()))
    <x-setting-menu-item :active="$activeMenu" menu="rest_api_setting" :href="route('rest-api-setting.index')"
                         :text="__('restapi::app.menu.restAPISettings')"/>
@endif
