<x-form id="create-trigger" method="POST" class="ajax-form">
    <div class="modal-header">
        <h5 class="modal-title" id="modelHeading">@lang('app.add') @lang('app.menu.metaConversionTriggers')</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">×</span>
        </button>
    </div>

    <div class="modal-body">
        <div class="portlet-body">
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-12">
                        <x-forms.select fieldId="lead_pipeline_id" :fieldLabel="__('modules.deal.pipeline')"
                            fieldName="lead_pipeline_id" fieldRequired="true">
                            <option value="">--</option>
                            @foreach($pipelines as $pipeline)
                                <option value="{{ $pipeline->id }}">{{ $pipeline->name }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-12">
                        <x-forms.select fieldId="lead_pipeline_stage_id" :fieldLabel="__('modules.deal.leadStage')"
                            fieldName="lead_pipeline_stage_id" fieldRequired="true">
                            <option value="">--</option>
                            @foreach($stages as $stage)
                                <option value="{{ $stage->id }}" data-pipeline-id="{{ $stage->lead_pipeline_id }}">
                                    {{ $stage->name }}
                                </option>
                            @endforeach
                        </x-forms.select>
                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-12">
                        <x-forms.text fieldId="event_name" :fieldLabel="__('app.menu.eventName')"
                            fieldName="event_name" fieldRequired="true" 
                            fieldPlaceholder="e.g., Purchase, Lead, InitiateCheckout">
                        </x-forms.text>
                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-12">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="value" :fieldLabel="__('app.value')" />
                            <input type="number" name="value" id="value" 
                                class="form-control height-35 f-14" 
                                value="0" step="0.01" min="0" placeholder="0.00">
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-12">
                        <input type="hidden" name="active" value="0">
                        <x-forms.checkbox :fieldLabel="__('app.status')" fieldName="active" fieldId="active"
                            fieldValue="1" :checked="true" />
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
        <x-forms.button-primary id="save-trigger" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

<script>
    // Filter stages based on selected pipeline
    $('#lead_pipeline_id').on('change', function() {
        var pipelineId = $(this).val();
        var stageSelect = $('#lead_pipeline_stage_id');
        
        // Hide all options first
        stageSelect.find('option').hide();
        stageSelect.find('option[value=""]').show(); // Show empty option
        
        if (pipelineId) {
            // Show only stages for selected pipeline
            stageSelect.find('option[data-pipeline-id="' + pipelineId + '"]').show();
        }
        
        // Reset selection
        stageSelect.val('').selectpicker('refresh');
    });

    // Initialize selectpicker
    $('#lead_pipeline_id, #lead_pipeline_stage_id').selectpicker();

    // Save trigger
    $('#save-trigger').click(function() {
        $.easyAjax({
            url: "{{ route('meta-conversion-triggers.store') }}",
            container: '#create-trigger',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-trigger",
            data: $('#create-trigger').serialize(),
            success: function(response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        });
    });
</script>

