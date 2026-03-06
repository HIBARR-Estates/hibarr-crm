@extends('layouts.app')

@section('content')

    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        {{ isset($category->id) ? __('app.edit') . ' Category' : __('app.addNew') . ' Category' }}
                    </h2>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
                @if(isset($category->id))
                    <input type="hidden" id="form-action-url" value="{{ route('crm-event-categories.update', $category->id) }}">
                    <input type="hidden" id="form-method" value="PUT">
                @else
                    <input type="hidden" id="form-action-url" value="{{ route('crm-event-categories.store') }}">
                    <input type="hidden" id="form-method" value="POST">
                @endif

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.text fieldId="name" :fieldLabel="__('app.name')" fieldName="name"
                                      fieldRequired="true" :fieldValue="$category->name ?? ''"
                                      fieldPlaceholder="e.g. Communication" />
                    </div>
                    <div class="col-md-6">
                        <x-forms.text fieldId="slug" fieldLabel="Slug" fieldName="slug"
                                      fieldRequired="true" :fieldValue="$category->slug ?? ''"
                                      fieldPlaceholder="e.g. communication" />
                        <small class="text-muted f-11">Auto-generated from name. Use lowercase letters, numbers, and underscores.</small>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <x-forms.textarea fieldId="description" fieldLabel="Description" fieldName="description"
                                          :fieldValue="$category->description ?? ''"
                                          fieldPlaceholder="Brief description of this event category" />
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group my-3">
                            <x-forms.checkbox fieldId="is_active" :fieldLabel="__('app.active')" fieldName="is_active"
                                              :checked="$category->is_active ?? true" />
                        </div>
                    </div>
                </div>
            </div>

            <x-slot name="action">
                <div class="w-100 border-top-grey">
                    <x-setting-form-actions>
                        <x-forms.button-primary id="save-category" icon="check">@lang('app.save')</x-forms.button-primary>
                        <x-forms.button-cancel :link="route('company-settings.crm_events')" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
                    </x-setting-form-actions>
                </div>
            </x-slot>

        </x-setting-card>

    </div>

@endsection

@push('scripts')
    <script>
        // Auto-generate slug from name
        $('#name').on('keyup blur', function () {
            var slug = $(this).val()
                .toLowerCase()
                .replace(/[^a-z0-9\s_-]/g, '')
                .replace(/[\s-]+/g, '_')
                .replace(/^_+|_+$/g, '');
            $('#slug').val(slug);
        });

        // Save form
        $('#save-category').click(function () {
            var formData = $('#editSettings').serializeArray();
            formData = formData.filter(function (item) { return item.name !== '_method'; });

            var method = $('#form-method').val();
            if (method === 'PUT') {
                formData.push({ name: '_method', value: 'PUT' });
            }

            $.easyAjax({
                url: $('#form-action-url').val(),
                container: '#editSettings',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-category",
                data: $.param(formData),
                redirect: true
            });
        });
    </script>
@endpush
