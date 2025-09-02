<div class="align-items-center d-flex flex-column text-lightest p-20 w-100">
    <i class="fa fa-{{ $icon }} f-21 w-100"></i>


    <a class="{{ $linkClass }}" href="{{ $linkHref }}" id="{{ $id }}" @if(!empty($target)) target="{{ $target }}" @endif   {{ $attributes }} >{{ $linkText }} </a>
</div>
