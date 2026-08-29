@php
    $isModal = $isModal ?? false;
@endphp
<button type="button" class="btn btn-outline-secondary rounded f-14 p-2 mr-2 d-none" id="wizard-back-btn"><i class="fa fa-arrow-left mr-1"></i>Back</button>
<x-forms.button-primary id="save-email-template" icon="arrow-right">Next</x-forms.button-primary>
@if($isModal)
    <button type="button" class="btn-cancel rounded f-14 p-2" data-dismiss="modal">@lang('app.cancel')</button>
@else
    <x-forms.button-cancel :link="route('email-templates.index')" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
@endif
