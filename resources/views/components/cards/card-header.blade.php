@props(['customFieldCategories' => null])
<div class="card-header bg-white border-0 flex flex-col flex-wrap justify-start pt-4 gap-4">
    <div class="flex items-center gap-4 w-full justify-between mb-4">
        <h4 class="f-18 f-w-500">{{ $slot }}</h4>
         @if ($action)
            {!! $action !!}
        @endif

    </div>
    <div class="flex items-center gap-4">
        @if ($customFieldCategories)
            {!! $customFieldCategories !!}
        @endif

       
    </div>
</div>
