@extends('layouts.app')

@section('content')

    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @if(isset($template->id))
                            @lang('app.edit') — {{ $template->name }}
                        @else
                            @lang('app.addNew') @lang('app.menu.emailTemplates')
                        @endif
                    </h2>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 email-template-wizard">
                @include('company-settings.email-template.partials.wizard-content', ['template' => $template])
            </div>

            <x-slot name="action">
                <div class="w-100 border-top-grey">
                    <x-setting-form-actions>
                        @include('company-settings.email-template.partials.wizard-actions', ['isModal' => false])
                    </x-setting-form-actions>
                </div>
            </x-slot>

        </x-setting-card>

    </div>

    @include('company-settings.email-template.partials.preview-modal')

@endsection

@push('styles')
    @include('company-settings.email-template.partials.wizard-styles')
@endpush

@push('scripts')
    @include('company-settings.email-template.partials.wizard-scripts', ['template' => $template, 'isModal' => false])
    @include('company-settings.email-template.partials.preview-modal-scripts')
@endpush
