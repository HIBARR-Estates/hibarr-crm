<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">{{ ($platform) }} @lang('restapi::app.devices')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="sendPushNotification" method="POST" class="ajax-form">
            <input type="hidden" name="platform" value="{{ $platform }}">
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-12">
                        @if($devices->count())
                            <div class="form-group m-b-10">
                                <div class="form-group my-3">
                                    <label class="f-14 text-dark-grey mb-12 w-100"
                                           for="usr">@lang('restapi::app.selectDevice')</label>
                                    <div class="d-flex">
                                        @foreach($devices as $device)
                                            <x-forms.radio :fieldId="'status_review'.$device->device_id"
                                                           :fieldLabel="$device->device_id"
                                                           fieldName="device_id" :fieldValue="$device->registration_id">
                                            </x-forms.radio>
                                        @endforeach
                                    </div>
                                </div>
                            </div>
                        @else
                            @lang('restapi::app.noRegisterDeviceFound')
                        @endif
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary :disabled="!$devices->count()" id="send-push-notification"
                            icon="check">@lang('app.send')</x-forms.button-primary>
</div>

<script>

    // save source
    $('#send-push-notification').click(function () {
        $.easyAjax({
            url: "{{ route('rest-api.send_push') }}",
            container: '#sendPushNotification',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#send-push-notification",
            data: $('#sendPushNotification').serialize(),
            success: function (response) {
                if (response.status == "success") {
                    $(MODAL_LG).modal('hide');
                }
            }
        })
    });
</script>
