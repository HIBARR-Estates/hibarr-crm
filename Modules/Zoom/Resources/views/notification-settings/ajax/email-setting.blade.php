<div class="col-xl-8 col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
    <div class="row" id="slack-row">

        <div class="col-lg-12">
            <h4 class="mb-3 f-16  f-w-500 text-dark-grey">@lang("modules.emailSettings.notificationTitle")</h4>

            @foreach ($emailSettings as $emailSetting)
                <div class="mb-3 d-flex">
                    <x-forms.checkbox :checked="$emailSetting->send_email == 'yes'"
                                      :fieldLabel="__('zoom::modules.emailNotification.'.str_slug($emailSetting->setting_name))"
                                      fieldName="send_email[]" :fieldId="'send_email'.$emailSetting->id"
                                      :fieldValue="$emailSetting->id"/>
                </div>
            @endforeach
        </div>


    </div>
</div>


<!-- Buttons Start -->
<div class="w-100 border-top-grey set-btns">
    <x-setting-form-actions>
        <x-forms.button-primary id="save-email-forms" class="mr-3" icon="check">@lang('app.save')
        </x-forms.button-primary>

    </x-setting-form-actions>
</div>
<!-- Buttons End -->
<script>
    var emailSettingId = {{$emailSetting->id}};
    $('body').on('click', '#save-email-forms', function () {
        var notification_value = $('#send_email' + emailSettingId + ':checked').val();
        $.easyAjax({
            type: 'POST',
            url: "{{ route('zoom-settings.zoom-smtp-settings', $smtpSetting->id) }}",
            container: "#editSettings",
            data: {
                send_email: notification_value,
                _token: '{{ csrf_token() }}',
            },
            disableButton: true,
            blockUI: true,
            // buttonSelector: "#save-email-forms",
        })
    });
</script>

