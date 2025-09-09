<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    @method('PUT')
    <div class="row">
        <div class="col-md-12 mb-2">
            <h6>@lang('performance::modules.objectiveNotificationSettings')</h6>
        </div>
        <div class="col-md-12 mb-3">
            <x-alert type="info" icon="info-circle">
                @lang('performance::app.sendNotificationsNote')
            </x-alert>
        </div>
        <div class="col-lg-4">
            <div class="form-group mb-4">
                <x-forms.label fieldId="objective_slack_notification" :fieldLabel="__('performance::app.sendSlackNotifications')">
                </x-forms.label>
                <div class="custom-control custom-switch">
                    <input type="checkbox" @if ($settings->objective_slack_notification == 'yes') checked @endif
                        class="custom-control-input change-notification-setting" data-setting-type="objective_slack" data-setting-id="{{ $settings->id }}" id="objective_slack_notification" name="objective_slack_notification" value="yes">
                    <label class="custom-control-label cursor-pointer" for="objective_slack_notification"></label>
                </div>
            </div>
        </div>
        <div class="col-lg-4">
            <div class="form-group mb-4">
                <x-forms.label fieldId="objective_push_notification" :fieldLabel="__('performance::app.sendPushNotifications')">
                </x-forms.label>
                <div class="custom-control custom-switch">
                    <input type="checkbox" @if ($settings->objective_push_notification == 'yes') checked @endif
                        class="custom-control-input change-notification-setting" data-setting-type="objective_push" data-setting-id="{{ $settings->id }}" id="objective_push_notification" name="objective_push_notification" value="yes">
                    <label class="custom-control-label cursor-pointer" for="objective_push_notification"></label>
                </div>
            </div>
        </div>
        <div class="col-lg-4">
            <div class="form-group mb-4">
                <x-forms.label fieldId="objective_email_notification" :fieldLabel="__('performance::app.sendEmailNotifications')">
                </x-forms.label>
                <div class="custom-control custom-switch">
                    <input type="checkbox" @if ($settings->objective_email_notification == 'yes') checked @endif
                        class="custom-control-input change-notification-setting" data-setting-type="objective_email" data-setting-id="{{ $settings->id }}" id="objective_email_notification" name="objective_email_notification" value="yes">
                    <label class="custom-control-label cursor-pointer" for="objective_email_notification"></label>
                </div>
            </div>
        </div>

        <div class="col-md-12 mb-2 mt-3">
            <h6>@lang('performance::modules.1:1MeetingNotificationSettings')</h6>
        </div>
        <div class="col-lg-4">
            <div class="form-group mb-4">
                <x-forms.label fieldId="meeting_slack_notification" :fieldLabel="__('performance::app.sendSlackNotifications')">
                </x-forms.label>
                <div class="custom-control custom-switch">
                    <input type="checkbox" @if ($settings->meeting_slack_notification == 'yes') checked @endif
                        class="custom-control-input change-notification-setting" data-setting-type="meeting_slack" data-setting-id="{{ $settings->id }}" id="meeting_slack_notification" name="meeting_slack_notification" value="yes">
                    <label class="custom-control-label cursor-pointer" for="meeting_slack_notification"></label>
                </div>
            </div>
        </div>
        <div class="col-lg-4">
            <div class="form-group mb-4">
                <x-forms.label fieldId="meeting_push_notification" :fieldLabel="__('performance::app.sendPushNotifications')">
                </x-forms.label>
                <div class="custom-control custom-switch">
                    <input type="checkbox" @if ($settings->meeting_push_notification == 'yes') checked @endif
                        class="custom-control-input change-notification-setting" data-setting-type="meeting_push" data-setting-id="{{ $settings->id }}" id="meeting_push_notification" name="meeting_push_notification" value="yes">
                    <label class="custom-control-label cursor-pointer" for="meeting_push_notification"></label>
                </div>
            </div>
        </div>
        <div class="col-lg-4">
            <div class="form-group mb-4">
                <x-forms.label fieldId="meeting_email_notification" :fieldLabel="__('performance::app.sendEmailNotifications')">
                </x-forms.label>
                <div class="custom-control custom-switch">
                    <input type="checkbox" @if ($settings->meeting_email_notification == 'yes') checked @endif
                        class="custom-control-input change-notification-setting" data-setting-type="meeting_email" data-setting-id="{{ $settings->id }}" id="meeting_email_notification" name="meeting_email_notification" value="yes">
                    <label class="custom-control-label cursor-pointer" for="meeting_email_notification"></label>
                </div>
            </div>
        </div>
    </div>
</div>
