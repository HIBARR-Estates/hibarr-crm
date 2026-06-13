<link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-colorpicker.css') }}" />

<style>
    #lifecycleColorpickerCreate .form-group {
        width: 87%;
    }
</style>

<x-form id="addLeadLifecycleStatus" method="POST" class="ajax-form">
    <div class="modal-header">
        <h5 class="modal-title" id="modelHeading">@lang('modules.lead.addLifecycleStatus')</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">×</span>
        </button>
    </div>
    <div class="modal-body">
        <div class="portlet-body">
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-12">
                        <x-forms.text fieldId="key" :fieldLabel="__('modules.lead.lifecycleStatusKey')"
                            fieldName="key" fieldRequired="true"
                            :fieldPlaceholder="__('modules.lead.lifecycleStatusKeyPlaceholder')">
                        </x-forms.text>
                        <small class="text-muted">@lang('modules.lead.lifecycleStatusKeyCreateHelp')</small>
                    </div>

                    <div class="col-lg-12">
                        <x-forms.text fieldId="label" :fieldLabel="__('app.status')"
                            fieldName="label" fieldRequired="true">
                        </x-forms.text>
                    </div>

                    <div class="col-lg-12">
                        <x-forms.textarea fieldId="description" :fieldLabel="__('app.description')"
                            fieldName="description">
                        </x-forms.textarea>
                    </div>

                    <div class="col-lg-6">
                        <div id="lifecycleColorpickerCreate" class="input-group">
                            <div class="form-group my-3 text-left">
                                <x-forms.label fieldId="label_color" :fieldLabel="__('modules.tasks.labelColor')"
                                    fieldRequired="true">
                                </x-forms.label>
                                <x-forms.input-group>
                                    <input type="text" name="label_color" id="label_color"
                                        value="#6c757d"
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
                            fieldName="sort_order" :fieldValue="$nextSortOrder"
                            fieldRequired="true" minValue="0" maxValue="999">
                        </x-forms.number>
                    </div>
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
    $('#lifecycleColorpickerCreate').colorpicker({ "color": "#6c757d" });

    $('#save-lifecycle-status').click(function() {
        $.easyAjax({
            url: "{{ route('lead-lifecycle-status-settings.store') }}",
            container: '#addLeadLifecycleStatus',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-lifecycle-status",
            data: $('#addLeadLifecycleStatus').serialize(),
            success: function(response) {
                if (response.status == "success") {
                    window.location.href = "{{ route('lead-settings.index') }}?tab=lifecycle";
                }
            }
        });
    });
</script>
