<div class="col-12 p-4">
    <x-alert type="info" icon="info-circle">
        @lang('modules.emailSettings.inAppNotificationInfo')
    </x-alert>

    <h4 class="f-16 f-w-500 text-dark-grey mt-3">@lang("modules.emailSettings.inAppNotificationTitle")</h4>
    <div class="mb-3 d-flex">
        <x-forms.checkbox :checked="$checkedAll==true"
                          :fieldLabel="__('modules.permission.selectAll')"
                          fieldName="select_all_checkbox" fieldId="select_all"
                          fieldValue="all"/>
    </div>
    @foreach ($emailSettings as $emailSetting)
        <div class="mb-3 d-flex notification">
            <x-forms.checkbox :checked="$emailSetting->send_database == 'yes'"
                              :fieldLabel="__('modules.emailNotification.'.str_slug($emailSetting->setting_name))"
                              fieldName="send_database[]" :fieldId="'send_database_'.$emailSetting->id"
                              :fieldValue="$emailSetting->id"/>
        </div>
    @endforeach
</div>

<!-- Buttons Start -->
<div class="w-100 border-top-grey set-btns">
    <x-setting-form-actions>
        <x-forms.button-primary id="save-database-form" class="mr-3" icon="check">@lang('app.save')
        </x-forms.button-primary>
    </x-setting-form-actions>
</div>
<!-- Buttons End -->

<script>
    var checkboxes = document.querySelectorAll(".notification input[type=checkbox]");

    $('body').on('click', '#select_all', function() {
        var selectAll = $('#select_all').is(':checked');

        checkboxes.forEach(function(checkbox){
            checkbox.checked = selectAll;
        });
    });

    $('body').on('click', '#save-database-form', function () {
        const url = "{{ route('notification-settings.update', 0) }}";

        $.easyAjax({
            url: url,
            type: "POST",
            container: '#editSettings',
            blockUI: true,
            messagePosition: "inline",
            data: $('#editSettings').serialize(),
        })
    });
</script>
