<div class="modal-header">
    <h5 class="modal-title">@lang('cybersecurity::app.addBlacklistIp')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<x-form id="blacklist-ip-form" method="POST" class="ajax-form">
    <div class="modal-body">
        <div class="row">
            <div class="col-sm-12">
                <x-forms.text fieldId="ip_address" :fieldLabel="__('cybersecurity::app.blacklistIp')"
                    fieldName="ip_address" fieldRequired="true" :fieldPlaceholder="__('cybersecurity::placeholders.ip')">
                </x-forms.text>
            </div>

        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
        <x-forms.button-primary id="save-blacklist-ip" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>


<script>

    $('#save-blacklist-ip').click(function () {
        $.easyAjax({
            container: '#blacklist-ip-form',
            type: "POST",
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-blacklist-ip",
            url: "{{ route('cybersecurity.blacklist-ip.store') }}",
            data: $('#blacklist-ip-form').serialize(),
            success: function (response) {
                if (response.status === 'success') {
                    window.location.reload();
                }
            }
        })
    });
</script>
