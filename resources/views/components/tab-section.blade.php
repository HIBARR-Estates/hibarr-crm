<div {{ $attributes->merge(['class' => 's-b-n-header']) }} id="tabs">
    <nav class="tabs px-4 border-bottom-grey">
        <div class="nav d-flex justify-content-between align-items-center" id="nav-tab" role="tablist">
            <div class="d-flex align-items-center">
                {{ $slot }}
            </div>
            @isset($action)
                <div>
                    {{ $action }}
                </div>
            @endisset
        </div>
    </nav>
</div>