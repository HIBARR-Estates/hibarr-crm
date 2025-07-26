@props(['customFieldCategories' => null])
<div {{ $attributes->merge(['class' => 'card bg-white border-0 b-shadow-4 overflow-hidden']) }} style="padding: 0 36px;">

    @if ($title)
        <x-cards.card-header>
            {!! $title !!}

            @if ($customFieldCategories)
                <x-slot name="customFieldCategories">
                    {!! $customFieldCategories !!}
                </x-slot>
            @endif

            <x-slot name="action">
                {!! $action !!}
            </x-slot>
        </x-cards.card-header>
    @endif

    @if ($padding === 'false')
        <div class="card-body p-0 {{ $otherClasses }}">
            {{ $slot }}
        </div>
    @else
        <div @class(['card-body', 'pt-2' => $title, $otherClasses])>
            {{ $slot }}
        </div>
    @endif
</div>
