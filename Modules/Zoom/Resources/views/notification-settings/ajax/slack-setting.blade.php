<div class="col-xl-8 col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">

    <div class="row" id="slack-row">

        <div class="col-lg-12">
            <h4 class="mb-3 f-16  f-w-500 text-dark-grey">@lang("modules.slackSettings.notificationTitle")</h4>
            @foreach ($emailSettings as $emailSetting)
                <div class="mb-3 d-flex">
                    <x-forms.checkbox :checked="$emailSetting->send_slack == 'yes'"
                                      :fieldLabel="__('zoom::modules.emailNotification.'.str_slug($emailSetting->setting_name))"
                                      fieldName="send_slack" :fieldId="'send_slack'.$emailSetting->id"
                                      :fieldValue="$emailSetting->id"/>
                </div>
            @endforeach
        </div>


    </div>
</div>


<!-- Buttons Start -->
<div class="w-100 border-top-grey set-btns">
    <x-setting-form-actions>
        <x-forms.button-primary id="save-slack-form" class="mr-3" icon="check">@lang('app.save')
        </x-forms.button-primary>

    </x-setting-form-actions>
</div>
<!-- Buttons End -->
<script>
    var slackSettingId = {{$emailSetting->id}};

    $(document).ready(function () {

        $('body').on('click', '#save-slack-form', function () {
            var notification_value = $('#send_slack' + slackSettingId + ':checked').val();
            $.easyAjax({
                type: 'POST',
                url: "{{ route('zoom-settings.zoom-slack-settings', slack_setting()->id) }}",
                container: "#editSettings",
                data: {
                    send_slack: notification_value,
                    _token: '{{ csrf_token() }}',

                },
                disableButton: true,
                blockUI: true,
                // buttonSelector: "#save-slack-form",
            })
        });

        // init('#slack-row');
    });
</script>
<script>


</script>
