@php
    $viewPerformancePermission = user()->permission('view_performance_module');
@endphp

@if (module_enabled('Performance') && in_array(\Modules\Performance\Entities\PerformanceSetting::MODULE_NAME, user_modules()) && $viewPerformancePermission == 'all')
<x-menu-item icon="wallet" text="Performance" :addon="App::environment('demo')">
    <x-slot name="iconPath">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M3 12h2v8H3zm4-4h2v12H7zm4-4h2v16h-2zm4 6h2v10h-2zm4-2h2v12h-2z"/>
        </svg>
    </x-slot>

    <div class="accordionItemContent pb-2">
        <x-sub-menu-item :link="route('performance-dashboard.index')" :text="__('app.menu.dashboard')"/>
        <x-sub-menu-item :link="route('objectives.index')" :text="__('performance::app.objective')"/>
        <x-sub-menu-item :link="route('okr-scoring.index')" :text="__('performance::app.okrScoring')"/>
        <x-sub-menu-item :link="route('meetings.index')" :text="__('performance::app.oneOnOnemeetings')"/>
    </div>
</x-menu-item>
@endif
