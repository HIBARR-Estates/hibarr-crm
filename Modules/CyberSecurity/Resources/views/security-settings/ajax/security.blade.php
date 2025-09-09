<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
    @method('PUT')
    <div class="row">
        <div class="col-12">
            <div class="pt-3 px-2 pb-0 information-box">

            </div>
        </div>
        <div class="col-lg-6">
            <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                            :fieldLabel="__('cybersecurity::app.maxRetries')"
                            :fieldPlaceholder="__('cybersecurity::placeholders.attempt')" fieldRequired="true"
                            fieldName="max_retries"
                            :popover="__('cybersecurity::messages.maxRetriesToolTip')"
                            fieldId="max_retries" :fieldValue="$security?->max_retries"/>
        </div>
        <div class="col-lg-6">
            <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                            :fieldLabel="__('cybersecurity::app.lockoutTime')"
                            :fieldPlaceholder="__('cybersecurity::placeholders.attempt')" fieldRequired="true"
                            fieldName="lockout_time"
                            fieldId="lockout_time" :fieldValue="$security?->lockout_time"/>

        </div>

        <div class="col-lg-6">
            <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                            :fieldLabel="__('cybersecurity::app.maxLockouts')"
                            :fieldPlaceholder="__('cybersecurity::placeholders.attempt')" fieldRequired="true" fieldName="max_lockouts"
                            fieldId="max_lockouts" :fieldValue="$security?->max_lockouts"/>
        </div>
        <div class="col-lg-6">
            <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                            :fieldLabel="__('cybersecurity::app.extendLockout')"
                            :fieldPlaceholder="__('cybersecurity::placeholders.attempt')" fieldRequired="true"
                            :popover="__('cybersecurity::messages.extendLockoutToolTip')"
                            fieldName="extended_lockout_time"
                            fieldId="extended_lockout_time" :fieldValue="$security?->extended_lockout_time"/>
        </div>

        <div class="col-lg-6">
            <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                            :fieldLabel="__('cybersecurity::app.resetRetries')"
                            :fieldPlaceholder="__('cybersecurity::placeholders.hours')" fieldRequired="true" fieldName="reset_retries"
                            fieldId="reset_retries" :fieldValue="$security?->reset_retries"/>
        </div>

        {{-- <div class="col-lg-6">
            <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                            :fieldLabel="__('cybersecurity::app.userInactiveTimeout')"
                            :fieldPlaceholder="__('cybersecurity::placeholders.attempt')" fieldRequired="true" fieldName="user_timeout"
                            fieldId="user_timeout" :fieldValue="$security?->user_timeout"/>
        </div> --}}

        <div class="col-12 row">
            <div class="col-lg-6">
                <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                                :fieldLabel="__('cybersecurity::app.emailNotification')"
                                :fieldPlaceholder="__('cybersecurity::placeholders.attempt')" fieldRequired="false"
                                :popover="__('cybersecurity::messages.emailNotificationToolTip')"
                                fieldName="alert_after_lockouts"
                                fieldId="alert_after_lockouts" :fieldValue="$security?->alert_after_lockouts"/>
            </div>

            <div class="col-lg-6">
                <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                                :fieldLabel="__('app.email')"
                                :fieldPlaceholder="__('placeholders.email')" fieldRequired="true" fieldName="email"
                                fieldId="email" :fieldValue="$security?->email"/>
            </div>

            @if (isWorksuite())
                <div class="col-lg-6">
                    <div class="form-group my-3">
                        <x-forms.label fieldId="notification_yes" :fieldLabel="__('cybersecurity::app.sendEmailNotification')" fieldRequired="true">
                        </x-forms.label>
                        <div class="d-flex">
                            <x-forms.radio fieldId="notification_yes" :fieldLabel="__('app.yes')" fieldName="ip_check"
                            fieldValue="1" :checked="$security->ip_check">
                            </x-forms.radio>
                            <x-forms.radio fieldId="notification_no" :fieldLabel="__('app.no')" fieldValue="0"
                                fieldName="ip_check" :checked="!$security->ip_check">
                            </x-forms.radio>
                        </div>
                    </div>
                </div>

                <div @class([
                    'col-lg-6',
                    'd-none' => !$security->ip_check
                ])
                id="different-login-ip">
                    <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                                :fieldLabel="__('cybersecurity::app.ip')"
                                :fieldPlaceholder="__('cybersecurity::placeholders.ip')" fieldRequired="true" fieldName="ip"
                                fieldId="ip" :fieldValue="$security?->ip"/>
                </div>
            @endif
        </div>
    </div>

