<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
    <div class="row">
        @if (config('session.driver') !== 'database')
            <div class="col-lg-12">
                <x-alert type="danger">
                    @lang('cybersecurity::messages.sessionDriverRequired', ['setting' => '<a href="'.route('app-settings.index').'">' . __('app.menu.appSettings') . '</a>'])
                </x-alert>
            </div>
        @endif

        <div class="col-lg-12">
            <div class="form-group my-3">
                <x-forms.label fieldId="session_yes" :fieldLabel="__('cybersecurity::app.preventUser')" fieldRequired="true">
                </x-forms.label>
                <div class="d-flex">
                    <x-forms.radio fieldId="session_yes" :fieldLabel="__('app.yes')" fieldName="unique_session"
                        fieldValue="1" :checked="$security->unique_session">
                    </x-forms.radio>
                    <x-forms.radio fieldId="notification_no" :fieldLabel="__('app.no')" fieldValue="0"
                        fieldName="unique_session" :checked="!$security->unique_session">
                    </x-forms.radio>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Buttons Start -->
<div class="w-100 border-top-grey">
    <x-setting-form-actions>
        <x-forms.button-primary id="save-session-form" class="mr-3" icon="check">@lang('app.save')
        </x-forms.button-primary>
    </x-setting-form-actions>
</div>
<!-- Buttons End -->

<script>
    $('body').on('click', '#save-session-form', function () {
        var url = "{{ route('cybersecurity.update', 1) }}?page=single-session";

        $.easyAjax({
            url: url,
            container: '#editSettings',
            type: "POST",
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-session-form",
            data: $('#editSettings').serialize(),
        })
    });
</script>
