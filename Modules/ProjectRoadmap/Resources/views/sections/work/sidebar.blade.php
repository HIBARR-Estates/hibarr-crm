@if (in_array('projects', user_modules()) && user()->permission('view_projects') != 'none')
    <x-sub-menu-item :link="route('projectroadmap.index')"
                     :text="__('projectroadmap::app.menu.projectRoadmap')"
                     :addon="App::environment('demo')"
    />
@endif

