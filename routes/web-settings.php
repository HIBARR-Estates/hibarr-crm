<?php

/* Setting menu routes starts from here */
use App\Http\Controllers\ApiTokenSettingController;
use App\Http\Controllers\AppSettingController;
use App\Http\Controllers\AttendanceSettingController;
use App\Http\Controllers\AutomationSettingController;
use App\Http\Controllers\BusinessAddressController;
use App\Http\Controllers\ContractSettingController;
use App\Http\Controllers\CrmEventSettingController;
use App\Http\Controllers\CurrencySettingController;
use App\Http\Controllers\CustomFieldCategoryController;
use App\Http\Controllers\CustomFieldController;
use App\Http\Controllers\CustomLinkSettingController;
use App\Http\Controllers\CustomModuleController;
use App\Http\Controllers\DatabaseBackupSettingController;
use App\Http\Controllers\DealAutomationController;
use App\Http\Controllers\EmailTemplateController;
use App\Http\Controllers\EmployeeShiftController;
use App\Http\Controllers\EntityReminderDefaultController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\GoogleCalendarSettingController;
use App\Http\Controllers\InvoiceSettingController;
use App\Http\Controllers\LanguageSettingController;
use App\Http\Controllers\LeadAgentSettingController;
use App\Http\Controllers\LeadLifecycleStatusSettingController;
use App\Http\Controllers\LeadPipelineSettingController;
use App\Http\Controllers\LeadSettingController;
use App\Http\Controllers\LeadSourceSettingController;
use App\Http\Controllers\LeadStageSettingController;
use App\Http\Controllers\LeaveSettingController;
use App\Http\Controllers\LeaveTypeController;
use App\Http\Controllers\MessageSettingController;
use App\Http\Controllers\MetaEventController;
use App\Http\Controllers\ModuleSettingController;
use App\Http\Controllers\NotificationSettingController;
use App\Http\Controllers\OfflinePaymentSettingController;
use App\Http\Controllers\PackageController;
use App\Http\Controllers\PaymentGatewayCredentialController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProfileSettingController;
use App\Http\Controllers\ProjectSettingController;
use App\Http\Controllers\PusherSettingsController;
use App\Http\Controllers\PushNotificationController;
use App\Http\Controllers\NotificationSettingsApiController;
use App\Http\Controllers\QuickbookSettingsController;
use App\Http\Controllers\ReminderLedgerController;
use App\Http\Controllers\RolePermissionController;
use App\Http\Controllers\SecuritySettingController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SettingsOverviewController;
use App\Http\Controllers\ShiftRotationController;
use App\Http\Controllers\SignUpSettingController;
use App\Http\Controllers\SlackSettingController;
use App\Http\Controllers\SmtpSettingController;
use App\Http\Controllers\SocialAuthSettingController;
use App\Http\Controllers\StorageSettingController;
use App\Http\Controllers\TaskSettingController;
use App\Http\Controllers\TaxSettingController;
use App\Http\Controllers\ThemeSettingController;
use App\Http\Controllers\TicketAgentController;
use App\Http\Controllers\TicketChannelController;
use App\Http\Controllers\TicketEmailSettingController;
use App\Http\Controllers\TicketGroupController;
use App\Http\Controllers\TicketReplyTemplatesController;
use App\Http\Controllers\TicketSettingController;
use App\Http\Controllers\TicketTypeController;
use App\Http\Controllers\TimeLogSettingController;
use App\Http\Controllers\TwoFASettingController;
use App\Http\Controllers\UnitTypeController;
use App\Http\Controllers\UpdateAppController;
use App\Http\Controllers\UserPreferencesController;
use App\Http\Controllers\UserReminderPreferenceController;
use Illuminate\Support\Facades\Route;

