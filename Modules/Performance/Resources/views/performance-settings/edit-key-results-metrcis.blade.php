<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.edit') @lang('performance::app.keyResultsMetrics')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="editKeyResultsForm" method="POST" class="ajax-form">
            @csrf
            @method('PUT')
            <input type="hidden" name="id" value="{{ $keyResults->id }}">

            <div class="form-body">
                <div class="row">
                    <div class="col-lg-12">
                        <x-forms.text :fieldLabel="__('performance::modules.metricsName')" fieldName="name" fieldId="name" :fieldPlaceholder="__('performance::modules.metricsName')" fieldRequired="true" :fieldValue="$keyResults->name"/>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="save-key-result" icon="check">@lang('app.update')</x-forms.button-primary>
</div>

<script>
    $("#key_results_metrics").selectpicker();

    // save edited key result
    $('#save-key-result').click(function() {
        $.easyAjax({
            url: "{{ route('key-results-metrics.update', $keyResults->id) }}",
            container: '#editKeyResultsForm',
            type: "POST",
            redirect: true,
            file: true,
            data: $('#editKeyResultsForm').serialize(),
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-key-result",
            success: function (response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        });
    });
</script>
