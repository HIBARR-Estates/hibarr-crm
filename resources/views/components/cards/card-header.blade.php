@props(['customFieldCategories' => null])
<div class="card-header bg-white border-0  flex flex-wrap justify-between pt-4 gap-4 px-0">
    <h4 class="f-18 f-w-500 mb-0">{{ $slot }}</h4>
    <div class="flex items-center gap-4">
        @if ($customFieldCategories)
            {!! $customFieldCategories !!}
        @endif

        @if ($action)
            {!! $action !!}
        @endif
    </div>
</div>
