<div class="modal-header">
    <h5 class="modal-title"><i class="fa fa-comment-alt mr-2"></i> @lang('performance::app.addDiscussionPoint')</h4>
    </h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>

<x-form id="save-discussion-form">
    <div class="modal-body">
        <div class="portlet-body"></div>
        <div class="row">
            <input type="hidden" name="send_mail" id="send_mail" value="no">
            <input type="hidden" name="tab" id="tab" value="list">
            <input type="hidden" name="meeting_id" id="meeting_id" value="{{ $meeting->id }}">
            <div class="col-md-9">
                <x-forms.text fieldId="discussion_point" :fieldLabel="__('performance::app.discussionPoint')" fieldName="discussion_point" :fieldRequired="true" :fieldPlaceholder="__('performance::app.discussionPoint')">
                </x-forms.text>
            </div>
            <div class="col-md-3 mt-5">
                <x-forms.checkbox class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('performance::app.keepPrivate')"
                    fieldName="keep_private" fieldId="keep_private" fieldValue="yes"
                    fieldRequired="true" :checked='true'/>
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
        <x-forms.button-primary id="save-discussion" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

<script>
    $('#save-discussion').click(function() {
        var url = "{{ route('agenda.store') }}";
        var data = $('#save-discussion-form').serialize();

        if (url) {
            $.easyAjax({
                url: url,
                container: '#save-discussion-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                data: data,
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
