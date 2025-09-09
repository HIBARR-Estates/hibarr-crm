<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">Test Message</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="testSms" method="POST" class="ajax-form">
            <div class="form-body">
                <div class="row">
                    @if (sms_setting()->telegram_status)
                    <div class="col-12">
                        <x-forms.number fieldName="telegram_user_id" fieldId="telegram_user_id"
                                        fieldLabel="<i class='fab fa-telegram'></i> {{ __('sms::modules.telegramUserId') }}"
                                        :fieldValue="$user->telegram_user_id" :popover="__('sms::modules.userIdInfo')"/>
                        <p class="text-bold text-danger">
                            @lang('sms::modules.telegramBotNameInfo')
                        </p>
                        <p class="text-bold"><span id="telegram-link-text">https://t.me/{{ sms_setting()->telegram_bot_name }}</span>
                            <a href="javascript:;" class="btn-copy btn-secondary f-12 rounded p-1 py-2 ml-1"
                                data-clipboard-target="#telegram-link-text">
                                <i class="fa fa-copy mx-1"></i>@lang('app.copy')</a>
                            <a href="https://t.me/{{ sms_setting()->telegram_bot_name }}" target="_blank" class="btn-secondary f-12 rounded p-1 py-2 ml-1">
                                <i class="fa fa-copy mx-1"></i>@lang('app.openInNewTab')</a>
                        </p>
                    </div>
                    @else
                    <div class="col-lg-2">
                        <x-forms.select fieldId="phone_code" fieldLabel="Country code" fieldName="phone_code"
                                        search="true">
                            <option value="">--</option>
                            @foreach ($countries as $item)
                                <option
                                    @if ($user->country_id == $item->id)
                                    selected
                                    @endif
                                    value="+{{ $item->phonecode }}">+{{ $item->phonecode.' ('.$item->iso.')' }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>
                    <div class="col-lg-10">
                        <x-forms.tel fieldId="mobile" :fieldLabel="__('app.mobile')" fieldName="mobile"
                                     :fieldValue="$user->mobile" fieldPlaceholder="e.g. 987654321"></x-forms.tel>
                    </div>
                    @endif
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="send-test-message" icon="envelope">@lang('app.send')</x-forms.button-primary>
</div>

<script>
    $(".select-picker").selectpicker();
    // save source
    $('#send-test-message').click(function () {
        $.easyAjax({
            url: "{{ route('sms-setting.send_test_message') }}",
            container: '#testSms',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#send-test-message",
            data: $('#testSms').serialize(),
            success: function (response) {
                if (response.status == "success") {
                    $(MODAL_LG).modal('hide');
                }
            }
        })
    });
</script>
