@extends('layouts.app')

@section('content')

    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        {{ isset($eventType->id) ? __('app.edit') . ' Event Type' : __('app.addNew') . ' Event Type' }}
                    </h2>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
                @if(isset($eventType->id))
                    <input type="hidden" id="form-action-url" value="{{ route('crm-event-types.update', $eventType->id) }}">
                    <input type="hidden" id="form-method" value="PUT">
                @else
                    <input type="hidden" id="form-action-url" value="{{ route('crm-event-types.store') }}">
                    <input type="hidden" id="form-method" value="POST">
                @endif

                @if(isset($eventType->id) && $eventType->is_system)
                    <div class="alert alert-warning mb-4">
                        <i class="fa fa-lock mr-1"></i>
                        <strong>System-managed event type.</strong> Name and slug cannot be modified.
                        You can change the category, processing mode, status, and other settings.
                    </div>
                @endif

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.text fieldId="name" :fieldLabel="__('app.name')" fieldName="name"
                                      fieldRequired="true" :fieldValue="$eventType->name ?? ''"
                                      fieldPlaceholder="e.g. Deal Stage Changed"
                                      :fieldReadOnly="isset($eventType->id) && $eventType->is_system" />
                    </div>
                    <div class="col-md-6">
                        <x-forms.text fieldId="slug" fieldLabel="Slug" fieldName="slug"
                                      fieldRequired="true" :fieldValue="$eventType->slug ?? ''"
                                      fieldPlaceholder="e.g. deal_stage_changed"
                                      :fieldReadOnly="isset($eventType->id) && $eventType->is_system" />
                        <small class="text-muted f-11">Auto-generated from name. Use lowercase letters, numbers, and underscores.</small>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.select fieldId="category_id" fieldLabel="Category" fieldName="category_id"
                                        fieldRequired="true">
                            <option value="">-- Select Category --</option>
                            @foreach($categories as $cat)
                                <option value="{{ $cat->id }}"
                                    {{ ($eventType->category_id ?? '') == $cat->id ? 'selected' : '' }}>
                                    {{ $cat->name }}
                                </option>
                            @endforeach
                        </x-forms.select>
                    </div>
                    <div class="col-md-6">
                        <x-forms.select fieldId="business_rule_id" fieldLabel="Business Rule (Optional)"
                                        fieldName="business_rule_id">
                            <option value="">-- None --</option>
                            @foreach($businessRules as $rule)
                                <option value="{{ $rule->id }}"
                                    {{ ($eventType->business_rule_id ?? '') == $rule->id ? 'selected' : '' }}>
                                    {{ $rule->name }}
                                </option>
                            @endforeach
                        </x-forms.select>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.text fieldId="model_type" fieldLabel="Model Type (Optional)" fieldName="model_type"
                                      :fieldValue="$eventType->model_type ?? ''"
                                      fieldPlaceholder="e.g. App\Models\Deal" />
                        <small class="text-muted f-11">The fully-qualified model class this event type applies to.</small>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group my-3 pt-3">
                            <x-forms.checkbox fieldId="sync_processing" fieldLabel="Process Synchronously"
                                              fieldName="sync_processing"
                                              :checked="$eventType->sync_processing ?? false" />
                            <small class="text-muted f-11 d-block mt-1">When checked, events are recorded inline (not queued). Use for critical events only.</small>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <x-forms.textarea fieldId="description" fieldLabel="Description" fieldName="description"
                                          :fieldValue="$eventType->description ?? ''"
                                          fieldPlaceholder="Brief description of this event type" />
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <div class="form-group my-3">
                            <label class="f-14 text-dark-grey mb-1" for="metadata_schema">
                                Metadata Schema (JSON, Optional)
                            </label>
                            <textarea id="metadata_schema" name="metadata_schema" rows="4"
                                      class="form-control f-14"
                                      style="font-family: monospace; font-size: 12px;"
                                      placeholder='{"field_name": "string", "amount": "number"}'>{{ isset($eventType->id) && $eventType->metadata_schema ? json_encode($eventType->metadata_schema, JSON_PRETTY_PRINT) : '' }}</textarea>
                            <small class="text-muted f-11">Define the expected JSON structure for event metadata. Must be valid JSON.</small>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group my-3">
                            <x-forms.checkbox fieldId="is_active" :fieldLabel="__('app.active')" fieldName="is_active"
                                              :checked="$eventType->is_active ?? true" />
                        </div>
                    </div>
                </div>
            </div>

            <x-slot name="action">
                <div class="w-100 border-top-grey">
                    <x-setting-form-actions>
                        <x-forms.button-primary id="save-event-type" icon="check">@lang('app.save')</x-forms.button-primary>
                        <x-forms.button-cancel :link="route('company-settings.crm_events') . '?tab=types'" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
                    </x-setting-form-actions>
                </div>
            </x-slot>

        </x-setting-card>

    </div>

@endsection

@push('scripts')
    <script>
        // Auto-generate slug from name (only for non-system types)
        @if(!(isset($eventType->id) && $eventType->is_system))
        $('#name').on('keyup blur', function () {
            var slug = $(this).val()
                .toLowerCase()
                .replace(/[^a-z0-9\s_-]/g, '')
                .replace(/[\s-]+/g, '_')
                .replace(/^_+|_+$/g, '');
            $('#slug').val(slug);
        });
        @endif

        // Save form
        $('#save-event-type').click(function () {
            // Validate metadata_schema JSON if provided
            var schema = $('#metadata_schema').val().trim();
            if (schema) {
                try {
                    JSON.parse(schema);
                } catch (e) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Invalid JSON',
                        text: 'Metadata Schema must be valid JSON: ' + e.message
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
                buttonSelector: "#save-event-type",
                data: $.param(formData),
                redirect: true
            });
        });
    </script>
@endpush
