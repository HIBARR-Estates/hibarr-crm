<div class="modal-header">
    <h5 class="modal-title"><i class="fas fa-comment-alt mr-2"></i> @lang('performance::app.editActionPoint')</h4>
    </h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>

<x-form id="update-action-form">
    @method('PUT')
    <div class="modal-body">
        <div class="portlet-body"></div>
        <div class="row">
            <div class="col-md-12">
                <x-forms.text fieldId="action_point" :fieldLabel="__('performance::app.actionPoint')" :fieldValue="$action->action_point" fieldName="action_point" :fieldRequired="true" :fieldPlaceholder="__('performance::app.actionPoint')"></x-forms.text>
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
        <x-forms.button-primary id="update-action" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

<script>
    $('#update-action').click(function() {
        let id = "{{ $action->id }}";
        var url = "{{ route('action.update', ':id') }}";
        url = url.replace(':id', id);

        if (url) {
            $.easyAjax({
                url: url,
                container: '#update-action-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                data: $('#update-action-form').serialize(),
                success: function(response) {
                    if (response.status == "success") {

                        $('#nav-tabContent').html('');
                        $('#nav-tabContent').html(response.html);

                        $.easyUnblockUI();
                        $(MODAL_LG).modal('hide');
                    }
                }
            });
        }
    });
</script>
