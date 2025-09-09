@if (
    !in_array('client', user_roles()) &&
        in_array(\Modules\Letter\Entities\LetterSetting::MODULE_NAME, user_modules()) &&
        (user()->permission('view_letter') != 'none' || user()->permission('view_template') != 'none'))
    <x-menu-item icon="file" :text="__('letter::app.menu.letter')" :addon="App::environment('demo')">
        <x-slot name="iconPath">
            <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512">
                <path
                    d="M64 112c-8.8 0-16 7.2-16 16v22.1L220.5 291.7c20.7 17 50.4 17 71.1 0L464 150.1V128c0-8.8-7.2-16-16-16H64zM48 212.2V384c0 8.8 7.2 16 16 16H448c8.8 0 16-7.2 16-16V212.2L322 328.8c-38.4 31.5-93.7 31.5-132 0L48 212.2zM0 128C0 92.7 28.7 64 64 64H448c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128z" />
            </svg>
        </x-slot>


        <div class="accordionItemContent">
            @if (user()->permission('view_letter') != 'none')
                <x-sub-menu-item :link="route('letter.generate.index')" :text="__('letter::app.menu.generate')" />
            @endif
            @if (user()->permission('view_template') != 'none')
                <x-sub-menu-item :link="route('letter.template.index')" :text="__('letter::app.menu.template')" />
            @endif
        </div>
    </x-menu-item>
@endif