Route::group(['middleware' => 'auth', 'prefix' => 'account/settings'], function () {

    Route::post('profile/change-language', [ProfileController::class, 'changeLanguage'])->name('profile.change_language');

    /* Admin-only React settings hub (entity setting cards) */
    Route::get('overview', [SettingsOverviewController::class, 'index'])->name('settings-overview.index');

    /* Automation settings — email templates + trigger-based automations */
    Route::get('automation', [AutomationSettingController::class, 'index'])->name('settings-automation.index');

    Route::post('app-settings/deleteSessions', [AppSettingController::class, 'deleteSessions'])->name('app-settings.delete_sessions');
    Route::resource('app-settings', AppSettingController::class);

    Route::post('api-token-settings/{id}/regenerate', [ApiTokenSettingController::class, 'regenerate'])
        ->name('api-token-settings.regenerate')
        ->whereNumber('id');
    Route::resource('api-token-settings', ApiTokenSettingController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::resource('profile-settings', ProfileSettingController::class);

    /* User preferences (timezone, in-app alerts, notification bypass) */
    Route::get('preferences', [UserPreferencesController::class, 'show'])->name('user-preferences.show');
    Route::post('preferences/timezone', [UserPreferencesController::class, 'updateTimezone'])->name('user-preferences.timezone');
    Route::put('preferences/bypasses', [UserPreferencesController::class, 'updateBypass'])->name('user-preferences.bypasses');

    /* User Reminder Preferences */
    Route::get('reminder-preferences/manage', [UserReminderPreferenceController::class, 'show'])->name('reminder-preferences.show');
    Route::get('reminder-preferences', [UserReminderPreferenceController::class, 'index'])->name('reminder-preferences.index');
    Route::post('reminder-preferences', [UserReminderPreferenceController::class, 'update'])->name('reminder-preferences.update');
    Route::delete('reminder-preferences/{entityType}/reset', [UserReminderPreferenceController::class, 'reset'])->name('reminder-preferences.reset');

    /* Company entity reminder defaults (feature-flagged) */
    Route::get('entity-reminder-defaults', [EntityReminderDefaultController::class, 'index'])->name('entity-reminder-defaults.index');
    Route::post('entity-reminder-defaults', [EntityReminderDefaultController::class, 'update'])->name('entity-reminder-defaults.update');
    Route::post('entity-reminder-defaults/email-templates', [EntityReminderDefaultController::class, 'updateEmailTemplates'])->name('entity-reminder-defaults.email-templates');
    Route::delete('entity-reminder-defaults/{entityType}', [EntityReminderDefaultController::class, 'destroy'])->name('entity-reminder-defaults.destroy');

    /* Reminder ledger (company send queue) */
    Route::get('reminder-ledger', [ReminderLedgerController::class, 'index'])->name('reminder-ledger.index');
    Route::post('reminder-ledger/{reminder}/cancel', [ReminderLedgerController::class, 'cancel'])->name('reminder-ledger.cancel');
    Route::post('reminder-ledger/{reminder}/send-now', [ReminderLedgerController::class, 'sendNow'])->name('reminder-ledger.send-now');

    /* 2FA */
    Route::get('2fa-codes-download', [TwoFASettingController::class, 'download'])->name('2fa_codes_download');
    Route::get('verify-2fa-password', [TwoFASettingController::class, 'verify'])->name('verify_2fa_password');
    Route::get('2fa-confirm', [TwoFASettingController::class, 'showConfirm'])->name('two-fa-settings.validate_confirm');
    Route::post('2fa-confirm', [TwoFASettingController::class, 'confirm'])->name('two-fa-settings.confirm');
    Route::get('2fa-email-confirm', [TwoFASettingController::class, 'showEmailConfirm'])->name('two-fa-settings.validate_email_confirm');
    Route::post('2fa-email-confirm', [TwoFASettingController::class, 'emailConfirm'])->name('two-fa-settings.email_confirm');
    Route::resource('two-fa-settings', TwoFASettingController::class);

    Route::post('profile/dark-theme', [ProfileController::class, 'darkTheme'])->name('profile.dark_theme');
    Route::post('profile/updateOneSignalId', [ProfileController::class, 'updateOneSignalId'])->name('profile.update_onesignal_id');
    Route::post('profile/timezone', [ProfileController::class, 'updateTimezone'])->name('profile.update_timezone');
    Route::resource('profile', ProfileController::class);

    Route::get('smtp-settings/show-send-test-mail-modal', [SmtpSettingController::class, 'showTestEmailModal'])->name('smtp_settings.show_send_test_mail_modal');
    Route::get('smtp-settings/send-test-mail', [SmtpSettingController::class, 'sendTestEmail'])->name('smtp_settings.send_test_mail');

    Route::get('slack-settings/send-test-notification', [SlackSettingController::class, 'sendTestNotification'])->name('slack_settings.send_test_notification');

    Route::get('push-notification-settings/send-test-notification', [PushNotificationController::class, 'sendTestNotification'])->name('push_notification_settings.send_test_notification');

    Route::resource('smtp-settings', SmtpSettingController::class);
    Route::resource('notification-settings', NotificationSettingController::class);
    Route::resource('slack-settings', SlackSettingController::class);
    Route::resource('push-notification-settings', PushNotificationController::class);
    Route::resource('pusher-settings', PusherSettingsController::class);

    // React notification manager — deliberately a different path segment from the
    // `notification-settings` resource above so its routes can't be shadowed by
    // that resource's wildcard `{notification_setting}` show route.
    Route::get('notification-settings-manager', [NotificationSettingsApiController::class, 'page'])->name('notification-settings-manager.index');
    Route::get('notification-settings-manager/data', [NotificationSettingsApiController::class, 'index'])->name('notification-settings-manager.data');
    Route::put('notification-settings-manager/data/{channel}', [NotificationSettingsApiController::class, 'update'])->name('notification-settings-manager.update');

    // Currency Settings routes
    Route::get('currency-settings/update/exchange-rates', [CurrencySettingController::class, 'updateExchangeRate'])->name('currency_settings.update_exchange_rates');

    /* Start Currency Settings routes */
    Route::get('currency-settings/exchange-key', [CurrencySettingController::class, 'currencyExchangeKey'])->name('currency_settings.exchange_key');
    Route::post('currency-settings/exchange-key-store', [CurrencySettingController::class, 'currencyExchangeKeyStore'])->name('currency_settings.exchange_key_store');
    Route::get('currency-settings/exchange-rate/{currency}', [CurrencySettingController::class, 'exchangeRate'])->name('currency_settings.exchange_rate');

    Route::get('currency-settings/update-currency-format', [CurrencySettingController::class, 'updateCurrencyFormat'])->name('currency_settings.update_currency_format');
    Route::resource('currency-settings', CurrencySettingController::class);
    Route::resource('payment-gateway-settings', PaymentGatewayCredentialController::class);
    /* End Currency Settings routes */

    Route::resource('offline-payment-setting', OfflinePaymentSettingController::class);

    /* Invoice Setting Routes */
    Route::post('invoice-settings/update-template/{id}', [InvoiceSettingController::class, 'updateTemplate'])->name('invoice_settings.update_template');
    Route::post('invoice-settings/update-prefix/{id}', [InvoiceSettingController::class, 'updatePrefix'])->name('invoice_settings.update_prefix');
    Route::resource('invoice-settings', InvoiceSettingController::class);

    /* unitType */
    Route::resource('unit-type', UnitTypeController::class);
    Route::post('unit-types/set-default', [UnitTypeController::class, 'setDefaultUnit'])->name('unit-type.set_default');

    /* Start Ticket settings routes */
    Route::post('ticket-agents/update-group/{id}', [TicketAgentController::class, 'updateGroup'])->name('ticket_agents.update_group');
    Route::resource('ticket-agents', TicketAgentController::class);
    Route::get('agent-groups', [TicketAgentController::class, 'agentGroups'])->name('ticket_agents.agent_groups');

    Route::resource('ticket-settings', TicketSettingController::class);
    Route::post('ticket-settings-status/update-status/{companyId}', [TicketSettingController::class, 'updateTicketSettingStatus'])->name('ticket-setting.update_status');
    Route::post('/ticket-agent-settings/{companyId}', [TicketSettingController::class, 'updateTicketSettingForAgent'])->name('ticket-agent-settings.update');
    Route::resource('ticket-groups', TicketGroupController::class);
    Route::resource('ticketTypes', TicketTypeController::class);
    Route::resource('ticketChannels', TicketChannelController::class);
    Route::resource('ticket-email-settings', TicketEmailSettingController::class);

    Route::get('replyTemplates/fetch-template', [TicketReplyTemplatesController::class, 'fetchTemplate'])->name('replyTemplates.fetchTemplate');
    Route::resource('replyTemplates', TicketReplyTemplatesController::class);
    /* End Ticket settings routes */
    Route::get('project-settings/create-category', [ProjectSettingController::class, 'createCategory'])->name('project-settings.createCategory');
    Route::post('project-settings/save-project-category', [ProjectSettingController::class, 'saveProjectCategory'])->name('project-settings.saveProjectCategory');
    Route::resource('project-settings', ProjectSettingController::class);
    Route::post('project-settings/{id?}', [ProjectSettingController::class, 'statusUpdate'])->name('project-settings.statusUpdate');
    Route::put('project-settings/change-status/{id?}', [ProjectSettingController::class, 'changeStatus'])->name('project-settings.changeStatus');
    Route::post('project-settings/set-default/{id?}', [ProjectSettingController::class, 'setDefault'])->name('project-settings.setDefault');
    // Route::get('check-qr-login', [AttendanceSettingController::class, 'qrClockInOut'])->name('settings.qr-login');
    // Route::post('change-qr-code-status', [AttendanceSettingController::class, 'qrCodeStatus'])->name('settings.change-qr-code-status');

    Route::resource('attendance-settings', AttendanceSettingController::class);

    // Shift Rotation routes
    Route::post('shift-rotations/change-status', [ShiftRotationController::class, 'changeStatus'])->name('shift-rotations.change_status');
    Route::get('shift-rotations/automate-shift', [ShiftRotationController::class, 'automateShift'])->name('shift-rotations.automate_shift');
    Route::post('shift-rotations/remove_employee', [ShiftRotationController::class, 'removeEmployee'])->name('shift-rotations.remove_employee');
    Route::post('shift-rotations/store-automate-shift', [ShiftRotationController::class, 'storeAutomateShift'])->name('shift-rotations.store_automate_shift');
    Route::get('shift-rotations/manage-rotation-employee/{id}', [ShiftRotationController::class, 'manageEmployees'])->name('shift-rotations.manage_rotation_employee');
    Route::post('shift-rotations/change-employee-rotation', [ShiftRotationController::class, 'changeEmployeeRotation'])->name('shift-rotations.change_employee_rotation');
    Route::get('shift-rotations/run-rotation', [ShiftRotationController::class, 'runRotation'])->name('shift-rotations.run_rotation_get');
    Route::post('shift-rotations/run-rotation', [ShiftRotationController::class, 'runRotation'])->name('shift-rotations.run_rotation_post');
    Route::resource('shift-rotations', ShiftRotationController::class);

    Route::resource('leaves-settings', LeaveSettingController::class);
    Route::post('leaves-settings/change-permission', [LeaveSettingController::class, 'changePermission'])->name('leaves-settings.changePermission');

    // LeaveType Resource
    Route::resource('leaveType', LeaveTypeController::class);

    // Custom Fields Settings (fields-by-group before resource so it is not matched as {id})
    Route::get('custom-fields/fields-by-group', [CustomFieldController::class, 'fieldsByGroup'])->name('custom-fields.fields-by-group');
    Route::resource('custom-fields', CustomFieldController::class);
    Route::get('custom-fields/{id}/rule-set', [CustomFieldController::class, 'getRuleSet'])->name('custom-fields.rule-set');
    Route::post('custom-fields/{id}/rule-set', [CustomFieldController::class, 'saveRuleSet'])->name('custom-fields.save-rule-set');
    Route::post('custom-fields/evaluate-visibility', [CustomFieldController::class, 'evaluateVisibility'])->name('custom-fields.evaluate-visibility');
    Route::post('custom-fields/sort-fields', [CustomFieldController::class, 'sortFields'])->name('custom-fields.sort-fields');

    // Custom Field Categories
    Route::get('custom-field-categories/get-by-group', [CustomFieldCategoryController::class, 'getCategoriesByGroup'])->name('custom-field-categories.get-by-group');
    Route::post('custom-field-categories/sort', [CustomFieldCategoryController::class, 'sortCategories'])->name('custom-field-categories.sort');
    Route::resource('custom-field-categories', CustomFieldCategoryController::class);

    // Tax Settings
    Route::resource('taxes', TaxSettingController::class);

    // Message settings
    Route::resource('message-settings', MessageSettingController::class);

    // Storage settings
    Route::get('storage-settings/aws-local-to-aws-modal', [StorageSettingController::class, 'awsLocalToAwsModal'])->name('storage-settings.aws_local_to_aws_modal');
    Route::post('storage-settings/aws-local-to-aws', [StorageSettingController::class, 'moveFilesLocalToAwsS3'])->name('storage-settings.aws_local_to_aws');
    Route::get('storage-settings/storage-test-modal/{type}', [StorageSettingController::class, 'awsTestModal'])->name('storage-settings.aws_test_modal');
    Route::post('storage-settings/aws-test', [StorageSettingController::class, 'awsTest'])->name('storage-settings.aws_test');
    Route::resource('storage-settings', StorageSettingController::class);

    // Language settings
    Route::get('language-settings/auto-translate', [LanguageSettingController::class, 'autoTranslate'])->name('language_settings.auto_translate');
    Route::post('language-settings/auto-translate', [LanguageSettingController::class, 'autoTranslateUpdate'])->name('language_settings.auto_translate_update');
    Route::post('language-settings/update-data/{id?}', [LanguageSettingController::class, 'updateData'])->name('language_settings.update_data');
    Route::post('language-settings/fix-translation', [LanguageSettingController::class, 'fixTranslation'])->name('language_settings.fix_translation');
    Route::post('language-settings/create-en-locale', [LanguageSettingController::class, 'createEnLocale'])->name('language_settings.create_en_locale');
    Route::resource('language-settings', LanguageSettingController::class);

    // Task Settings
    Route::resource('task-settings', TaskSettingController::class, ['only' => ['index', 'store']]);

    // Time Log Settings
    Route::resource('timelog-settings', TimeLogSettingController::class);

    // Social Auth Settings
    Route::resource('social-auth-settings', SocialAuthSettingController::class, ['only' => ['index', 'update']]);

    /* Lead Settings */
    Route::put('lead-settings/deal-package-settings', [LeadSettingController::class, 'updateDealPackageSettings'])->name('lead-settings.deal-package-settings');
    // Both of these must stay above the resource, or lead-settings/{lead_setting}
    // swallows them.
    Route::put('lead-settings/first-contact-sla', [LeadSettingController::class, 'updateFirstContactSla'])->name('lead-settings.first-contact-sla');
    Route::resource('lead-settings', LeadSettingController::class);
    Route::post('lead-settings-status/update-status/{companyId}', [LeadSettingController::class, 'updateLeadSettingStatus'])->name('lead-setting.update_status');
    Route::post('lead-sources/reorder', [LeadSourceSettingController::class, 'reorder'])->name('lead-sources.reorder');
    Route::resource('lead-source-settings', LeadSourceSettingController::class);
    Route::resource('lead-lifecycle-status-settings', LeadLifecycleStatusSettingController::class)
        ->only(['create', 'store', 'edit', 'update', 'destroy']);

    Route::get('lead-stage-update/{statusId}', [LeadStageSettingController::class, 'statusUpdate'])->name('lead-stage-setting.stageUpdate');
    Route::resource('lead-stage-setting', LeadStageSettingController::class);

    Route::get('lead-pipeline-update/{statusId}', [LeadPipelineSettingController::class, 'statusUpdate'])->name('lead-pipeline-update.stageUpdate');
    Route::put('lead-pipeline-setting/{id}/nav-visibility', [LeadPipelineSettingController::class, 'updateNavVisibility'])->name('lead-pipeline-setting.nav-visibility');
    Route::put('lead-pipeline-setting/{id}/analysis-script', [\App\Http\Controllers\PipelineAnalysisScriptController::class, 'upsert'])->name('pipeline.analysis-script.upsert');
    Route::get('lead-pipeline-setting/{id}/analysis-script', [\App\Http\Controllers\PipelineAnalysisScriptController::class, 'show'])->name('pipeline.analysis-script.show');
    Route::get('analysis-script-builder', [\App\Http\Controllers\PipelineAnalysisScriptController::class, 'builder'])->name('analysis-script-builder.show');
    Route::get('pipeline-analysis-script/pipelines', [\App\Http\Controllers\PipelineAnalysisScriptController::class, 'pipelines'])->name('pipeline.analysis-script.pipelines');
    Route::get('pipeline-analysis-script/palette-fields', [\App\Http\Controllers\PipelineAnalysisScriptController::class, 'paletteFields'])->name('pipeline.analysis-script.palette-fields');
    Route::get('pipeline-analysis-script/{pipelineId}/categories', [\App\Http\Controllers\PipelineAnalysisScriptController::class, 'categories'])->name('pipeline.analysis-script.categories');
    Route::resource('lead-pipeline-setting', LeadPipelineSettingController::class);

    Route::resource('lead-agent-settings', LeadAgentSettingController::class);
    Route::post('lead-agent-settings/update-category/{id}', [LeadAgentSettingController::class, 'updateCategory'])->name('lead_agents.update_category');
    Route::post('lead-agent-settings/update-status/{id}', [LeadAgentSettingController::class, 'updateStatus'])->name('lead_agents.update_status');
    Route::get('agent-category', [LeadAgentSettingController::class, 'agentCategories'])->name('lead_agent.categories');

    /* Contract Setting */
    Route::resource('contract-settings', ContractSettingController::class);

    // Security Settings
    Route::get('verify-google-recaptcha-v3', [SecuritySettingController::class, 'verify'])->name('verify_google_recaptcha_v3');
    Route::resource('security-settings', SecuritySettingController::class);

    // Google Calendar Settings
    Route::resource('google-calendar-settings', GoogleCalendarSettingController::class);
    Route::get('google-auth', [GoogleAuthController::class, 'index'])->name('googleAuth');
    Route::delete('google-auth', [GoogleAuthController::class, 'destroy'])->name('googleAuth.destroy');

    // Database Backup Settings
    Route::get('database-backup-settings/create-backup', [DatabaseBackupSettingController::class, 'createBackup'])->name('database-backup-settings.create_backup');
    Route::get('database-backup-settings/download/{file_name}', [DatabaseBackupSettingController::class, 'download'])->name('database-backup-settings.download');
    Route::get('database-backup-settings/delete/{file_name}', [DatabaseBackupSettingController::class, 'delete'])->name('database-backup-settings.delete');
    Route::resource('database-backup-settings', DatabaseBackupSettingController::class);

    // Role Permissions
    Route::post('role-permission/storeRole', [RolePermissionController::class, 'storeRole'])->name('role-permissions.store_role');
    Route::post('role-permission/deleteRole', [RolePermissionController::class, 'deleteRole'])->name('role-permissions.delete_role');
    Route::post('role-permissions/permissions', [RolePermissionController::class, 'permissions'])->name('role-permissions.permissions');
    Route::post('role-permissions/customPermissions', [RolePermissionController::class, 'customPermissions'])->name('role-permissions.custom_permissions');
    Route::post('role-permissions/reset-permissions', [RolePermissionController::class, 'resetPermissions'])->name('role-permissions.reset_permissions');
    Route::resource('role-permissions', RolePermissionController::class);

    // Theme settings
    Route::resource('theme-settings', ThemeSettingController::class);

    // Module settings
    Route::resource('module-settings', ModuleSettingController::class);

    // Custom Modules
    Route::post('custom-modules/verify-purchase', [CustomModuleController::class, 'verifyingModulePurchase'])->name('custom-modules.verify_purchase');
    Route::resource('custom-modules', CustomModuleController::class);

    Route::post('business-address/set-default', [BusinessAddressController::class, 'setDefaultAddress'])->name('business-address.set_default');
    Route::resource('business-address', BusinessAddressController::class);

    Route::resource('packages', PackageController::class);

    Route::post('employee-shifts/set-default', [EmployeeShiftController::class, 'setDefaultShift'])->name('employee-shifts.set_default');
    Route::resource('employee-shifts', EmployeeShiftController::class);

    Route::resource('quickbooks-settings', QuickbookSettingsController::class);

    Route::resource('custom-link-settings', CustomLinkSettingController::class);

    Route::resource('sign-up-settings', SignUpSettingController::class)->only(['index', 'update']);

});

Route::group(['middleware' => 'auth', 'prefix' => 'account'], function () {

    Route::get('company-settings/deal-automations', [SettingsController::class, 'deal_automations'])->name('company-settings.deal_automations');
    Route::post('deal-automations/change-status', [DealAutomationController::class, 'changeStatus'])->name('deal-automations.change-status');
    Route::get('deal-automation-logs', [DealAutomationController::class, 'logs'])->name('deal-automations.logs');
    Route::get('deal-automation-logs/stats', [DealAutomationController::class, 'stats'])->name('deal-automations.stats');
    Route::resource('deal-automations', DealAutomationController::class);

    // Email Templates (used by deal automation "Send Email" actions)
    Route::post('email-templates/preview', [EmailTemplateController::class, 'preview'])->name('email-templates.preview');
    Route::get('email-templates/plunk-templates', [EmailTemplateController::class, 'plunkTemplates'])->name('email-templates.plunk-templates');
    Route::get('email-templates/create-modal', [EmailTemplateController::class, 'createModal'])->name('email-templates.create-modal');
    Route::resource('email-templates', EmailTemplateController::class)->except(['show']);

    // Meta Events (used by deal automation "Meta Conversion" actions)
    Route::resource('meta-events', MetaEventController::class)->except(['show', 'create', 'edit']);

    // CRM Event Engine Settings
    Route::get('company-settings/crm-events', [SettingsController::class, 'crm_events'])->name('company-settings.crm_events');
    Route::post('crm-event-settings/change-status', [CrmEventSettingController::class, 'changeStatus'])->name('crm-event-settings.change-status');

    // CRM Event Categories
    Route::get('crm-event-categories/create', [CrmEventSettingController::class, 'createCategory'])->name('crm-event-categories.create');
    Route::post('crm-event-categories', [CrmEventSettingController::class, 'storeCategory'])->name('crm-event-categories.store');
    Route::get('crm-event-categories/{id}/edit', [CrmEventSettingController::class, 'editCategory'])->name('crm-event-categories.edit');
    Route::put('crm-event-categories/{id}', [CrmEventSettingController::class, 'updateCategory'])->name('crm-event-categories.update');
    Route::delete('crm-event-categories/{id}', [CrmEventSettingController::class, 'destroyCategory'])->name('crm-event-categories.destroy');

    // CRM Event Types
    Route::get('crm-event-types/create', [CrmEventSettingController::class, 'createType'])->name('crm-event-types.create');
    Route::post('crm-event-types', [CrmEventSettingController::class, 'storeType'])->name('crm-event-types.store');
    Route::get('crm-event-types/{id}/edit', [CrmEventSettingController::class, 'editType'])->name('crm-event-types.edit');
    Route::put('crm-event-types/{id}', [CrmEventSettingController::class, 'updateType'])->name('crm-event-types.update');
    Route::delete('crm-event-types/{id}', [CrmEventSettingController::class, 'destroyType'])->name('crm-event-types.destroy');

    // CRM Business Rules
    Route::get('crm-business-rules/create', [CrmEventSettingController::class, 'createRule'])->name('crm-business-rules.create');
    Route::post('crm-business-rules', [CrmEventSettingController::class, 'storeRule'])->name('crm-business-rules.store');
    Route::get('crm-business-rules/{id}/edit', [CrmEventSettingController::class, 'editRule'])->name('crm-business-rules.edit');
    Route::put('crm-business-rules/{id}', [CrmEventSettingController::class, 'updateRule'])->name('crm-business-rules.update');
    Route::delete('crm-business-rules/{id}', [CrmEventSettingController::class, 'destroyRule'])->name('crm-business-rules.destroy');

    // CRM Event Retention Policy
    Route::post('crm-event-retention', [CrmEventSettingController::class, 'updateRetention'])->name('crm-event-retention.update');

    Route::resource('company-settings', SettingsController::class)->only(['edit', 'update', 'index']);

    // Update App
    Route::post('update-settings/deleteFile', [UpdateAppController::class, 'deleteFile'])->name('update-settings.deleteFile');
    Route::get('update-settings/install', [UpdateAppController::class, 'install'])->name('update-settings.install');
    Route::resource('update-settings', UpdateAppController::class);
});
