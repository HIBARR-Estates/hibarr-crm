<link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-colorpicker.css') }}" />

<style>
    #lifecycleColorpicker .form-group {
        width: 87%;
    }
</style>

<x-form id="editLeadLifecycleStatus" method="PUT" class="ajax-form">
    <div class="modal-header">
        <h5 class="modal-title" id="modelHeading">@lang('modules.lead.editLifecycleStatus')</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">×</span>
        </button>
    </div>
    <div class="modal-body">
        <div class="portlet-body">
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-12 mb-3">
                        <x-forms.text fieldId="lifecycle_key" :fieldLabel="__('modules.lead.lifecycleStatusKey')"
                            fieldName="key" :fieldValue="$lifecycleStatus->key" fieldReadOnly="true">
                        </x-forms.text>
                        <small class="text-muted">@lang('modules.lead.lifecycleStatusKeyImmutable')</small>
                    </div>

                    <div class="col-lg-12">
                        <x-forms.text fieldId="label" :fieldLabel="__('app.status')"
                            fieldName="label" :fieldValue="$lifecycleStatus->label" fieldRequired="true">
                        </x-forms.text>
                    </div>

                    <div class="col-lg-12">
                        <x-forms.textarea fieldId="description" :fieldLabel="__('app.description')"
                            fieldName="description" :fieldValue="$lifecycleStatus->description">
                        </x-forms.textarea>
                    </div>

                    <div class="col-lg-6">
                        <div id="lifecycleColorpicker" class="input-group">
                            <div class="form-group my-3 text-left">
                                <x-forms.label fieldId="label_color" :fieldLabel="__('modules.tasks.labelColor')"
                                    fieldRequired="true">
                                </x-forms.label>
                                <x-forms.input-group>
                                    <input type="text" name="label_color" id="label_color"
                                        value="{{ $lifecycleStatus->label_color }}"
                                        class="form-control height-35 f-15 light_text">
                                    <x-slot name="append">
                                        <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                                    </x-slot>
                                </x-forms.input-group>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-6">
                        <x-forms.number fieldId="sort_order" :fieldLabel="__('modules.tasks.position')"
                            fieldName="sort_order" :fieldValue="$lifecycleStatus->sort_order"
                            fieldRequired="true" minValue="0" maxValue="999">
                        </x-forms.number>
                    </div>

                    @if($lifecycleStatus->leads_count > 0)
                        <div class="col-lg-12">
                            <div class="alert alert-warning mb-0">
                                @lang('modules.lead.lifecycleStatusInUseWarning', ['count' => $lifecycleStatus->leads_count])
                            </div>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
        <x-forms.button-primary id="save-lifecycle-status" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

<script>
    $('#lifecycleColorpicker').colorpicker({ "color": "{{ $lifecycleStatus->label_color }}" });

    $('#save-lifecycle-status').click(function() {
        $.easyAjax({
            url: "{{ route('lead-lifecycle-status-settings.update', $lifecycleStatus->id) }}",
            container: '#editLeadLifecycleStatus',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-lifecycle-status",
            data: $('#editLeadLifecycleStatus').serialize(),
            success: function(response) {
                if (response.status == "success") {
                    window.location.href = "{{ route('lead-settings.index') }}?tab=lifecycle";
                }
            }
        });
    });
</script>
