<div class="modal-header">
    <h5 class="modal-title">@lang('biolinks::app.addYoutube')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<x-form id="create-block" method="POST" class="ajax-form">
    <div class="modal-body">
        <div class="row">
            <input type="hidden" name="biolink_id" value="{{ $biolinkId }}">
            <input type="hidden" name="type" value="youtube">
            <div class="col-sm-12">
                <x-forms.url fieldId="url" :fieldLabel="__('biolinks::app.youtube') . ' ' . __('app.url')" fieldName="url"
                              fieldRequired="true" :fieldPlaceholder="__('placeholders.website')">
                </x-forms.url>
            </div>

        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="mr-3 border-0">@lang('app.close')</x-forms.button-cancel>
        <x-forms.button-primary id="save-block" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>


<script>

    $('#save-block').on('click', function () {
        var url = "{{ route('biolink-blocks.store') }}";
        $.easyAjax({
            url: url,
            container: '#create-block',
            type: "POST",
            data: $('#create-block').serialize(),
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-block",
            success: function (response) {
                if (response.status == 'success') {
                    $(MODAL_LG).modal('hide');
                    $(RIGHT_MODAL).modal('hide');
                    localStorage.setItem('activeTab', 'blocks');
                    window.location.href= response.redirectUrl;
                }
            }
        })
    });
</script>