</div>

<!-- Buttons Start -->
<div class="w-100 border-top-grey">
    <x-setting-form-actions>
        <x-forms.button-primary id="save-form" class="mr-3" icon="check">@lang('app.save')
        </x-forms.button-primary>
    </x-setting-form-actions>
</div>
<!-- Buttons End -->

<script>
    $('body').on('click', '#save-form', function () {
        var url = "{{ route('cybersecurity.update', 1) }}?page=security";

        $.easyAjax({
            url: url,
            container: '#editSettings',
            type: "POST",
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-form",
            data: $('#editSettings').serialize(),
            success: function () {
                window.location.reload();
            }
        })
    });

    @if (isWorksuite())
        $('body').on('change', 'input[name=ip_check]', function () {
            if ($(this).val() == 1) {
                $('#different-login-ip').removeClass('d-none');
            } else {
                $('#different-login-ip').addClass('d-none');
            }
        });
    @endif

    // have a from that id save-form i want to triger a function updateInfo when any input value is change in the from
    $('body').on('change keyup', 'input', function () {
        updateInfo();
    });



    function updateInfo() {
        let max_retries = $('#max_retries').val();
        let lockout_time = $('#lockout_time').val();
        let max_lockouts = $('#max_lockouts').val();
        let extended_lockout_time = $('#extended_lockout_time').val();
        let reset_retries = $('#reset_retries').val();
        let alert_after_lockouts = $('#alert_after_lockouts').val();
        let email = $('#email').val();
        let ip_check = $('input[name=ip_check]:checked').val();
        let ip = $('#ip').val();

        let information = '';

        let maxRetriesMessage = `<p>{{ __('cybersecurity::messages.infoBox.lockoutForMinutes', ['maxRetries' => ':maxRetries', 'lockoutTime' => ':lockoutTime']) }}</p>`;
        let extendedLockoutMessage = `<p>{{ __('cybersecurity::messages.infoBox.extendedLockout', ['extendedLockoutTime' => ':extendedLockoutTime']) }}</p>`;
        let maxLockoutsAvailable = `<p>{{ __('cybersecurity::messages.infoBox.maxLockoutsAvailable', ['maxLockouts' => ':maxLockouts']) }}</p>`;
        let resetRetriesMessage = `<p>{{ __('cybersecurity::messages.infoBox.resetRetries', ['resetRetries' => ':resetRetries']) }}</p>`;
        let alertAfterLockoutsMessage = `<p>{{ __('cybersecurity::messages.infoBox.alertAfterLockouts', ['alertAfterLockouts' => ':alertAfterLockouts', 'email' => ':email']) }}</p>`;
        let sendEmailDifferentIpMessage = `<p>{{ __('cybersecurity::messages.infoBox.sendEmailDifferentIp', ['ip' => ':ip']) }}</p>`;
        let notSendEmailDifferentIpMessage = `<p>{{ __('cybersecurity::messages.infoBox.notSendEmailDifferentIp') }}</p>`;

        maxRetriesMessage = maxRetriesMessage.replace(':maxRetries', max_retries);
        maxRetriesMessage = maxRetriesMessage.replace(':lockoutTime', lockout_time);

        information += maxRetriesMessage;

        information += extendedLockoutMessage.replace(':extendedLockoutTime', extended_lockout_time);

        information += maxLockoutsAvailable.replace(':maxLockouts', max_lockouts);

        information += resetRetriesMessage.replace(':resetRetries', reset_retries);

        alertAfterLockoutsMessage = alertAfterLockoutsMessage.replace(':alertAfterLockouts', alert_after_lockouts);
        alertAfterLockoutsMessage = alertAfterLockoutsMessage.replace(':email', email);

        information += alertAfterLockoutsMessage;

        if (ip_check == 1) {
            information += sendEmailDifferentIpMessage.replace(':ip', ip);
        }
        else {
            information += notSendEmailDifferentIpMessage;
        }

        $('.information-box').html(information);

    }

    $(document).ready(function () {
        updateInfo();
    });
</script>
