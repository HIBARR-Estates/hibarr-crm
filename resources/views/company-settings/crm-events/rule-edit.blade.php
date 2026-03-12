@extends('layouts.app')

@section('content')

    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        {{ isset($businessRule->id) ? __('app.edit') . ' Business Rule' : __('app.addNew') . ' Business Rule' }}
                    </h2>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
                @if(isset($businessRule->id))
                    <input type="hidden" id="form-action-url" value="{{ route('crm-business-rules.update', $businessRule->id) }}">
                    <input type="hidden" id="form-method" value="PUT">
                @else
                    <input type="hidden" id="form-action-url" value="{{ route('crm-business-rules.store') }}">
                    <input type="hidden" id="form-method" value="POST">
                @endif

                <div class="alert alert-info mb-4">
                    <h5 class="alert-heading f-14 font-weight-bold"><i class="fa fa-info-circle"></i> Business Rules</h5>
                    <p class="mb-0 f-13">
                        Business rules define the configuration for how certain event types are processed.
                        The rule config is a JSON object that the CRM Event Engine uses to apply special handling,
                        such as auto-creating leads, linking properties, or tracking visitor behavior.
                    </p>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.text fieldId="name" :fieldLabel="__('app.name')" fieldName="name"
                                      fieldRequired="true" :fieldValue="$businessRule->name ?? ''"
                                      fieldPlaceholder="e.g. Site Visitor Property View" />
                    </div>
                    <div class="col-md-6">
                        <x-forms.text fieldId="slug" fieldLabel="Slug" fieldName="slug"
                                      fieldRequired="true" :fieldValue="$businessRule->slug ?? ''"
                                      fieldPlaceholder="e.g. site_visitor_property_view" />
                        <small class="text-muted f-11">Auto-generated from name. Use lowercase letters, numbers, and underscores.</small>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <x-forms.textarea fieldId="description" fieldLabel="Description" fieldName="description"
                                          :fieldValue="$businessRule->description ?? ''"
                                          fieldPlaceholder="Describe what this business rule does" />
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <div class="form-group my-3">
                            <label class="f-14 text-dark-grey mb-1" for="rule_config">
                                Rule Configuration (JSON) 
                            </label>
                            <textarea id="rule_config" name="rule_config" rows="8"
                                      class="form-control f-14"
                                      style="font-family: monospace; font-size: 12px;"
                                      placeholder='{
    "auto_create_lead": true,
    "link_to_property": true,
    "notify_agent": true,
    "assign_to": "property_agent"
}'>{{ isset($businessRule->id) && $businessRule->rule_config ? json_encode($businessRule->rule_config, JSON_PRETTY_PRINT) : '' }}</textarea>
                            <small class="text-muted f-11">
                                Define the rule behavior as a JSON object. Common keys:
                                <code>auto_create_lead</code>, <code>link_to_property</code>,
                                <code>notify_agent</code>, <code>assign_to</code>,
                                <code>track_duration</code>, <code>create_contact</code>.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group my-3">
                            <x-forms.checkbox fieldId="is_active" :fieldLabel="__('app.active')" fieldName="is_active"
                                              :checked="$businessRule->is_active ?? true" />
                        </div>
                    </div>
                </div>
            </div>

            <x-slot name="action">
                <div class="w-100 border-top-grey">
                    <x-setting-form-actions>
                        <x-forms.button-primary id="save-rule" icon="check">@lang('app.save')</x-forms.button-primary>
                        <x-forms.button-cancel :link="route('company-settings.crm_events') . '?tab=rules'" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
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
        $('#save-rule').click(function () {
            // Validate rule_config JSON if provided
            var config = $('#rule_config').val().trim();
            if (config) {
                try {
                    JSON.parse(config);
                } catch (e) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Invalid JSON',
                        text: 'Rule Configuration must be valid JSON: ' + e.message
                    });
                    return;
                }
            }

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
                buttonSelector: "#save-rule",
                data: $.param(formData),
                redirect: true
            });
        });
    </script>
@endpush
