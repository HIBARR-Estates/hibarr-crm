<div class="align-items-center d-flex flex-column text-lightest p-20 w-100 text-center">
    <i class="fa fa-{{ $icon }} f-21 w-100"></i>
    @if (!empty($message))
        <div class="f-14 mt-3 w-100 text-center">{{ $message }}</div>
    @endif



    <a class="btn btn-primary btn-xs {{ $linkClass }}" href="{{ $linkHref }}" 
        @isset($id) 
            id="{{ $id }}" 
        @endisset
        @if (!empty($target)) 
            target="{{ $target }}" 
            @if ($target === '_blank') 
                rel="noopener noreferrer" 
            @endif 
        @endif
        {{ $attributes }}
    >
        {{ $linkText }}
    </a>
</div>
