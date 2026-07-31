<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GdprController;
use App\Http\Controllers\DealController;
use App\Http\Controllers\DealGatheringController;
use App\Http\Controllers\DealPropertyController;
use App\Http\Controllers\MeetingSummaryController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\AwardController;
use App\Http\Controllers\ImageController;
use App\Http\Controllers\LeaveController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\AgentReportController;
use App\Http\Controllers\NoticeController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\HolidayController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\SubTaskController;
use App\Http\Controllers\TimelogController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\EstimateController;
use App\Http\Controllers\LeadFileController;
use App\Http\Controllers\LeadNoteController;
use App\Http\Controllers\LeadFlightItineraryController;
use App\Http\Controllers\PassportController;
use App\Http\Controllers\ProposalController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\TaskFileController;
use App\Http\Controllers\TaskNoteController;
use App\Http\Controllers\ClientDocController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EventFileController;
use App\Http\Controllers\LeadBoardController;
use App\Http\Controllers\PropertyRecommendationController;
use App\Http\Controllers\LeaveFileController;
use App\Http\Controllers\QuickbookController;
use App\Http\Controllers\TaskBoardController;
use App\Http\Controllers\TaskLabelController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\ClientNoteController;
use App\Http\Controllers\CreditNoteController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\DiscussionController;
use App\Http\Controllers\LeadReportController;
use App\Http\Controllers\StickyNoteController;
use App\Http\Controllers\TaskReportController;
use App\Http\Controllers\TicketFileController;
use App\Http\Controllers\BankAccountController;
use App\Http\Controllers\DesignationController;
use App\Http\Controllers\EmployeeDocController;
use App\Http\Controllers\LeadCategoryController;
use App\Http\Controllers\MetaConversionTriggerController;
use App\Http\Controllers\LeaveReportController;
use App\Http\Controllers\LeavesQuotaController;
use App\Http\Controllers\MessageFileController;
use App\Http\Controllers\ProductFileController;
use App\Http\Controllers\ProjectFileController;
use App\Http\Controllers\ProjectNoteController;
use App\Http\Controllers\SalesReportController;
use App\Http\Controllers\SubTaskFileController;
use App\Http\Controllers\TaskCommentController;
use App\Http\Controllers\TicketReplyController;
use App\Http\Controllers\AppreciationController;
use App\Http\Controllers\ContractFileController;
use App\Http\Controllers\ContractTypeController;
use App\Http\Controllers\EmployeeVisaController;
use App\Http\Controllers\GdprSettingsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\TaskCalendarController;
use App\Http\Controllers\TaskCategoryController;
use App\Http\Controllers\InvoiceFilesController;
use App\Http\Controllers\ClientContactController;
use App\Http\Controllers\ContractRenewController;
use App\Http\Controllers\EventCalendarController;
use App\Http\Controllers\ExpenseReportController;
use App\Http\Controllers\FinanceReportController;
use App\Http\Controllers\KnowledgeBaseController;
use App\Http\Controllers\ProjectMemberController;
use App\Http\Controllers\ProjectRatingController;
use App\Http\Controllers\TimelogReportController;
use App\Http\Controllers\ClientCategoryController;
use App\Http\Controllers\LeadCustomFormController;
use App\Http\Controllers\UserPermissionController;
use App\Http\Controllers\DiscussionFilesController;
use App\Http\Controllers\DiscussionReplyController;
use App\Http\Controllers\ExpenseCategoryController;
use App\Http\Controllers\ProductCategoryController;
use App\Http\Controllers\ProjectCalendarController;
use App\Http\Controllers\ProjectCategoryController;
use App\Http\Controllers\ProjectTemplateController;
use App\Http\Controllers\TimelogCalendarController;
use App\Http\Controllers\AttendanceReportController;
use App\Http\Controllers\RecurringEventController;
use App\Http\Controllers\RecurringTaskController;
use App\Http\Controllers\ContractTemplateController;
use App\Http\Controllers\EmergencyContactController;
use App\Http\Controllers\EstimateTemplateController;

use App\Http\Controllers\ProjectMilestoneController;
use App\Http\Controllers\ProposalTemplateController;
use App\Http\Controllers\RecurringExpenseController;
use App\Http\Controllers\RecurringInvoiceController;
use App\Http\Controllers\TicketCustomFormController;
use App\Http\Controllers\ClientSubCategoryController;
use App\Http\Controllers\KnowledgeBaseFileController;
use App\Http\Controllers\ContractDiscussionController;
use App\Http\Controllers\DealNoteController;
use App\Http\Controllers\DiscussionCategoryController;
use App\Http\Controllers\ProductSubCategoryController;
use App\Http\Controllers\ProjectTemplateTaskController;
use App\Http\Controllers\ProjectTimelogBreakController;
use App\Http\Controllers\EmployeeShiftScheduleController;
use App\Http\Controllers\IncomeVsExpenseReportController;
use App\Http\Controllers\KnowledgeBaseCategoryController;
use App\Http\Controllers\ProjectTemplateMemberController;
use App\Http\Controllers\ProjectTemplateSubTaskController;
use App\Http\Controllers\EmployeeShiftChangeRequestController;
use App\Http\Controllers\EstimateRequestController;
use App\Http\Controllers\GanttLinkController;
use App\Http\Controllers\LeadContactController;
use App\Http\Controllers\LeadQualificationController;
use App\Http\Controllers\LeadSummaryController;
use App\Http\Controllers\LeadMergeController;
use App\Http\Controllers\AgentController;
use App\Http\Controllers\FormDataController;
use App\Http\Controllers\NoticeFileController;
use App\Http\Controllers\InvoicePaymentDetailController;
use App\Http\Controllers\MyCalendarController;
use App\Http\Controllers\ProjectSubCategoryController;
use App\Http\Controllers\ProjectTemplateMilestoneController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\TimelogWeeklyApprovalController;
use App\Http\Controllers\WeeklyTimesheetController;
use App\Http\Controllers\MeetingTypeController;
use App\Http\Controllers\DynamicTranslationController;
use App\Http\Controllers\I18nController;

// Signed URL route for availability request email responses (no auth required)
Route::get('availability-requests/{id}/respond/{action}', [App\Http\Controllers\PropertyAvailabilityRequestController::class, 'respondFromEmail'])
    ->name('availability-requests.respond-email')
    ->middleware('signed');

Route::group(['middleware' => 'auth', 'prefix' => 'account'], function () {
    Route::post('image/upload', [ImageController::class, 'store'])->name('image.store');

    Route::get('account-unverified', [DashboardController::class, 'accountUnverified'])->name('account_unverified');
    Route::get('checklist', [DashboardController::class, 'checklist'])->name('checklist');
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('dashboard-advanced', [DashboardController::class, 'advancedDashboard'])->name('dashboard.advanced');
    Route::post('dashboard/widget/{dashboardType}', [DashboardController::class, 'widget'])->name('dashboard.widget');
    Route::post('dashboard/week-timelog', [DashboardController::class, 'weekTimelog'])->name('dashboard.week_timelog');
    Route::get('dashboard/lead-data/{id}', [DashboardController::class, 'getLeadStage'])->name('dashboard.deal-stage-data');

    Route::get('attendances/clock-in-modal', [DashboardController::class, 'clockInModal'])->name('attendances.clock_in_modal');
    Route::post('attendances/store-clock-in', [DashboardController::class, 'storeClockIn'])->name('attendances.store_clock_in');
    Route::get('attendances/update-clock-in', [DashboardController::class, 'updateClockIn'])->name('attendances.update_clock_in');
    Route::get('attendances/show_clocked_hours', [DashboardController::class, 'showClockedHours'])->name('attendances.show_clocked_hours');
    Route::get('dashboard/private_calendar', [DashboardController::class, 'privateCalendar'])->name('dashboard.private_calendar');
    Route::get('/pusher/beams-auth', [DashboardController::class, 'beamAuth'])->name('dashboard.beam_auth');

    Route::get('settings/change-language', [SettingsController::class, 'changeLanguage'])->name('settings.change_language');
    Route::get('settings/deal-automations', [SettingsController::class, 'deal_automations'])->name('settings.deal_automations');
    Route::resource('settings', SettingsController::class)->only(['edit', 'update', 'index', 'change_language', 'deal_automations']);


    Route::post('approve/{id}', [ClientController::class, 'approve'])->name('clients.approve');
    Route::post('save-consent-purpose-data/{client}', [ClientController::class, 'saveConsentLeadData'])->name('clients.save_consent_purpose_data');
    Route::get('clients/gdpr-consent', [ClientController::class, 'consent'])->name('clients.gdpr_consent');
    Route::post('clients/save-client-consent/{lead}', [ClientController::class, 'saveClientConsent'])->name('clients.save_client_consent');
    Route::post('clients/ajax-details/{id}', [ClientController::class, 'ajaxDetails'])->name('clients.ajax_details');
    Route::get('clients/client-details/{id}', [ClientController::class, 'clientDetails'])->name('clients.client_details');
    Route::post('clients/project-list/{id}', [ClientController::class, 'projectList'])->name('clients.project_list');
    Route::post('clients/apply-quick-action', [ClientController::class, 'applyQuickAction'])->name('clients.apply_quick_action');
    Route::get('clients/import', [ClientController::class, 'importClient'])->name('clients.import');
    Route::post('clients/import', [ClientController::class, 'importStore'])->name('clients.import.store');
    Route::post('clients/import/process', [ClientController::class, 'importProcess'])->name('clients.import.process');
    Route::get('clients/finance-count/{id}', [ClientController::class, 'financeCount'])->name('clients.finance_count');
    Route::resource('clients', ClientController::class);

    Route::post('client-contacts/apply-quick-action', [ClientContactController::class, 'applyQuickAction'])->name('client-contacts.apply_quick_action');
    Route::get('get-contacts', [ClientContactController::class, 'getContacts'])->name('get.contacts');
    Route::resource('client-contacts', ClientContactController::class);

    Route::get('client-notes/ask-for-password/{id}', [ClientNoteController::class, 'askForPassword'])->name('client_notes.ask_for_password');
    Route::post('client-notes/check-password', [ClientNoteController::class, 'checkPassword'])->name('client_notes.check_password');
    Route::post('client-notes/apply-quick-action', [ClientNoteController::class, 'applyQuickAction'])->name('client-notes.apply_quick_action');
    Route::post('client-notes/showVerified/{id}', [ClientNoteController::class, 'showVerified'])->name('client-notes.show_verified');
    Route::resource('client-notes', ClientNoteController::class);

    Route::get('client-docs/download/{id}', [ClientDocController::class, 'download'])->name('client-docs.download');
    Route::resource('client-docs', ClientDocController::class);

    // client category & subcategory
    Route::resource('clientCategory', ClientCategoryController::class);

    Route::get('getClientSubCategories/{id}', [ClientSubCategoryController::class, 'getSubCategories'])->name('get_client_sub_categories');
    Route::resource('clientSubCategory', ClientSubCategoryController::class);

    // employee Promotion
    Route::resource('promotions', PromotionController::class);

    // employee routes
    Route::post('employees/apply-quick-action', [EmployeeController::class, 'applyQuickAction'])->name('employees.apply_quick_action');
    Route::post('employees/assignRole', [EmployeeController::class, 'assignRole'])->name('employees.assign_role');
    Route::get('employees/byDepartment/{id}', [EmployeeController::class, 'byDepartment'])->name('employees.by_department');
    Route::get('employees/invite-member', [EmployeeController::class, 'inviteMember'])->name('employees.invite_member');
    Route::get('employees/import', [EmployeeController::class, 'importMember'])->name('employees.import');
    Route::post('employees/import', [EmployeeController::class, 'importStore'])->name('employees.import.store');
    Route::post('employees/import/process', [EmployeeController::class, 'importProcess'])->name('employees.import.process');
    Route::get('import/process/{name}/{id}', [ImportController::class, 'getImportProgress'])->name('import.process.progress');

    Route::get('employees/import/exception/{name}', [ImportController::class, 'getQueueException'])->name('import.process.exception');
    Route::post('employees/send-invite', [EmployeeController::class, 'sendInvite'])->name('employees.send_invite');
    Route::post('employees/create-link', [EmployeeController::class, 'createLink'])->name('employees.create_link');
    Route::post('/get-exit-date-message', [EmployeeController::class, 'getExitDateMessage'])->name('getExitDateMessage');
    Route::resource('employees', EmployeeController::class);
    Route::resource('passport', PassportController::class);
    Route::resource('employee-visa', EmployeeVisaController::class);

    Route::resource('emergency-contacts', EmergencyContactController::class);

    Route::get('employee-docs/download/{id}', [EmployeeDocController::class, 'download'])->name('employee-docs.download');
    Route::resource('employee-docs', EmployeeDocController::class);

    Route::get('employee-leaves/employeeLeaveTypes/{id}', [LeavesQuotaController::class, 'employeeLeaveTypes'])->name('employee-leaves.employee_leave_types');
    Route::resource('employee-leaves', LeavesQuotaController::class);

    Route::get('designations/designation-hierarchy', [DesignationController::class, 'hierarchyData'])->name('designation.hierarchy');
    Route::post('designations/changeParent', [DesignationController::class, 'changeParent'])->name('designation.changeParent');
    Route::post('designations/search-filter', [DesignationController::class, 'searchFilter'])->name('designation.srchFilter');
    Route::post('designations/apply-quick-action', [DesignationController::class, 'applyQuickAction'])->name('designations.apply_quick_action');
    Route::resource('designations', DesignationController::class);

    Route::post('departments/apply-quick-action', [DepartmentController::class, 'applyQuickAction'])->name('departments.apply_quick_action');
    Route::get('departments/department-hierarchy', [DepartmentController::class, 'hierarchyData'])->name('department.hierarchy');
    Route::post('department/changeParent', [DepartmentController::class, 'changeParent'])->name('department.changeParent');
    Route::get('department/search', [DepartmentController::class, 'searchDepartment'])->name('departments.search');
    Route::get('department/{id}', [DepartmentController::class, 'getMembers'])->name('departments.members');
    Route::resource('departments', DepartmentController::class);

    Route::post('user-permissions/customPermissions/{id}', [UserPermissionController::class, 'customPermissions'])->name('user-permissions.custom_permissions');
    Route::post('user-permissions/resetPermissions/{id}', [UserPermissionController::class, 'resetPermissions'])->name('user-permissions.reset_permissions');
    Route::resource('user-permissions', UserPermissionController::class);

    /* PROJECTS */
    Route::resource('projectCategory', ProjectCategoryController::class);
    Route::post('projects/change-status', [ProjectController::class, 'changeProjectStatus'])->name('projects.change_status');

    Route::resource('ProjectSubCategory', ProjectSubCategoryController::class);
    Route::get('get_project_sub_category/{id}', [ProjectSubCategoryController::class, 'getSubCategories'])->name('project.get_project_sub_category');


    Route::group(
        ['prefix' => 'projects'],
        function () {

            Route::get('import', [ProjectController::class, 'importProject'])->name('projects.import');
            Route::post('import', [ProjectController::class, 'importStore'])->name('projects.import.store');
            Route::post('import/process', [ProjectController::class, 'importProcess'])->name('projects.import.process');

            Route::post('assignProjectAdmin', [ProjectController::class, 'assignProjectAdmin'])->name('projects.assign_project_admin');
            Route::post('archive-restore/{id}', [ProjectController::class, 'archiveRestore'])->name('projects.archive_restore');
            Route::post('archive-delete/{id}', [ProjectController::class, 'archiveDestroy'])->name('projects.archive_delete');
            Route::get('archive', [ProjectController::class, 'archive'])->name('projects.archive');
            Route::post('apply-quick-action', [ProjectController::class, 'applyQuickAction'])->name('projects.apply_quick_action');
            Route::post('updateStatus/{id}', [ProjectController::class, 'updateStatus'])->name('projects.update_status');
            Route::post('store-pin', [ProjectController::class, 'storePin'])->name('projects.store_pin');
            Route::post('destroy-pin/{id}', [ProjectController::class, 'destroyPin'])->name('projects.destroy_pin');
            Route::post('gantt-data', [ProjectController::class, 'ganttData'])->name('projects.gantt_data');
            Route::post('invoiceList/{id}', [ProjectController::class, 'invoiceList'])->name('projects.invoice_list');
            Route::get('duplicate-project/{id}', [ProjectController::class, 'duplicateProject'])->name('projects.duplicate_project');

            Route::get('members/{id}', [ProjectController::class, 'members'])->name('projects.members');
            Route::get('pendingTasks/{id}', [ProjectController::class, 'pendingTasks'])->name('projects.pendingTasks');
            Route::get('labels/{id}', [TaskLabelController::class, 'labels'])->name('projects.labels');

            Route::post('project-members/save-group', [ProjectMemberController::class, 'storeGroup'])->name('project-members.store_group');
            Route::resource('project-members', ProjectMemberController::class);

            Route::post('files/store-link', [ProjectFileController::class, 'storeLink'])->name('files.store_link');
            Route::get('files/download/{id}', [ProjectFileController::class, 'download'])->name('files.download');
            Route::get('files/thumbnail', [ProjectFileController::class, 'thumbnailShow'])->name('files.thumbnail');
            Route::post('files/multiple-upload', [ProjectFileController::class, 'storeMultiple'])->name('files.multiple_upload');
            Route::resource('files', ProjectFileController::class);

            Route::get('milestones/byProject/{id}', [ProjectMilestoneController::class, 'byProject'])->name('milestones.by_project');
            Route::post('/milestones/{id}/update-status', [ProjectMilestoneController::class, 'updateStatus'])->name('milestones.updateStatus');
            Route::resource('milestones', ProjectMilestoneController::class);


            // Discussion category routes
            Route::resource('discussion-category', DiscussionCategoryController::class);
            Route::post('discussion/setBestAnswer', [DiscussionController::class, 'setBestAnswer'])->name('discussion.set_best_answer');
            Route::resource('discussion', DiscussionController::class);
            Route::get('discussion-reply/get-replies/{id}', [DiscussionReplyController::class, 'getReplies'])->name('discussion-reply.get_replies');
            Route::resource('discussion-reply', DiscussionReplyController::class);

            // Discussion Files
            Route::get('discussion-files/download/{id}', [DiscussionFilesController::class, 'download'])->name('discussion_file.download');
            Route::resource('discussion-files', DiscussionFilesController::class);

            // Rating routes
            Route::resource('project-ratings', ProjectRatingController::class);

            Route::get('projects/burndown/{projectId?}', [ProjectController::class, 'burndown'])->name('projects.burndown');

            /* PROJECT TEMPLATE */
            Route::post('project-template/apply-quick-action', [ProjectTemplateController::class, 'applyQuickAction'])->name('project_template.apply_quick_action');
            Route::resource('project-template', ProjectTemplateController::class);
            Route::post('project-template-members/save-group', [ProjectTemplateMemberController::class, 'storeGroup'])->name('project_template_members.store_group');
            Route::resource('project-template-member', ProjectTemplateMemberController::class);
            Route::get('project-template-task/data/{templateId?}', [ProjectTemplateTaskController::class, 'data'])->name('project_template_task.data');
            Route::get('project-template-milestones/byProject/{id}', [ProjectTemplateMilestoneController::class, 'byProject'])->name('project-template-milestone.by_project');
            Route::post('/project-template-milestones/{id}/update-status', [ProjectTemplateMilestoneController::class, 'updateStatus'])->name('project-template-milestone.updateStatus');
            Route::resource('project-template-task', ProjectTemplateTaskController::class);
            Route::resource('project-template-milestone', ProjectTemplateMilestoneController::class);
            Route::resource('project-template-sub-task', ProjectTemplateSubTaskController::class);
            Route::resource('project-calendar', ProjectCalendarController::class);
        }
    );

    Route::get('project-notes/ask-for-password/{id}', [ProjectNoteController::class, 'askForPassword'])->name('project_notes.ask_for_password');
    Route::post('project-notes/check-password', [ProjectNoteController::class, 'checkPassword'])->name('project_notes.check_password');
    Route::post('project-notes/apply-quick-action', [ProjectNoteController::class, 'applyQuickAction'])->name('project_notes.apply_quick_action');
    Route::resource('project-notes', ProjectNoteController::class);
    Route::get('projects-ajax', [ProjectController::class, 'ajaxLoadProject'])->name('get.projects-ajax');
    Route::get('get-projects', [ProjectController::class, 'getProjects'])->name('get.projects');
    Route::resource('projects', ProjectController::class);

    /* PRODUCTS */
    Route::post('products/apply-quick-action', [ProductController::class, 'applyQuickAction'])->name('products.apply_quick_action');
    Route::post('products/remove-cart-item/{id}', [ProductController::class, 'removeCartItem'])->name('products.remove_cart_item');
    Route::get('products/options', [ProductController::class, 'allProductOption'])->name('products.options');


    Route::post('products/add-cart-item', [ProductController::class, 'addCartItem'])->name('products.add_cart_item');
    Route::get('products/cart', [ProductController::class, 'cart'])->name('products.cart');
    Route::get('products/empty-cart', [ProductController::class, 'emptyCart'])->name('products.empty_cart');

    /* Product Import */
    Route::group(
        ['prefix' => 'products'],
        function () {
            Route::get('import', [ProductController::class, 'importProduct'])->name('products.import');
            Route::post('import', [ProductController::class, 'importStore'])->name('products.import.store');
            Route::post('import/process', [ProductController::class, 'importProcess'])->name('products.import.process');
        }
    );

    Route::resource('products', ProductController::class);
    Route::resource('productCategory', ProductCategoryController::class);
    Route::get('getProductSubCategories/{id}', [ProductSubCategoryController::class, 'getSubCategories'])->name('get_product_sub_categories');
    Route::resource('productSubCategory', ProductSubCategoryController::class);

    /* PRODUCT FILES */
    Route::get('product-files/download/{id}', [ProductFileController::class, 'download'])->name('product-files.download');
    Route::post('product-files/delete-image/{id}', [ProductFileController::class, 'deleteImage'])->name('product-files.delete_image');
    Route::post('product-files/update-images', [ProductFileController::class, 'updateImages'])->name('product-files.update_images');
    Route::resource('product-files', ProductFileController::class);

    /* INVOICE FILES */
    Route::get('invoice-files/download/{id}', [InvoiceFilesController::class, 'download'])->name('invoice-files.download');
    Route::resource('invoice-files', InvoiceFilesController::class);


    /* Payments */
    Route::get('orders/offline-payment-modal', [OrderController::class, 'offlinePaymentModal'])->name('orders.offline_payment_modal');
    Route::get('orders/add-item', [OrderController::class, 'addItem'])->name('orders.add_item');
    Route::get('orders/stripe-modal', [OrderController::class, 'stripeModal'])->name('orders.stripe_modal');
    Route::post('orders/make-invoice/{orderId}', [OrderController::class, 'makeInvoice'])->name('orders.make_invoice');

    Route::post('orders/payment-failed/{orderId}', [OrderController::class, 'paymentFailed'])->name('orders.payment_failed');
    Route::post('orders/save-stripe-detail/', [OrderController::class, 'saveStripeDetail'])->name('orders.save_stripe_detail');
    Route::post('orders/change-status/', [OrderController::class, 'changeStatus'])->name('orders.change_status');
    /* Payments */
    Route::get('orders/download/{id}', [OrderController::class, 'download'])->name('orders.download');
    Route::post('orders/store-quantity/', [OrderController::class, 'storeQuantity'])->name('orders.store_quantity');


    /* Orders */
    Route::resource('orders', OrderController::class);


    /* NOTICE */
    Route::post('notices/apply-quick-action', [NoticeController::class, 'applyQuickAction'])->name('notices.apply_quick_action');
    Route::resource('notices', NoticeController::class);

    /* Notice files */
    Route::get('notice-files/download/{id}', [NoticeFileController::class, 'download'])->name('notice_files.download');
    Route::resource('notice-files', NoticeFileController::class);

    /* User Appreciation */
    Route::group(
        ['prefix' => 'appreciations'],
        function () {
            Route::post('awards/apply-quick-action', [AwardController::class, 'applyQuickAction'])->name('awards.apply_quick_action');
            Route::post('awards/change-status/{id?}', [AwardController::class, 'changeStatus'])->name('awards.change-status');
            Route::get('awards/quick-create', [AwardController::class, 'quickCreate'])->name('awards.quick-create');
            Route::post('awards/quick-store', [AwardController::class, 'quickStore'])->name('awards.quick-store');
            Route::resource('awards', AwardController::class);
        }
    );
    Route::post('appreciations/apply-quick-action', [AppreciationController::class, 'applyQuickAction'])->name('appreciations.apply_quick_action');
    Route::resource('appreciations', AppreciationController::class);

    /* KnowledgeBase */
    Route::get('knowledgebase/create/{id?}', [KnowledgeBaseController::class, 'create'])->name('knowledgebase.create');
    Route::post('knowledgebase/apply-quick-action', [KnowledgeBaseController::class, 'applyQuickAction'])->name('knowledgebase.apply_quick_action');
    Route::get('knowledgebase/searchquery/{query?}', [KnowledgeBaseController::class, 'searchQuery'])->name('knowledgebase.searchQuery');
    Route::resource('knowledgebase', KnowledgeBaseController::class)->except(['create']);

    Route::get('knowledgebase-files/download/{id}', [KnowledgeBaseFileController::class, 'download'])->name('knowledgebase-files.download');
    Route::resource('knowledgebase-files', KnowledgeBaseFileController::class);

    /* KnowledgeBase category */
    Route::resource('knowledgebasecategory', KnowledgeBaseCategoryController::class);


    Route::group(['prefix' => 'events'], function () {
        Route::post('recurring-event/event-monthly-on', [RecurringEventController::class, 'monthlyOn'])->name('recurring-event.monthly_on');
        Route::post('recurring-event/apply-quick-action', [RecurringEventController::class, 'applyQuickAction'])->name('recurring-event.apply_quick_action');
        Route::resource('recurring-event', RecurringEventController::class);
        Route::post('recurring-event/updateStatus/{id}', [RecurringEventController::class, 'updateStatus'])->name('recurring-event.update_status');
        Route::get('recurring-event/event-status-note/{id}', [RecurringEventController::class, 'eventStatusNote'])->name('recurring-event.event_status_note');
    });

    /* EVENTS */
    Route::post('event-monthly-on', [EventCalendarController::class, 'monthlyOn'])->name('events.monthly_on');
    Route::get('events/table-view', [EventCalendarController::class, 'tableView'])->name('events.table_view');
    Route::post('events/apply-quick-action', [EventCalendarController::class, 'applyQuickAction'])->name('events.apply_quick_action');
    Route::resource('events', EventCalendarController::class);
    Route::post('updateStatus/{id}', [EventCalendarController::class, 'updateStatus'])->name('events.update_status');
    Route::get('events/event-status-note/{id}', [EventCalendarController::class, 'eventStatusNote'])->name('events.event_status_note');

    /* My Calendar */
    Route::get('my-calendar', [MyCalendarController::class, 'index'])->name('my-calendar.index');


    /* Event Files */
    Route::get('event-files/download/{id}', [EventFileController::class, 'download'])->name('event-files.download');
    Route::resource('event-files', EventFileController::class);

    /* TASKS */
    Route::get('tasks/client-detail', [TaskController::class, 'clientDetail'])->name('tasks.clientDetail');
    Route::post('tasks/change-status', [TaskController::class, 'changeStatus'])->name('tasks.change_status');
    Route::post('tasks/change-milestone', [TaskController::class, 'milestoneChange'])->name('tasks.change_milestone');

    Route::post('tasks/apply-quick-action', [TaskController::class, 'applyQuickAction'])->name('tasks.apply_quick_action');
    Route::post('tasks/store-pin', [TaskController::class, 'storePin'])->name('tasks.store_pin');
    Route::post('tasks/reminder', [TaskController::class, 'reminder'])->name('tasks.reminder');
    Route::post('tasks/destroy-pin/{id}', [TaskController::class, 'destroyPin'])->name('tasks.destroy_pin');
    Route::post('tasks/check-task/{taskID}', [TaskController::class, 'checkTask'])->name('tasks.check_task');
    Route::post('tasks/send-approval', [TaskController::class, 'sendApproval'])->name('tasks.send_approval');
    Route::post('tasks/gantt-task-update/{id}', [TaskController::class, 'updateTaskDuration'])->name('tasks.gantt_task_update');
    Route::get('tasks/members/{id}', [TaskController::class, 'members'])->name('tasks.members');
    Route::get('tasks/project_tasks/{id}', [TaskController::class, 'projectTasks'])->name('tasks.project_tasks');
    Route::get('tasks/check-leaves', [TaskController::class, 'checkLeaves'])->name('tasks.checkLeaves');
    Route::get('tasks/data/{id}', [TaskController::class, 'data'])->name('tasks.data');
    Route::get('tasks/waiting-approval', [TaskController::class, 'waitingApproval'])->name('tasks.waiting-approval');
    Route::get('tasks/show-waiting-approval-change-status-modal', [TaskController::class, 'statusReason'])->name('tasks.show_status_reason_modal');
    Route::post('tasks/store-status-reason', [TaskController::class, 'storeStatusReason'])->name('tasks.store_comment_on_change_status');

    Route::group(['prefix' => 'tasks'], function () {

        Route::post('recurring-task/apply-quick-action', [RecurringTaskController::class, 'applyQuickAction'])->name('recurring-task.apply_quick_action');
        Route::resource('recurring-task', RecurringTaskController::class);

        Route::resource('task-label', TaskLabelController::class);
        Route::resource('taskCategory', TaskCategoryController::class);
        Route::post('taskComment/save-comment-like', [TaskCommentController::class, 'saveCommentLike'])->name('taskComment.save_comment_like');
        Route::resource('taskComment', TaskCommentController::class);
        Route::resource('task-note', TaskNoteController::class);

        // task files routes
        Route::get('task-files/download/{id}', [TaskFileController::class, 'download'])->name('task_files.download');
        Route::resource('task-files', TaskFileController::class);

        // Sub task routes
        Route::post('sub-task/change-status', [SubTaskController::class, 'changeStatus'])->name('sub_tasks.change_status');
        Route::resource('sub-tasks', SubTaskController::class);

        // Task files routes
        Route::get('sub-task-files/download/{id}', [SubTaskFileController::class, 'download'])->name('sub-task-files.download');
        Route::resource('sub-task-files', SubTaskFileController::class);

        // Taskboard routes
        Route::post('taskboards/collapseColumn', [TaskBoardController::class, 'collapseColumn'])->name('taskboards.collapse_column');
        Route::post('taskboards/updateIndex', [TaskBoardController::class, 'updateIndex'])->name('taskboards.update_index');
        Route::get('taskboards/loadMore', [TaskBoardController::class, 'loadMore'])->name('taskboards.load_more');
        Route::resource('taskboards', TaskBoardController::class);

        Route::resource('task-calendar', TaskCalendarController::class);
    });

    Route::resource('tasks', TaskController::class);

    // Holidays
    Route::get('holidays/mark-holiday', [HolidayController::class, 'markHoliday'])->name('holidays.mark_holiday');
    Route::post('holidays/mark-holiday-store', [HolidayController::class, 'markDayHoliday'])->name('holidays.mark_holiday_store');
    Route::get('holidays/table-view', [HolidayController::class, 'tableView'])->name('holidays.table_view');
    Route::post('holidays/apply-quick-action', [HolidayController::class, 'applyQuickAction'])->name('holidays.apply_quick_action');
    Route::resource('holidays', HolidayController::class);

    // Lead Files
    Route::get('deal-files/download/{id}', [LeadFileController::class, 'download'])->name('deal-files.download');
    Route::get('deal-files/layout', [LeadFileController::class, 'layout'])->name('deal-files.layout');
    Route::post('deal-files/store-external', [LeadFileController::class, 'storeFromExternal'])->name('deal-files.store-external');
    Route::resource('deal-files', LeadFileController::class);

    // Follow up
    Route::get('deals/follow-up/{leadID}', [DealController::class, 'followUpCreate'])->name('deals.follow_up');
    Route::post('deals/follow-up-store', [DealController::class, 'followUpStore'])->name('deals.follow_up_store');
    Route::get('deals/follow-up-edit/{id?}', [DealController::class, 'editFollow'])->name('deals.follow_up_edit');
    Route::post('deals/follow-up-update', [DealController::class, 'updateFollow'])->name('deals.follow_up_update');
    Route::post('deals/follow-up-delete/{id}', [DealController::class, 'deleteFollow'])->name('deals.follow_up_delete');
    Route::post('deals/follow-up-apply-quick-action', [DealController::class, 'applyFollowUpQuickAction'])->name('deals.follow_up_apply_quick_action');

    // Change status
    Route::get('stage-change/{id}', [DealController::class, 'stageChange'])->name('deals.stage_change');
    Route::post('save-stage-change', [DealController::class, 'saveStageChange'])->name('deals.save_stage_change');
    Route::post('deals/change-stage', [DealController::class, 'changeStage'])->name('deals.change_stage');
    Route::post('deals/change-agent', [DealController::class, 'changeAgent'])->name('deals.change_agent');
    Route::post('deals/apply-quick-action', [DealController::class, 'applyQuickAction'])->name('deals.apply_quick_action');

    Route::get('deals/gdpr-consent', [DealController::class, 'consent'])->name('deals.gdpr_consent');
    Route::post('deals/save-deal-consent/{deal}', [DealController::class, 'saveLeadConsent'])->name('deals.save_lead_consent');
    Route::post('deals/change-follow-up-status', [DealController::class, 'changeFollowUpStatus'])->name('deals.change_follow_up_status');
    Route::post('deals/generate-meeting-link', [DealController::class, 'generateMeetingLink'])->name('deals.generate-meeting-link');

    // Calendar Sync (OL /crm/events; platform=zoho today)
    Route::post(
        'follow-ups/{followUp}/calendar-sync/retry',
        [\App\Http\Controllers\CalendarSyncController::class, 'retry']
    )->name('calendar_sync.retry');
    Route::get(
        'follow-ups/{followUp}/calendar-sync/status',
        [\App\Http\Controllers\CalendarSyncController::class, 'status']
    )->name('calendar_sync.status');

    // Lead Category
    Route::post('/update-lead-category', [LeadCategoryController::class, 'updateLeadCategory'])->name('category.updateDefault');
    Route::resource('leadCategory', LeadCategoryController::class);

    // Lead Note
    Route::get('lead-notes/ask-for-password/{id}', [LeadNoteController::class, 'askForPassword'])->name('lead-notes.ask_for_password');
    Route::post('lead-notes/check-password', [LeadNoteController::class, 'checkPassword'])->name('lead-notes.check_password');
    Route::post('lead-notes/apply-quick-action', [LeadNoteController::class, 'applyQuickAction'])->name('lead-notes.apply_quick_action');

    Route::resource('lead-notes', LeadNoteController::class);

    Route::resource('lead-flight-itineraries', LeadFlightItineraryController::class)->only(['store', 'update', 'destroy']);

    // Deal Note
    Route::post('deal-notes/apply-quick-action', [DealNoteController::class, 'applyQuickAction'])->name('deal-notes.apply_quick_action');
    Route::resource('deal-notes', DealNoteController::class);

    // Product tours (guided page walkthroughs) — page-agnostic, reused by any page's ProductTour instance
    Route::post('product-tours/{tourId}/seen', [\App\Http\Controllers\ProductTourController::class, 'markSeen'])->name('product-tours.seen');

    // deal board routes
    Route::post('leadboards/get-stage-slug', [LeadBoardController::class, 'getStageSlug'])->name('leadboards.get_stage_slug');
    Route::post('leadboards/collapseColumn', [LeadBoardController::class, 'collapseColumn'])->name('leadboards.collapse_column');
    Route::post('leadboards/updateIndex', [LeadBoardController::class, 'updateIndex'])->name('leadboards.update_index');
    Route::get('leadboards/deals', [LeadBoardController::class, 'getBoardDeals'])->name('leadboards.deals');
    Route::get('leadboards/loadMore', [LeadBoardController::class, 'loadMore'])->name('leadboards.load_more');
    Route::resource('leadboards', LeadBoardController::class);

    Route::post('lead-form/sortFields', [LeadCustomFormController::class, 'sortFields'])->name('lead-form.sortFields');
    Route::resource('lead-form', LeadCustomFormController::class);

    Route::group(['prefix' => 'deals'], function () {
        Route::get('import', [DealController::class, 'importLead'])->name('deals.import');
        Route::post('import', [DealController::class, 'importStore'])->name('deals.import.store');
        Route::post('import/process', [DealController::class, 'importProcess'])->name('deals.import.process');
        Route::get('import/download-sample', [DealController::class, 'downloadSampleImport'])->name('deals.import.download-sample');
    });

    Route::group(['prefix' => 'lead-contact'], function () {
        Route::get('import', [LeadContactController::class, 'importLead'])->name('lead-contact.import');
        Route::post('import', [LeadContactController::class, 'importStore'])->name('lead-contact.import.store');
        Route::post('import/process', [LeadContactController::class, 'importProcess'])->name('lead-contact.import.process');
        Route::get('sample-import', [LeadContactController::class, 'downloadSampleImport'])->name('lead-contact.sample_import');
        Route::post('apply-quick-action', [LeadContactController::class, 'applyQuickAction'])->name('lead-contact.apply_quick_action');
    });

    // Form Data API routes for performance optimization
    Route::prefix('api/form-data')->group(function () {
        Route::get('{type}', [FormDataController::class, 'index'])->name('form-data.index');
        Route::post('batch', [FormDataController::class, 'batch'])->name('form-data.batch');
    });

    // Dynamic translation lookup API (auth-protected)
    Route::prefix('api/dynamic-translations')->group(function () {
        Route::post('batch', [DynamicTranslationController::class, 'batch'])->name('dynamic-translations.batch');
    });

    // Static i18n dictionaries (auth-protected; cached per locale)
    Route::get('api/i18n/{locale}.json', [I18nController::class, 'show'])->name('i18n.show');
    // deals route

    // Lead Contact routes (explicit to avoid Route::resource overriding PUT/PATCH)
    Route::get('lead-contact', [LeadContactController::class, 'index'])->name('lead-contact.index');
    Route::get('lead-contact/create', [LeadContactController::class, 'create'])->name('lead-contact.create');
    Route::post('lead-contact', [LeadContactController::class, 'store'])->name('lead-contact.store');
    Route::get('lead-contact/{lead_contact}', [LeadContactController::class, 'show'])->name('lead-contact.show');
    Route::get('lead-contact/{lead_contact}/edit', [LeadContactController::class, 'edit'])->name('lead-contact.edit');
    Route::put('lead-contact/{lead_contact}', [LeadContactController::class, 'update'])->name('lead-contact.update');
    Route::patch('lead-contact/{lead_contact}', [LeadContactController::class, 'patch'])->name('lead-contact.patch');
    Route::delete('lead-contact/{lead_contact}', [LeadContactController::class, 'destroy'])->name('lead-contact.destroy');

    // Lead qualification routes
    Route::get('lead-contact/{lead}/qualifications', [LeadQualificationController::class, 'index'])->name('lead-qualifications.index');
    Route::post('lead-contact/{lead}/qualifications', [LeadQualificationController::class, 'store'])->name('lead-qualifications.store');
    Route::patch('lead-qualifications/{qualification}/answers', [LeadQualificationController::class, 'upsertAnswer'])->name('lead-qualifications.answers');
    Route::patch('lead-qualifications/{qualification}/navigation', [LeadQualificationController::class, 'updateNavigation'])->name('lead-qualifications.navigation');
    Route::post('lead-qualifications/{qualification}/complete', [LeadQualificationController::class, 'complete'])->name('lead-qualifications.complete');
    Route::post('lead-qualifications/{qualification}/abandon', [LeadQualificationController::class, 'abandon'])->name('lead-qualifications.abandon');
    Route::delete('lead-qualifications/{qualification}/branch-answers', [LeadQualificationController::class, 'clearBranchAnswers'])->name('lead-qualifications.clear-branch-answers');

    Route::get('lead-contact/{lead}/ai-summary', [LeadSummaryController::class, 'show'])->name('lead-contact.ai-summary');
    Route::post('lead-contact/{lead}/ai-summary/regenerate', [LeadSummaryController::class, 'regenerate'])->name('lead-contact.ai-summary.regenerate');
    Route::get('lead-contact/{lead}/custom-fields', [LeadContactController::class, 'getCustomFields'])->name('lead-contact.custom-fields');
    Route::post('lead-contact/{lead}/merge', [LeadMergeController::class, 'merge'])->name('lead-contact.merge');
    Route::get('lead-contact/{lead}/duplicates', [LeadMergeController::class, 'duplicates'])->name('lead-contact.duplicates');
    Route::post('lead-contact/{lead}/duplicates', [LeadMergeController::class, 'duplicates'])->name('lead-contact.duplicates.find');
    Route::get('lead-contact/{lead}/merge-review/{duplicate}', [LeadMergeController::class, 'review'])->name('lead-contact.merge-review');

    // Agent management routes
    Route::group(['prefix' => 'agents'], function () {
        Route::post('apply-quick-action', [AgentController::class, 'applyQuickAction'])->name('agents.apply_quick_action');
        Route::get('import', [AgentController::class, 'importAgents'])->name('agents.import');
        Route::post('import', [AgentController::class, 'importStore'])->name('agents.import.store');
        Route::post('import/process', [AgentController::class, 'importProcess'])->name('agents.import.process');
        Route::get('sample-import', [AgentController::class, 'downloadSampleImport'])->name('agents.sample_import');
    });

    Route::get('agents', [AgentController::class, 'index'])->name('agents.index');
    Route::get('agents/create', [AgentController::class, 'create'])->name('agents.create');
    Route::post('agents', [AgentController::class, 'store'])->name('agents.store');
    Route::get('agents/{agent}', [AgentController::class, 'show'])->name('agents.show');
    Route::get('agents/{agent}/edit', [AgentController::class, 'edit'])->name('agents.edit');
    Route::put('agents/{agent}', [AgentController::class, 'update'])->name('agents.update');
    Route::delete('agents/{agent}', [AgentController::class, 'destroy'])->name('agents.destroy');

    Route::get('deals/get-stage/{id}', [DealController::class, 'getStages'])->name('deals.get-stage');
    Route::get('deals/get-deals/{id}', [DealController::class, 'getDeals'])->name('deals.get-deals');
    Route::get('deals/get-agent/{id}', [DealController::class, 'getAgents'])->name('deals.get_agents');
    Route::get('deals/kanban', [LeadBoardController::class, 'index'])->name('deals.kanban_index');
    Route::get('deals/kanban-deals', [DealController::class, 'getKanbanDeals'])->name('deals.kanban_deals');
    
    Route::group(['prefix' => 'deals', 'as' => 'deals.'], function () {
        Route::post('gathering/init', [DealGatheringController::class, 'init'])->name('gathering.init');
        Route::get('gathering/steps', [DealGatheringController::class, 'getSteps'])->name('gathering.steps');
        Route::get('gathering/search-leads', [DealGatheringController::class, 'searchLeads'])->name('gathering.search_leads');
        Route::patch('gathering/update-step/{id}', [DealGatheringController::class, 'updateStep'])->name('gathering.update_step');
        Route::get('gathering/custom-fields/{id}', [DealGatheringController::class, 'getDealCustomFields'])->name('gathering.get_custom_fields');
        // Accept both POST (for file uploads with method spoofing) and PATCH
        Route::match(['post', 'patch'], 'gathering/inline-update/{id}', [DealGatheringController::class, 'updateInline'])->name('gathering.inline_update');
    });

    // Explicit deal routes (no resource)
    Route::get('deals', [DealController::class, 'index'])->name('deals.index');
    Route::get('deals/create', [DealController::class, 'create'])->name('deals.create');
    Route::post('deals', [DealController::class, 'store'])->name('deals.store');
    Route::get('deals/{deal}', [DealController::class, 'show'])->name('deals.show');
    Route::get('deals/{deal}/refresh', [DealController::class, 'refresh'])->name('deals.refresh');
    Route::get('deals/{deal}/ai-summary', [\App\Http\Controllers\DealSummaryController::class, 'show'])->name('deals.ai-summary');
    Route::post('deals/{deal}/ai-summary/regenerate', [\App\Http\Controllers\DealSummaryController::class, 'regenerate'])->name('deals.ai-summary.regenerate');
    Route::get('deals/{deal}/edit', [DealController::class, 'edit'])->name('deals.edit');
    Route::put('deals/{deal}', [DealController::class, 'update'])->name('deals.update');
    Route::patch('deals/{deal}', [DealController::class, 'patch'])->name('deals.patch');
    Route::delete('deals/{deal}', [DealController::class, 'destroy'])->name('deals.destroy');
    Route::post('deals/{id}/tasks/default', [TaskController::class, 'storeDefaultTask'])->name('deals.tasks.default');

    // Deal Properties (attach/detach)
    Route::group(['prefix' => 'deals', 'as' => 'deals.'], function () {
        Route::get('properties/search', [DealPropertyController::class, 'searchProperties'])->name('properties.search');
        Route::get('properties/project-unit-types/{project}', [DealPropertyController::class, 'projectUnitTypes'])->name('properties.unit_types');
        Route::get('{deal}/properties', [DealPropertyController::class, 'index'])->name('properties.index');
        Route::post('{deal}/properties', [DealPropertyController::class, 'store'])->name('properties.store');
        Route::delete('{deal}/properties/{product}', [DealPropertyController::class, 'destroy'])->name('properties.destroy');
    });

    // Property Recommendations
    Route::group(['prefix' => 'deals/{deal}/recommendations', 'as' => 'deals.recommendations.'], function () {
        Route::get('/', [PropertyRecommendationController::class, 'getRecommendations'])->name('index');
        Route::post('/refresh', [PropertyRecommendationController::class, 'refreshRecommendations'])->name('refresh');
        Route::get('/compatibility/{property}', [PropertyRecommendationController::class, 'getCompatibility'])->name('compatibility');
    });
    Route::get('property-recommendations/health', [PropertyRecommendationController::class, 'healthCheck'])->name('property-recommendations.health');

    // Meetings (user's meetings across all deals)
    Route::get('meetings', [\App\Http\Controllers\MeetingsController::class, 'index'])->name('meetings.index');
    Route::get('meetings/deal/{deal}', [\App\Http\Controllers\MeetingsController::class, 'getDealForScheduling'])->name('meetings.deal_for_scheduling');
    Route::get('meetings/lead/{lead}', [\App\Http\Controllers\MeetingsController::class, 'getLeadForScheduling'])->name('meetings.lead_for_scheduling');
    Route::post('meetings/{followUp}/reschedule', [\App\Http\Controllers\MeetingsController::class, 'reschedule'])->name('meetings.reschedule');
    
// Meeting Summary Routes
Route::get('meeting-summary/{summaryId}', [MeetingSummaryController::class, 'show'])->name('meeting-summary.show');

    // Meeting Types
    Route::resource('meeting-types', MeetingTypeController::class);

    // leaves files routes
    Route::get('leave-files/download/{id}', [LeaveFileController::class, 'download'])->name('leave-files.download');
    Route::resource('leave-files', LeaveFileController::class);

    /* LEAVES */
    Route::get('leaves/leaves-date', [LeaveController::class, 'getDate'])->name('leaves.date');
    Route::get('leaves/personal', [LeaveController::class, 'personalLeaves'])->name('leaves.personal');
    Route::get('leaves/calendar', [LeaveController::class, 'leaveCalendar'])->name('leaves.calendar');
    Route::post('leaves/data', [LeaveController::class, 'data'])->name('leaves.data');
    Route::post('leaves/leaveAction', [LeaveController::class, 'leaveAction'])->name('leaves.leave_action');
    Route::get('leaves/show-reject-modal', [LeaveController::class, 'rejectLeave'])->name('leaves.show_reject_modal');
    Route::get('leaves/show-approved-modal', [LeaveController::class, 'approveLeave'])->name('leaves.show_approved_modal');
    Route::post('leaves/pre-approve-leave', [LeaveController::class, 'preApprove'])->name('leaves.pre_approve_leave');
    Route::post('leaves/apply-quick-action', [LeaveController::class, 'applyQuickAction'])->name('leaves.apply_quick_action');
    Route::get('leaves/view-related-leave/{id}', [LeaveController::class, 'viewRelatedLeave'])->name('leaves.view_related_leave');
    Route::get('leaves/export-all-leave', [LeaveController::class, 'exportAllLeaves'])->name('leaves.export_all_leave');
    Route::resource('leaves', LeaveController::class);

    // Messages
    Route::get('messages/fetch-user-list', [MessageController::class, 'fetchUserListView'])->name('messages.fetch_user_list');
    Route::post('messages/fetch_messages/{id}', [MessageController::class, 'fetchUserMessages'])->name('messages.fetch_messages');
    Route::post('messages/check_messages', [MessageController::class, 'checkNewMessages'])->name('messages.check_new_message');
    Route::delete('messages/destroy-chat/{id}', [MessageController::class, 'destroyAll'])->name('messages.destroy_all');
    Route::resource('messages', MessageController::class);

    // Chat Files
    Route::get('message-file/download/{id}', [MessageFileController::class, 'download'])->name('message_file.download');
    Route::resource('message-file', MessageFileController::class);

    // Invoices
    Route::get('invoices/offline-method-description', [InvoiceController::class, 'offlineDescription'])->name('invoices.offline_method_description');
    Route::get('invoices/offline-payment-modal', [InvoiceController::class, 'offlinePaymentModal'])->name('invoices.offline_payment_modal');
    Route::get('invoices/stripe-modal', [InvoiceController::class, 'stripeModal'])->name('invoices.stripe_modal');
    Route::post('invoices/save-stripe-detail/', [InvoiceController::class, 'saveStripeDetail'])->name('invoices.save_stripe_detail');
    Route::get('invoices/delete-image', [InvoiceController::class, 'deleteInvoiceItemImage'])->name('invoices.delete_image');
    Route::post('invoices/store-offline-payment', [InvoiceController::class, 'storeOfflinePayment'])->name('invoices.store_offline_payment');
    Route::post('invoices/store_file', [InvoiceController::class, 'storeFile'])->name('invoices.store_file');
    Route::get('invoices/file-upload', [InvoiceController::class, 'fileUpload'])->name('invoices.file_upload');
    Route::post('invoices/delete-applied-credit/{id}', [InvoiceController::class, 'deleteAppliedCredit'])->name('invoices.delete_applied_credit');
    Route::get('invoices/applied-credits/{id}', [InvoiceController::class, 'appliedCredits'])->name('invoices.applied_credits');
    Route::get('invoices/payment-reminder/{invoiceID}', [InvoiceController::class, 'remindForPayment'])->name('invoices.payment_reminder');
    Route::post('invoices/send-invoice/{invoiceID}', [InvoiceController::class, 'sendInvoice'])->name('invoices.send_invoice');
    Route::post('invoices/approve-offline-invoice/{invoiceID}', [InvoiceController::class, 'approveOfflineInvoice'])->name('invoices.approve_offline_invoice');
    Route::post('invoices/apply-quick-action', [InvoiceController::class, 'applyQuickAction'])->name('invoices.apply_quick_action');
    Route::get('invoices/download/{id}', [InvoiceController::class, 'download'])->name('invoices.download');
    Route::get('invoices/add-item', [InvoiceController::class, 'addItem'])->name('invoices.add_item');
    Route::get('invoices/update-status/{invoiceID}', [InvoiceController::class, 'cancelStatus'])->name('invoices.update_status');
    Route::get('invoices/get-client-company/{projectID?}', [InvoiceController::class, 'getClientOrCompanyName'])->name('invoices.get_client_company');
    Route::post('invoices/fetchTimelogs', [InvoiceController::class, 'fetchTimelogs'])->name('invoices.fetch_timelogs');
    Route::get('invoices/check-shipping-address', [InvoiceController::class, 'checkShippingAddress'])->name('invoices.check_shipping_address');
    Route::get('invoices/product-category/{id}', [InvoiceController::class, 'productCategory'])->name('invoices.product_category');

    Route::get('invoices/toggle-shipping-address/{invoice}', [InvoiceController::class, 'toggleShippingAddress'])->name('invoices.toggle_shipping_address');
    Route::get('invoices/shipping-address-modal/{invoice}', [InvoiceController::class, 'shippingAddressModal'])->name('invoices.shipping_address_modal');
    Route::post('invoices/add-shipping-address/{clientId}', [InvoiceController::class, 'addShippingAddress'])->name('invoices.add_shipping_address');
    Route::get('invoices/get-exchange-rate/{id}', [InvoiceController::class, 'getExchangeRate'])->name('invoices.get_exchange_rate');

    Route::get('invoices/committed-modal', [InvoiceController::class, 'committedModal'])->name('invoices.committed_modal');

    Route::group(['prefix' => 'invoices'], function () {
        // Invoice recurring
        Route::post('recurring-invoice/change-status', [RecurringInvoiceController::class, 'changeStatus'])->name('recurring_invoice.change_status');
        Route::get('recurring-invoice/export/{startDate}/{endDate}/{status}/{employee}', [RecurringInvoiceController::class, 'export'])->name('recurring_invoice.export');
        Route::get('recurring-invoice/recurring-invoice/{id}', [RecurringInvoiceController::class, 'recurringInvoices'])->name('recurring_invoice.recurring_invoice');
        Route::delete('recurring-invoice/delete-repeat-invoices/{id}', [RecurringInvoiceController::class, 'deleteInvoices'])->name('recurring_invoice.delete_repeat_invoices');
        Route::resource('recurring-invoices', RecurringInvoiceController::class);
    });
    Route::resource('invoices', InvoiceController::class);

    Route::resource('invoices-payment-details', InvoicePaymentDetailController::class);

    // Estimates
    Route::get('estimates/delete-image', [EstimateController::class, 'deleteEstimateItemImage'])->name('estimates.delete_image');
    Route::get('estimates/download/{id}', [EstimateController::class, 'download'])->name('estimates.download');
    Route::post('estimates/send-estimate/{id}', [EstimateController::class, 'sendEstimate'])->name('estimates.send_estimate');
    Route::get('estimates/change-status/{id}', [EstimateController::class, 'changeStatus'])->name('estimates.change_status');
    Route::post('estimates/accept/{id}', [EstimateController::class, 'accept'])->name('estimates.accept');
    Route::post('estimates/decline/{id}', [EstimateController::class, 'decline'])->name('estimates.decline');
    Route::get('estimates/add-item', [EstimateController::class, 'addItem'])->name('estimates.add_item');
    Route::resource('estimates', EstimateController::class);


    // Proposals
    Route::get('proposals/delete-image', [ProposalController::class, 'deleteProposalItemImage'])->name('proposals.delete_image');
    Route::get('proposals/download/{id}', [ProposalController::class, 'download'])->name('proposals.download');
    Route::post('proposals/send-proposal/{id}', [ProposalController::class, 'sendProposal'])->name('proposals.send_proposal');
    Route::get('proposals/add-item', [ProposalController::class, 'addItem'])->name('proposals.add_item');
    Route::resource('proposals', ProposalController::class);

    // Proposal Template
    Route::post('proposal-template/apply-quick-action', [ProposalTemplateController::class, 'applyQuickAction'])->name('proposal_template.apply_quick_action');
    Route::get('proposal-template/add-item', [ProposalController::class, 'addItem'])->name('proposal-template.add_item');
    Route::resource('proposal-template', ProposalTemplateController::class);
    Route::get('proposal-template/download/{id}', [ProposalTemplateController::class, 'download'])->name('proposal-template.download');
    Route::get('proposals-template/delete-image', [ProposalTemplateController::class, 'deleteProposalItemImage'])->name('proposal_template.delete_image');

    // Payments
    Route::post('payments/apply-quick-action', [PaymentController::class, 'applyQuickAction'])->name('payments.apply_quick_action');
    Route::get('payments/download/{id}', [PaymentController::class, 'download'])->name('payments.download');
    Route::get('payments/account-list', [PaymentController::class, 'accountList'])->name('payments.account_list');
    Route::get('payments/offline-payments', [PaymentController::class, 'offlineMethods'])->name('offline.methods');
    Route::get('payments/add-bulk-payments', [PaymentController::class, 'addBulkPayments'])->name('payments.add_bulk_payments');
    Route::post('payments/save-bulk-payments', [PaymentController::class, 'saveBulkPayments'])->name('payments.save_bulk_payments');

    Route::resource('payments', PaymentController::class)->except(['edit', 'update']);

    // Credit notes
    Route::post('creditnotes/store_file', [CreditNoteController::class, 'storeFile'])->name('creditnotes.store_file');
    Route::get('creditnotes/file-upload', [CreditNoteController::class, 'fileUpload'])->name('creditnotes.file_upload');
    Route::post('creditnotes/delete-credited-invoice/{id}', [CreditNoteController::class, 'deleteCreditedInvoice'])->name('creditnotes.delete_credited_invoice');
    Route::get('creditnotes/credited-invoices/{id}', [CreditNoteController::class, 'creditedInvoices'])->name('creditnotes.credited_invoices');
    Route::post('creditnotes/apply-invoice-credit/{id}', [CreditNoteController::class, 'applyInvoiceCredit'])->name('creditnotes.apply_invoice_credit');
    Route::get('creditnotes/apply-to-invoice/{id}', [CreditNoteController::class, 'applyToInvoice'])->name('creditnotes.apply_to_invoice');
    Route::get('creditnotes/download/{id}', [CreditNoteController::class, 'download'])->name('creditnotes.download');

    Route::get('creditnotes/convert-invoice/{id}', [CreditNoteController::class, 'convertInvoice'])->name('creditnotes.convert-invoice');

    Route::resource('creditnotes', CreditNoteController::class);

    // Bank account
    Route::post('bankaccount/apply-quick-action', [BankAccountController::class, 'applyQuickAction'])->name('bankaccounts.apply_quick_action');
    Route::post('bankaccount/apply-transaction-quick-action', [BankAccountController::class, 'applyTransactionQuickAction'])->name('bankaccounts.apply_transaction_quick_action');
    Route::get('bankaccounts/create-transaction', [BankAccountController::class, 'createTransaction'])->name('bankaccounts.create_transaction');
    Route::post('bankaccount/store-transaction', [BankAccountController::class, 'storeTransaction'])->name('bankaccounts.store_transaction');
    Route::post('bankaccount/change-status', [BankAccountController::class, 'changeStatus'])->name('bankaccounts.change_status');

    Route::get('bankaccounts/view-transaction/{id}', [BankAccountController::class, 'viewTransaction'])->name('bankaccounts.view_transaction');
    Route::post('bankaccount/destroy-transaction', [BankAccountController::class, 'destroyTransaction'])->name('bankaccounts.destroy_transaction');
    Route::get('bankaccount/generate-statement/{id}', [BankAccountController::class, 'generateStatement'])->name('bankaccounts.generate_statement');
    Route::get('bankaccount/get-bank-statement', [BankAccountController::class, 'getBankStatement'])->name('bankaccounts.get_bank_statement');

    Route::resource('bankaccounts', BankAccountController::class);

    // Expenses
    Route::group(['prefix' => 'expenses'], function () {
        Route::post('recurring-expenses/change-status', [RecurringExpenseController::class, 'changeStatus'])->name('recurring-expenses.change_status');
        Route::resource('recurring-expenses', RecurringExpenseController::class);
        Route::get('change-status', [ExpenseController::class, 'getEmployeeProjects'])->name('expenses.get_employee_projects');
        Route::get('category', [ExpenseController::class, 'getCategoryEmployee'])->name('expenses.get_category_employees');
        Route::post('change-status', [ExpenseController::class, 'changeStatus'])->name('expenses.change_status');
        Route::post('apply-quick-action', [ExpenseController::class, 'applyQuickAction'])->name('expenses.apply_quick_action');
        Route::get('import', [ExpenseController::class, 'import'])->name('expenses.import');
        Route::post('import', [ExpenseController::class, 'importStore'])->name('expenses.import.store');
        Route::post('import/process', [ExpenseController::class, 'importProcess'])->name('expenses.import.process');
    });
    Route::resource('expenses', ExpenseController::class);
    Route::resource('expenseCategory', ExpenseCategoryController::class);

    // Timelogs
    Route::group(['prefix' => 'timelogs'], function () {
        Route::resource('timelog-calendar', TimelogCalendarController::class);
        Route::resource('timelog-break', ProjectTimelogBreakController::class);
        Route::get('by-employee', [TimelogController::class, 'byEmployee'])->name('timelogs.by_employee');
        Route::get('export', [TimelogController::class, 'export'])->name('timelogs.export');
        Route::get('show-active-timer', [TimelogController::class, 'showActiveTimer'])->name('timelogs.show_active_timer');
        Route::get('show-timer', [TimelogController::class, 'showTimer'])->name('timelogs.show_timer');
        Route::post('start-timer', [TimelogController::class, 'startTimer'])->name('timelogs.start_timer');
        Route::get('timer-data', [TimelogController::class, 'timerData'])->name('timelogs.timer_data');
        Route::post('stop-timer', [TimelogController::class, 'stopTimer'])->name('timelogs.stop_timer');
        Route::post('pause-timer', [TimelogController::class, 'pauseTimer'])->name('timelogs.pause_timer');
        Route::post('resume-timer', [TimelogController::class, 'resumeTimer'])->name('timelogs.resume_timer');
        Route::post('apply-quick-action', [TimelogController::class, 'applyQuickAction'])->name('timelogs.apply_quick_action');

        Route::post('employee_data', [TimelogController::class, 'employeeData'])->name('timelogs.employee_data');
        Route::post('user_time_logs', [TimelogController::class, 'userTimelogs'])->name('timelogs.user_time_logs');
        Route::post('approve_timelog', [TimelogController::class, 'approveTimelog'])->name('timelogs.approve_timelog');
        Route::get('stopper-alert/{id}', [TimelogController::class, 'stopperAlert'])->name('timelogs.stopper_alert');

        Route::get('show-reject-modal', [WeeklyTimesheetController::class, 'showRejectModal'])->name('weekly-timesheets.show_reject_modal');
        Route::post('change-status', [WeeklyTimesheetController::class, 'changeStatus'])->name('weekly-timesheets.change_status');
        Route::get('pending-approval', [WeeklyTimesheetController::class, 'pendingApproval'])->name('weekly-timesheets.pending_approval');
        Route::resource('weekly-timesheets', WeeklyTimesheetController::class);
    });
    Route::resource('timelogs', TimelogController::class);
    Route::post('timelogs/timelogAction', [TimelogController::class, 'timelogAction'])->name('timelogs.timelog_action');
    Route::get('timelogs/show-reject-modal', [TimelogController::class, 'rejectTimelog'])->name('timelogs.show_reject_modal');
    Route::post('/calculate-time', [TimelogController::class, 'calculateTime'])->name('calculateTime');

    // Contracts
    Route::post('contracts/apply-quick-action', [ContractController::class, 'applyQuickAction'])->name('contracts.apply_quick_action');
    Route::get('contracts/download/{id}', [ContractController::class, 'download'])->name('contracts.download');
    Route::post('contracts/sign/{id}', [ContractController::class, 'sign'])->name('contracts.sign');
    Route::post('companySign/sign/{id}', [ContractController::class, 'companySign'])->name('companySign.sign');
    Route::get('companySignStore/sign/{id}', [ContractController::class, 'companiesSign'])->name('companySignStore.sign');
    Route::post('contracts/project-detail/{id}', [ContractController::class, 'projectDetail'])->name('contracts.project_detail');
    Route::get('contracts/company-sig/{id}', [ContractController::class, 'companySig'])->name('contracts.company_sig');


    Route::group(['prefix' => 'contracts'], function () {
        Route::resource('contractDiscussions', ContractDiscussionController::class);
        Route::get('contractFiles/download/{id}', [ContractFileController::class, 'download'])->name('contractFiles.download');
        Route::resource('contractFiles', ContractFileController::class);
        Route::resource('contractTypes', ContractTypeController::class);
    });

    Route::resource('contracts', ContractController::class);
    Route::resource('contract-renew', ContractRenewController::class);

    // Contract template
    Route::post('contract-template/apply-quick-action', [ContractTemplateController::class, 'applyQuickAction'])->name('contract_template.apply_quick_action');
    Route::resource('contract-template', ContractTemplateController::class);
    Route::get('contract-template/download/{id}', [ContractTemplateController::class, 'download'])->name('contract-template.download');

    // Attendance
    Route::get('attendances/export-attendance/{year}/{month}/{id}', [AttendanceController::class, 'exportAttendanceByMember'])->name('attendances.export_attendance');
    Route::get('attendances/export-all-attendance/{year}/{month}/{id}/{department}/{designation}', [AttendanceController::class, 'exportAllAttendance'])->name('attendances.export_all_attendance');
    Route::post('attendances/employee-data', [AttendanceController::class, 'employeeData'])->name('attendances.employee_data');
    Route::get('attendances/mark/{id}/{day}/{month}/{year}', [AttendanceController::class, 'mark'])->name('attendances.mark');
    Route::get('attendances/by-member', [AttendanceController::class, 'byMember'])->name('attendances.by_member');
    Route::get('attendances/by-hour', [AttendanceController::class, 'byHour'])->name('attendances.by_hour');
    Route::post('attendances/bulk-mark', [AttendanceController::class, 'bulkMark'])->name('attendances.bulk_mark');
    Route::get('attendances/import', [AttendanceController::class, 'importAttendance'])->name('attendances.import');
    Route::post('attendances/import', [AttendanceController::class, 'importStore'])->name('attendances.import.store');
    Route::post('attendances/import/process', [AttendanceController::class, 'importProcess'])->name('attendances.import.process');
    Route::get('attendances/by-map-location', [AttendanceController::class, 'byMapLocation'])->name('attendances.by_map_location');
    Route::resource('attendances', AttendanceController::class);
    Route::get('attendance/{id}/{day}/{month}/{year}', [AttendanceController::class, 'addAttendance'])->name('attendances.add-user-attendance');
    Route::post('attendances/check-half-day', [AttendanceController::class, 'checkHalfDay'])->name('attendances.check_half_day');
    Route::get('check-qr-login/{hash}', [AttendanceController::class, 'qrClockInOut'])->name('settings.qr-login');
    Route::post('change-qr-code-status', [AttendanceController::class, 'qrCodeStatus'])->name('settings.change-qr-code-status');


    Route::get('shifts/mark/{id}/{day}/{month}/{year}', [EmployeeShiftScheduleController::class, 'mark'])->name('shifts.mark');
    Route::get('shifts/export-all/{year}/{month}/{id}/{department}/{startDate}/{viewType}', [EmployeeShiftScheduleController::class, 'exportAllShift'])->name('shifts.export_all');

    Route::get('shifts/employee-shift-calendar', [EmployeeShiftScheduleController::class, 'employeeShiftCalendar'])->name('shifts.employee_shift_calendar');
    Route::post('shifts/bulk-shift', [EmployeeShiftScheduleController::class, 'bulkShift'])->name('shifts.bulk_shift');

    Route::group(['prefix' => 'shifts'], function () {
        Route::post('shifts-change/approve_request/{id}', [EmployeeShiftChangeRequestController::class, 'approveRequest'])->name('shifts-change.approve_request');
        Route::post('shifts-change/decline_request/{id}', [EmployeeShiftChangeRequestController::class, 'declineRequest'])->name('shifts-change.decline_request');
        Route::post('shifts-change/apply-quick-action', [EmployeeShiftChangeRequestController::class, 'applyQuickAction'])->name('shifts-change.apply_quick_action');
        Route::resource('shifts-change', EmployeeShiftChangeRequestController::class);
    });

    Route::resource('shifts', EmployeeShiftScheduleController::class);

    // Tickets
    Route::post('tickets/apply-quick-action', [TicketController::class, 'applyQuickAction'])->name('tickets.apply_quick_action');
    Route::post('tickets/updateOtherData/{id}', [TicketController::class, 'updateOtherData'])->name('tickets.update_other_data');
    Route::post('tickets/change-status', [TicketController::class, 'changeStatus'])->name('tickets.change-status');
    Route::post('tickets/refreshCount', [TicketController::class, 'refreshCount'])->name('tickets.refresh_count');
    Route::get('tickets/agent-group/{id}/{exceptThis?}', [TicketController::class, 'agentGroup'])->name('tickets.agent_group');
    Route::get('tickets/edit-details/{id}', [TicketController::class, 'editDetail'])->name('tickets.edit_detail');
    Route::put('tickets/update-details/{id}', [TicketController::class, 'updateDetail'])->name('tickets.update_detail');
    Route::resource('tickets', TicketController::class);

    // Ticket Custom Embed From
    Route::post('ticket-form/sort-fields', [TicketCustomFormController::class, 'sortFields'])->name('ticket-form.sort_fields');
    Route::resource('ticket-form', TicketCustomFormController::class);

    Route::get('ticket-files/download/{id}', [TicketFileController::class, 'download'])->name('ticket-files.download');
    Route::resource('ticket-files', TicketFileController::class);

    Route::resource('ticket-replies', TicketReplyController::class);
    Route::post('ticket-replies/edit-note/{id}', [TicketReplyController::class, 'editNote'])->name('ticket-replies.edit_note');

    Route::post('task-report-chart', [TaskReportController::class, 'taskChartData'])->name('task-report.chart');
    Route::get('task-report/employee-wise-task-report', [TaskReportController::class, 'employeeWiseTaskReport'])->name('employee-wise-task-report');
    Route::get('task-report/consolidated-task-report', [TaskReportController::class, 'consolidatedTaskReport'])->name('consolidated-task-report');

    Route::resource('task-report', TaskReportController::class);

    Route::post('time-log-report-chart', [TimelogReportController::class, 'timelogChartData'])->name('time-log-report.chart');
    Route::get('time-log-consolidated-report', [TimelogReportController::class, 'consolidateIndex'])->name('time-log-consolidated.report');
    Route::get('time-log-project-wise-report', [TimelogReportController::class, 'projectWiseTimelog'])->name('project-wise-timelog.report');
    Route::get('project-wise-timelog/report/export', [TimelogReportController::class, 'exportProjectWiseTimeLog'])->name('project-wise-timelog.export');
    Route::resource('time-log-report', TimelogReportController::class);
    Route::post('time-log-report-time', [TimelogReportController::class, 'totalTime'])->name('time-log-report.time');

    Route::resource('time-log-weekly-report', TimelogWeeklyApprovalController::class);
    Route::get('weekly-pending-time-log-report', [TimelogWeeklyApprovalController::class, 'pendingTimelogReportIndex'])->name('weekly-pending-time-log-report.report');

    Route::post('finance-report-chart', [FinanceReportController::class, 'financeChartData'])->name('finance-report.chart');
    Route::resource('finance-report', FinanceReportController::class);

    Route::resource('income-expense-report', IncomeVsExpenseReportController::class);

    Route::get('leave-report/leave-quota', [LeaveReportController::class, 'leaveQuota'])->name('leave-report.leave_quota');
    Route::get('leave-report/leave-quota/export-all-leave-quota/{id}/{year}/{month}', [LeavesQuotaController::class, 'exportAllLeaveQuota'])->name('leave_quota.export_all_leave_quota');
    Route::get('leave-report/leave-quota/{id}/{year}/{month}', [LeaveReportController::class, 'employeeLeaveQuota'])->name('leave-report.employee-leave-quota');
    Route::resource('leave-report', LeaveReportController::class);

    Route::resource('attendance-report', AttendanceReportController::class);

    Route::post('expense-report-chart', [ExpenseReportController::class, 'expenseChartData'])->name('expense-report.chart');
    Route::get('expense-report/expense-category-report', [ExpenseReportController::class, 'expenseCategoryReport'])->name('expense-report.expense_category_report');

    Route::resource('expense-report', ExpenseReportController::class);
    Route::get('deal-report/lead', [LeadReportController::class, 'leadContact'])->name('lead-report.lead_contact');
    Route::get('lead-report/total', [LeadReportController::class, 'totalContact'])->name('lead-report.total_contact');

    Route::get('deal-report/chart', [LeadReportController::class, 'averageDealSizeReport'])->name('lead-report.chart');
    Route::get('deal-report/profile', [LeadReportController::class, 'profile'])->name('lead-report.profile');
    Route::get('deal-report/export/{year}/{pipeline}/{category}', [LeadReportController::class, 'exportDealReport'])->name('deal-report.export');



    Route::resource('lead-report', LeadReportController::class);
    Route::resource('sales-report', SalesReportController::class);

    // Agent Reports (Inertia)
    Route::prefix('agent-reports')->name('agent-reports.')->group(function () {
        Route::get('/', [AgentReportController::class, 'index'])->name('index');
        Route::get('/leads', [AgentReportController::class, 'leads'])->name('leads');
        Route::get('/deals-created', [AgentReportController::class, 'dealsCreated'])->name('deals-created');
        Route::get('/deals-closed', [AgentReportController::class, 'dealsClosed'])->name('deals-closed');
        Route::get('/meetings', [AgentReportController::class, 'meetings'])->name('meetings');
        Route::get('/deal-notes', [AgentReportController::class, 'dealNotes'])->name('deal-notes');
        Route::get('/lead-notes', [AgentReportController::class, 'leadNotes'])->name('lead-notes');
        Route::post('/ai-summary', [AgentReportController::class, 'aiSummary'])->name('ai-summary');
        Route::get('/saved-summaries', [AgentReportController::class, 'savedSummaries'])->name('saved-summaries.index');
        Route::post('/saved-summaries', [AgentReportController::class, 'saveSummary'])->name('saved-summaries.store');
        Route::delete('/saved-summaries/{summary}', [AgentReportController::class, 'destroySummary'])->name('saved-summaries.destroy');
        Route::get('/export', [AgentReportController::class, 'export'])->name('export');
    });

    Route::resource('sticky-notes', StickyNoteController::class);

    Route::post('show-notifications', [NotificationController::class, 'showNotifications'])->name('show_notifications');

    // Notification API Routes (for React/Inertia)
    Route::prefix('api/notifications')->name('notifications.api.')->group(function () {
        Route::get('/', [NotificationController::class, 'apiIndex'])->name('index');
        Route::get('/unread-summary', [NotificationController::class, 'apiUnreadSummary'])->name('unread_summary');
        Route::get('/types', [NotificationController::class, 'apiTypes'])->name('types');
        Route::post('/mark-read', [NotificationController::class, 'apiMarkRead'])->name('mark_read');
        Route::post('/mark-multiple-read', [NotificationController::class, 'apiMarkMultipleRead'])->name('mark_multiple_read');
        Route::post('/mark-all-read', [NotificationController::class, 'apiMarkAllRead'])->name('mark_all_read');
        Route::post('/delete', [NotificationController::class, 'apiDelete'])->name('delete');
        Route::post('/delete-multiple', [NotificationController::class, 'apiDeleteMultiple'])->name('delete_multiple');
        Route::post('/delete-all-read', [NotificationController::class, 'apiDeleteAllRead'])->name('delete_all_read');
    });

    // Notification Page Route (Inertia)
    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');

    Route::get('gdpr/lead/approve-reject/{id}/{type}', [GdprSettingsController::class, 'approveRejectLead'])->name('gdpr.lead.approve_reject');
    Route::get('gdpr/customer/approve-reject/{id}/{type}', [GdprSettingsController::class, 'approveRejectClient'])->name('gdpr.customer.approve_reject');

    Route::post('gdpr-settings/apply-quick-action', [GdprSettingsController::class, 'applyQuickAction'])->name('gdpr_settings.apply_quick_action');
    Route::put('gdpr-settings.update-general', [GdprSettingsController::class, 'updateGeneral'])->name('gdpr_settings.update_general');

    Route::post('gdpr/store-consent', [GdprSettingsController::class, 'storeConsent'])->name('gdpr.store_consent');
    Route::get('gdpr/add-consent', [GdprSettingsController::class, 'AddConsent'])->name('gdpr.add_consent');
    Route::get('gdpr/edit-consent/{id}', [GdprSettingsController::class, 'editConsent'])->name('gdpr.edit_consent');

    Route::put('gdpr/update-consent/{id}', [GdprSettingsController::class, 'updateConsent'])->name('gdpr.update_consent');

    Route::delete('gdpr-settings/purpose-delete/{id}', [GdprSettingsController::class, 'purposeDelete'])->name('gdpr_settings.purpose_delete');

    Route::resource('gdpr-settings', GdprSettingsController::class);

    Route::post('gdpr/update-client-consent', [GdprController::class, 'updateClientConsent'])->name('gdpr.update_client_consent');
    Route::get('gdpr/export-data', [GdprController::class, 'downloadJson'])->name('gdpr.export_data');
    Route::post('gdpr/update-consent-block', [GdprController::class, 'updateConsentBlock'])->name('gdpr.update_consent_block');
    Route::resource('gdpr', GdprController::class);

    Route::get('all-notifications', [NotificationController::class, 'all'])->name('all-notifications');
    Route::post('mark-read', [NotificationController::class, 'markRead'])->name('mark_single_notification_read');
    Route::post('mark_notification_read', [NotificationController::class, 'markAllRead'])->name('mark_notification_read');

    Route::resource('search', SearchController::class);

    // Remove in v 5.2.5
    Route::get('hide-webhook-url', [SettingsController::class, 'hideWebhookAlert'])->name('hideWebhookAlert');

    // Estimate Template
    Route::get('estimate-template/add-item', [EstimateTemplateController::class, 'addItem'])->name('estimate-template.add_item');
    Route::resource('estimate-template', EstimateTemplateController::class);
    Route::get('estimates-template/delete-image', [EstimateTemplateController::class, 'deleteEstimateItemImage'])->name('estimate-template.delete_image');
    Route::get('estimate-template/download/{id}', [EstimateTemplateController::class, 'download'])->name('estimate-template.download');

    Route::get('quickbooks/{hash}/callback', [QuickbookController::class, 'callback'])->name('quickbooks.callback');
    Route::get('quickbooks', [QuickbookController::class, 'index'])->name('quickbooks.index');

    // Estimate Request
    Route::post('estimate-request/apply-quick-action', [EstimateRequestController::class, 'applyQuickAction'])->name('estimate-request.apply_quick_action');
    Route::post('estimate-request/change-status/', [EstimateRequestController::class, 'changeStatus'])->name('estimate-request.change_status');
    Route::get('estimate-request-confirm-rejected/{id}', [EstimateRequestController::class, 'rejectConfirmation'])->name('estimate-request.confirm_rejected');
    Route::get('estimate-request/send-estimate-request', [EstimateRequestController::class, 'sendEstimateRequest'])->name('estimate-request.send_estimate_request');
    Route::post('estimate-request/send_estimate_mail', [EstimateRequestController::class, 'sendEstimateMail'])->name('estimate-request.send_estimate_mail');
    Route::resource('estimate-request', EstimateRequestController::class);

    // Properties
    Route::post('properties/apply-quick-action', [App\Http\Controllers\PropertyController::class, 'applyQuickAction'])->name('properties.apply_quick_action');
    Route::post('properties/bulk-action', [App\Http\Controllers\PropertyController::class, 'bulkAction'])->name('properties.bulk_action');
    Route::get('properties/import', [App\Http\Controllers\PropertyController::class, 'importProperty'])->name('properties.import');
    Route::post('properties/import', [App\Http\Controllers\PropertyController::class, 'importStore'])->name('properties.import.store');
    Route::post('properties/import-process', [App\Http\Controllers\PropertyController::class, 'importProcess'])->name('properties.import.process');
    Route::get('properties/sample-import', [App\Http\Controllers\PropertyController::class, 'downloadSampleImport'])->name('properties.sample_import');
    Route::post('properties/export', [App\Http\Controllers\PropertyController::class, 'exportProperties'])->name('properties.export');
    Route::get('properties/configurations', [App\Http\Controllers\PropertyController::class, 'getPropertyConfigurations'])->name('properties.configurations');
    Route::get('properties/allowed-types', [App\Http\Controllers\PropertyController::class, 'getAllowedPropertyTypes'])->name('properties.allowed_types');
    Route::get('properties/allowed-fields', [App\Http\Controllers\PropertyController::class, 'getAllowedFields'])->name('properties.allowed_fields');
    Route::get('properties/enum-values', [App\Http\Controllers\PropertyController::class, 'getEnumValues'])->name('properties.enum_values');
    
    // Publishing & Access Request Routes
    Route::post('properties/{id}/publish', [App\Http\Controllers\PropertyController::class, 'publish'])->name('properties.publish');
    Route::post('properties/{id}/unpublish', [App\Http\Controllers\PropertyController::class, 'unpublish'])->name('properties.unpublish');
    Route::post('properties/{id}/request-access', [App\Http\Controllers\PropertyController::class, 'requestAccess'])->name('properties.request_access');
    
    // Property Availability Requests
    Route::prefix('availability-requests')->name('availability-requests.')->group(function () {
        Route::get('/', [App\Http\Controllers\PropertyAvailabilityRequestController::class, 'index'])->name('index');
        Route::post('/', [App\Http\Controllers\PropertyAvailabilityRequestController::class, 'store'])->name('store');
        Route::get('/property/{propertyId}', [App\Http\Controllers\PropertyAvailabilityRequestController::class, 'forProperty'])->name('for-property');
        Route::get('/{id}', [App\Http\Controllers\PropertyAvailabilityRequestController::class, 'show'])->name('show')->where('id', '[0-9]+');
        Route::post('/{id}/approve', [App\Http\Controllers\PropertyAvailabilityRequestController::class, 'approve'])->name('approve');
        Route::post('/{id}/deny', [App\Http\Controllers\PropertyAvailabilityRequestController::class, 'deny'])->name('deny');
    });

    // Property Edit Access Requests
    Route::prefix('edit-access-requests')->name('edit-access-requests.')->group(function () {
        Route::get('/', [App\Http\Controllers\PropertyEditAccessRequestController::class, 'index'])->name('index');
        Route::post('/', [App\Http\Controllers\PropertyEditAccessRequestController::class, 'store'])->name('store');
        Route::get('/property/{propertyId}', [App\Http\Controllers\PropertyEditAccessRequestController::class, 'forProperty'])->name('for-property');
        Route::get('/{id}', [App\Http\Controllers\PropertyEditAccessRequestController::class, 'show'])->name('show')->where('id', '[0-9]+');
        Route::post('/{id}/approve', [App\Http\Controllers\PropertyEditAccessRequestController::class, 'approve'])->name('approve');
        Route::post('/{id}/deny', [App\Http\Controllers\PropertyEditAccessRequestController::class, 'deny'])->name('deny');
    });

    // Property collaborators & watchers
    Route::prefix('properties/{propertyId}')->where(['propertyId' => '[0-9]+'])->group(function () {
        Route::get('collaborators', [App\Http\Controllers\PropertyCollaboratorController::class, 'index'])->name('properties.collaborators.index');
        Route::delete('collaborators/{userId}', [App\Http\Controllers\PropertyCollaboratorController::class, 'destroy'])->name('properties.collaborators.destroy')->where('userId', '[0-9]+');
        Route::get('watchers', [App\Http\Controllers\PropertyWatcherController::class, 'index'])->name('properties.watchers.index');
        Route::post('watchers/self', [App\Http\Controllers\PropertyWatcherController::class, 'storeSelf'])->name('properties.watchers.store-self');
        Route::put('watchers', [App\Http\Controllers\PropertyWatcherController::class, 'sync'])->name('properties.watchers.sync');
        Route::delete('watchers/{userId}', [App\Http\Controllers\PropertyWatcherController::class, 'destroy'])->name('properties.watchers.destroy')->where('userId', '[0-9]+');
    });
    
    // Property Publish Requests
    Route::prefix('publish-requests')->name('publish-requests.')->group(function () {
        Route::get('/', [App\Http\Controllers\PropertyPublishRequestController::class, 'index'])->name('index');
        Route::post('/', [App\Http\Controllers\PropertyPublishRequestController::class, 'store'])->name('store');
        Route::post('/{id}/approve', [App\Http\Controllers\PropertyPublishRequestController::class, 'approve'])->name('approve');
        Route::post('/{id}/reject', [App\Http\Controllers\PropertyPublishRequestController::class, 'reject'])->name('reject');
    });
    
    // Property Asset Management Routes
    Route::post('properties/{property}/photos', [App\Http\Controllers\PropertyController::class, 'updatePhotos'])->name('properties.update_photos');
    Route::post('properties/{property}/photos/add', [App\Http\Controllers\PropertyController::class, 'addSinglePhoto'])->name('properties.add_single_photo');
    Route::put('properties/{property}/photos/{index}', [App\Http\Controllers\PropertyController::class, 'updateSinglePhoto'])->name('properties.update_single_photo');
    Route::delete('properties/{property}/photos/single', [App\Http\Controllers\PropertyController::class, 'deleteSinglePhoto'])->name('properties.delete_single_photo');
    Route::post('properties/{property}/video', [App\Http\Controllers\PropertyController::class, 'updateVideo'])->name('properties.update_video');
    Route::post('properties/{property}/360-tour', [App\Http\Controllers\PropertyController::class, 'update360Tour'])->name('properties.update_360_tour');
    Route::delete('properties/{property}/assets', [App\Http\Controllers\PropertyController::class, 'deleteAssets'])->name('properties.delete_assets');

    Route::post('properties/{id}/expose/validate', [App\Http\Controllers\PropertyController::class, 'validateExpose'])->name('properties.expose.validate');
    Route::post('properties/{id}/expose/generate', [App\Http\Controllers\PropertyController::class, 'generateExpose'])->name('properties.expose.generate');

    // Expose job status polling
    Route::get('expose-jobs/{id}', [App\Http\Controllers\ExposeJobController::class, 'show'])->name('expose-jobs.show');

    Route::get('properties/slug/{slug}', [App\Http\Controllers\PropertyController::class, 'showBySlug'])->name('properties.show_by_slug');

    // =====================================================
    // Developer Projects & Project Locations
    // =====================================================

    // Property Config / Lookup Tables Management
    Route::prefix('property-config')->name('property-config.')->group(function () {
        Route::get('/', [App\Http\Controllers\PropertyConfigController::class, 'page'])->name('page');
        Route::get('/types', [App\Http\Controllers\PropertyConfigController::class, 'types'])->name('types');
        Route::post('/property-types/bulk-category', [App\Http\Controllers\PropertyConfigController::class, 'bulkUpdateCategory'])->name('bulk-category');
        Route::get('/{type}', [App\Http\Controllers\PropertyConfigController::class, 'index'])->name('index');
        Route::post('/{type}', [App\Http\Controllers\PropertyConfigController::class, 'store'])->name('store');
        Route::get('/{type}/{id}', [App\Http\Controllers\PropertyConfigController::class, 'show'])->name('show');
        Route::put('/{type}/{id}', [App\Http\Controllers\PropertyConfigController::class, 'update'])->name('update');
        Route::delete('/{type}/{id}', [App\Http\Controllers\PropertyConfigController::class, 'destroy'])->name('destroy');
    });
    
    // Project Locations - must be defined before developer-projects since projects reference locations
    Route::prefix('project-locations')->name('project-locations.')->group(function () {
        Route::get('/', [App\Http\Controllers\ProjectLocationController::class, 'index'])->name('index');
        Route::get('/all', [App\Http\Controllers\ProjectLocationController::class, 'all'])->name('all');
        Route::get('/infrastructures', [App\Http\Controllers\ProjectLocationController::class, 'allInfrastructures'])->name('infrastructures');
        Route::get('/airports', [App\Http\Controllers\ProjectLocationController::class, 'allAirports'])->name('airports');
        Route::post('/', [App\Http\Controllers\ProjectLocationController::class, 'store'])->name('store');
        Route::get('/{id}', [App\Http\Controllers\ProjectLocationController::class, 'show'])->name('show');
        Route::put('/{id}', [App\Http\Controllers\ProjectLocationController::class, 'update'])->name('update');
        Route::delete('/{id}', [App\Http\Controllers\ProjectLocationController::class, 'destroy'])->name('destroy');
    });

    // CRM Events (Admin viewer)
    Route::get('crm-events', [App\Http\Controllers\CrmEventAdminController::class, 'index'])->name('crm-events.index');
    // Session-authenticated mutations used by the deal/lead timeline UI.
    // Prefer these over /api/v1 so delete/update share the same web session
    // (and company context) as the rest of the Inertia app.
    Route::patch('crm-events/{uuid}', [\App\Http\Controllers\CrmEventController::class, 'update'])
        ->name('crm-events.update');
    Route::delete('crm-events/{uuid}', [\App\Http\Controllers\CrmEventController::class, 'destroy'])
        ->name('crm-events.destroy');

    // Developers
    Route::prefix('developers')->name('developers.')->group(function () {
        Route::get('/', [App\Http\Controllers\DeveloperController::class, 'index'])->name('index');
        Route::get('/all', [App\Http\Controllers\DeveloperController::class, 'all'])->name('all');
        Route::post('/', [App\Http\Controllers\DeveloperController::class, 'store'])->name('store');
        Route::get('/{id}', [App\Http\Controllers\DeveloperController::class, 'show'])->name('show');
        Route::put('/{id}', [App\Http\Controllers\DeveloperController::class, 'update'])->name('update');
        Route::delete('/{id}', [App\Http\Controllers\DeveloperController::class, 'destroy'])->name('destroy');
        
        // Project assignment
        Route::post('/{id}/assign-projects', [App\Http\Controllers\DeveloperController::class, 'assignProjects'])->name('assign-projects');
        Route::post('/{id}/remove-projects', [App\Http\Controllers\DeveloperController::class, 'removeProjects'])->name('remove-projects');
    });

    // Developer Projects
    Route::prefix('expose-configuration')->name('expose-configuration.')->group(function () {
        Route::get('/', [App\Http\Controllers\CompanyExposeConfigurationController::class, 'show'])->name('show');
        Route::put('/', [App\Http\Controllers\CompanyExposeConfigurationController::class, 'update'])->name('update');
        Route::post('/upload-image', [App\Http\Controllers\CompanyExposeConfigurationController::class, 'uploadImage'])->name('upload-image');
    });

    Route::prefix('developer-projects')->name('developer-projects.')->group(function () {
        Route::get('/', [App\Http\Controllers\DeveloperProjectController::class, 'index'])->name('index');
        Route::get('/all', [App\Http\Controllers\DeveloperProjectController::class, 'all'])->name('all');
        Route::post('/', [App\Http\Controllers\DeveloperProjectController::class, 'store'])->name('store');
        Route::get('/{id}', [App\Http\Controllers\DeveloperProjectController::class, 'show'])->name('show');
        Route::put('/{id}', [App\Http\Controllers\DeveloperProjectController::class, 'update'])->name('update');
        Route::delete('/{id}', [App\Http\Controllers\DeveloperProjectController::class, 'destroy'])->name('destroy');
        
        // Property assignment
        Route::post('/{id}/assign-properties', [App\Http\Controllers\DeveloperProjectController::class, 'assignProperties'])->name('assign-properties');
        Route::post('/{id}/remove-properties', [App\Http\Controllers\DeveloperProjectController::class, 'removeProperties'])->name('remove-properties');
        Route::get('/{id}/available-properties', [App\Http\Controllers\DeveloperProjectController::class, 'availableProperties'])->name('available-properties');
        
        // Expose Generation
        Route::post('/{id}/expose/generate', [App\Http\Controllers\DeveloperProjectController::class, 'generateProjectExpose'])->name('expose.generate');
        Route::post('/{id}/expose/validate', [App\Http\Controllers\DeveloperProjectController::class, 'validateProjectExpose'])->name('expose.validate');
        
        // Project-level Assets (images, videos)
        Route::prefix('/{projectId}/assets')->name('assets.')->group(function () {
            Route::get('/', [App\Http\Controllers\DeveloperProjectAssetController::class, 'index'])->name('index');
            Route::post('/from-urls', [App\Http\Controllers\DeveloperProjectAssetController::class, 'storeFromUrls'])->name('store_from_urls');
            Route::put('/bulk-update-tags', [App\Http\Controllers\DeveloperProjectAssetController::class, 'bulkUpdateTags'])->name('bulk_update_tags');
            Route::delete('/{assetId}', [App\Http\Controllers\DeveloperProjectAssetController::class, 'destroy'])->name('destroy');
        });

        // Expose Configuration (DEPRECATED - use project/unit-type expose endpoints above instead)
        // These routes are kept for backward compatibility but will be removed in a future release.
        Route::get('/{id}/expose-config', [App\Http\Controllers\DeveloperProjectExposeConfigController::class, 'show'])->name('expose-config.show');
        Route::put('/{id}/expose-config', [App\Http\Controllers\DeveloperProjectExposeConfigController::class, 'upsert'])->name('expose-config.upsert');
        Route::patch('/{id}/expose-config/{section}', [App\Http\Controllers\DeveloperProjectExposeConfigController::class, 'updateSection'])->name('expose-config.update-section');
        Route::get('/{id}/expose-config/preview', [App\Http\Controllers\DeveloperProjectExposeConfigController::class, 'previewData'])->name('expose-config.preview');
        Route::get('/{id}/expose-config/validate', [App\Http\Controllers\DeveloperProjectExposeConfigController::class, 'validateConfig'])->name('expose-config.validate');
        
        // Unit Types CRUD
        Route::prefix('/{projectId}/unit-types')->name('unit-types.')->group(function () {
            Route::get('/', [App\Http\Controllers\DeveloperProjectUnitTypeController::class, 'index'])->name('index');
            Route::post('/', [App\Http\Controllers\DeveloperProjectUnitTypeController::class, 'store'])->name('store');
            Route::get('/{unitTypeId}', [App\Http\Controllers\DeveloperProjectUnitTypeController::class, 'show'])->name('show');
            Route::put('/{unitTypeId}', [App\Http\Controllers\DeveloperProjectUnitTypeController::class, 'update'])->name('update');
            Route::delete('/{unitTypeId}', [App\Http\Controllers\DeveloperProjectUnitTypeController::class, 'destroy'])->name('destroy');
            Route::post('/reorder', [App\Http\Controllers\DeveloperProjectUnitTypeController::class, 'reorder'])->name('reorder');
            
            // Unit Type Expose Generation
            Route::post('/{unitTypeId}/expose/generate', [App\Http\Controllers\DeveloperProjectController::class, 'generateUnitTypeExpose'])->name('expose.generate');
            Route::post('/{unitTypeId}/expose/validate', [App\Http\Controllers\DeveloperProjectController::class, 'validateUnitTypeExpose'])->name('expose.validate');
            
            // Unit Type Assets
            Route::prefix('/{unitTypeId}/assets')->name('assets.')->group(function () {
                Route::get('/', [App\Http\Controllers\DeveloperProjectUnitTypeAssetController::class, 'index'])->name('index');
                Route::post('/', [App\Http\Controllers\DeveloperProjectUnitTypeAssetController::class, 'store'])->name('store');
                Route::post('/from-urls', [App\Http\Controllers\DeveloperProjectUnitTypeAssetController::class, 'storeFromUrls'])->name('store_from_urls');
                Route::put('/bulk-update-tags', [App\Http\Controllers\DeveloperProjectUnitTypeAssetController::class, 'bulkUpdateTags'])->name('bulk_update_tags');
                Route::put('/{assetId}', [App\Http\Controllers\DeveloperProjectUnitTypeAssetController::class, 'update'])->name('update');
                Route::delete('/{assetId}', [App\Http\Controllers\DeveloperProjectUnitTypeAssetController::class, 'destroy'])->name('destroy');
                Route::post('/bulk-delete', [App\Http\Controllers\DeveloperProjectUnitTypeAssetController::class, 'bulkDestroy'])->name('bulk_destroy');
            });
        });
    });

    // ─── Offers ──────────────────────────────────────────────────
    Route::prefix('offers')->name('offers.')->group(function () {
        Route::get('/', [App\Http\Controllers\OfferController::class, 'index'])->name('index');
        Route::post('/', [App\Http\Controllers\OfferController::class, 'store'])->name('store');
        Route::get('/{id}', [App\Http\Controllers\OfferController::class, 'show'])->name('show');
        Route::put('/{id}', [App\Http\Controllers\OfferController::class, 'update'])->name('update');
        Route::delete('/{id}', [App\Http\Controllers\OfferController::class, 'destroy'])->name('destroy');
        Route::post('/{offerId}/attach', [App\Http\Controllers\OfferController::class, 'attach'])->name('attach');
        Route::post('/{offerId}/disable', [App\Http\Controllers\OfferController::class, 'disable'])->name('disable');
        Route::post('/{offerId}/enable', [App\Http\Controllers\OfferController::class, 'enable'])->name('enable');
        Route::post('/{id}/toggle', [App\Http\Controllers\OfferController::class, 'toggle'])->name('toggle');
        Route::delete('/{offerId}/detach', [App\Http\Controllers\OfferController::class, 'detach'])->name('detach');
    });

    // Deal offer endpoints
    Route::prefix('deals/{dealId}/offers')->name('deals.offers.')->group(function () {
        Route::get('/', [App\Http\Controllers\OfferController::class, 'dealOffers'])->name('index');
        Route::delete('/', [App\Http\Controllers\OfferController::class, 'removeFromDeal'])->name('remove');
    });

    // Deal workspace tabs — each fetched independently by the frontend (not
    // Inertia deferred props) so a slow/broken one can't stall the others.
    Route::get('deals/{dealId}/notes', [DealNoteController::class, 'dealNotes'])->name('deals.notes.index');
    Route::get('deals/{dealId}/tasks', [TaskController::class, 'dealTasks'])->name('deals.tasks.index');
    Route::get('deals/{dealId}/meetings', [DealController::class, 'dealMeetings'])->name('deals.meetings.index');
    Route::get('deals/{dealId}/files', [LeadFileController::class, 'dealFiles'])->name('deals.files.index');

    // Property Asset Management (New System)
    Route::get('property-assets/options', [App\Http\Controllers\PropertyAssetController::class, 'getAssetOptions'])->name('properties.assets.options');
    Route::prefix('properties/{property}/assets')->name('properties.assets.')->group(function () {
        Route::get('/', [App\Http\Controllers\PropertyAssetController::class, 'index'])->name('index');
        Route::get('/list', [App\Http\Controllers\PropertyAssetController::class, 'apiIndex'])->name('list');
        Route::post('/', [App\Http\Controllers\PropertyAssetController::class, 'store'])->name('store');
        Route::post('/from-urls', [App\Http\Controllers\PropertyAssetController::class, 'storeFromUrls'])->name('store_from_urls');
        Route::post('/external-url', [App\Http\Controllers\PropertyAssetController::class, 'storeExternalUrl'])->name('store_external_url');
        Route::get('/{asset}', [App\Http\Controllers\PropertyAssetController::class, 'show'])->name('show');
        Route::put('/{asset}', [App\Http\Controllers\PropertyAssetController::class, 'update'])->name('update');
        Route::delete('/{asset}', [App\Http\Controllers\PropertyAssetController::class, 'destroy'])->name('destroy');
        Route::post('/bulk-action', [App\Http\Controllers\PropertyAssetController::class, 'bulkAction'])->name('bulk_action');
        Route::post('/bulk-tags', [App\Http\Controllers\PropertyAssetController::class, 'bulkUpdateTags'])->name('bulk_tags');
        Route::post('/bulk-delete', [App\Http\Controllers\PropertyAssetController::class, 'bulkDestroy'])->name('bulk_destroy');
    });

    // Unit Type as Property — show & mark-as-sold (before resource route to avoid {property} catch)
    Route::get('properties/unit-type/{unitTypeId}', [App\Http\Controllers\PropertyController::class, 'showUnitType'])->name('properties.unit-type.show');
    Route::post('properties/unit-type/{unitTypeId}/mark-as-sold', [App\Http\Controllers\PropertyController::class, 'markUnitTypeAsSold'])->name('properties.unit-type.mark-as-sold');
    Route::post('properties/ai-description', [App\Http\Controllers\PropertyAiController::class, 'generateDescription'])->name('properties.ai-description');

    Route::resource('properties', App\Http\Controllers\PropertyController::class);    Route::post('gantt_link.task_update', [GanttLinkController::class, 'taskUpdateController'])->name('gantt_link.task_update');
    // Meta Conversion Triggers
    Route::resource('meta-conversion-triggers', MetaConversionTriggerController::class);

    Route::post('gantt_link.task_update', [GanttLinkController::class, 'taskUpdateController'])->name('gantt_link.task_update');
    Route::resource('gantt_link', GanttLinkController::class);

    // Test Activity Response Trait Routes
    Route::prefix('test-activity')->name('test-activity.')->group(function () {
        Route::post('email', [App\Http\Controllers\TestActivityController::class, 'testEmail'])->name('email');
        Route::post('whatsapp', [App\Http\Controllers\TestActivityController::class, 'testWhatsApp'])->name('whatsapp');
        Route::post('instagram', [App\Http\Controllers\TestActivityController::class, 'testInstagram'])->name('instagram');
        Route::post('telegram', [App\Http\Controllers\TestActivityController::class, 'testTelegram'])->name('telegram');
        Route::post('retry', [App\Http\Controllers\TestActivityController::class, 'testWithRetry'])->name('retry');
        Route::post('all', [App\Http\Controllers\TestActivityController::class, 'testAllChannels'])->name('all');
    });

    // ══════════════════════════════════════════════════════════════
    //  MLM — Admin Pages (Inertia)
    // ══════════════════════════════════════════════════════════════
    Route::prefix('mlm')->name('mlm.')->group(function () {
        Route::get('dashboard', [App\Http\Controllers\MlmAdminController::class, 'dashboard'])->name('dashboard');
        Route::get('levels', [App\Http\Controllers\MlmAdminController::class, 'levels'])->name('levels');
        Route::get('levels/{level}/rules', [App\Http\Controllers\MlmAdminController::class, 'levelRules'])->name('level_rules');
        Route::get('commission-settings', [App\Http\Controllers\MlmAdminController::class, 'commissionSettings'])->name('commission_settings');
        Route::get('agent-hierarchy', [App\Http\Controllers\MlmAdminController::class, 'agentHierarchy'])->name('agent_hierarchy');
        Route::get('commission-ledger', [App\Http\Controllers\MlmAdminController::class, 'commissionLedger'])->name('commission_ledger');
        Route::get('agent-metrics', [App\Http\Controllers\MlmAdminController::class, 'agentMetrics'])->name('agent_metrics');
        Route::get('agents/{agentId}/dashboard', [App\Http\Controllers\MlmAdminController::class, 'agentDashboard'])->name('agent_dashboard');
        Route::get('level-history', [App\Http\Controllers\MlmAdminController::class, 'levelHistory'])->name('level_history');
        Route::get('cycle-management', [App\Http\Controllers\MlmAdminController::class, 'cycleManagement'])->name('cycle_management');

        // ── MLM Admin JSON API ───────────────────────────────────
        Route::prefix('api')->name('api.')->group(function () {
            Route::get('dashboard-stats', [App\Http\Controllers\MlmAdminApiController::class, 'dashboardStats'])->name('dashboard_stats');

            // Levels CRUD
            Route::get('levels', [App\Http\Controllers\MlmAdminApiController::class, 'getLevels'])->name('levels.index');
            Route::get('levels/{id}', [App\Http\Controllers\MlmAdminApiController::class, 'getLevel'])->name('levels.show');
            Route::post('levels', [App\Http\Controllers\MlmAdminApiController::class, 'storeLevel'])->name('levels.store');
            Route::put('levels/{id}', [App\Http\Controllers\MlmAdminApiController::class, 'updateLevel'])->name('levels.update');
            Route::delete('levels/{id}', [App\Http\Controllers\MlmAdminApiController::class, 'destroyLevel'])->name('levels.destroy');
            Route::post('levels/reorder', [App\Http\Controllers\MlmAdminApiController::class, 'reorderLevels'])->name('levels.reorder');

            // Level Criteria
            Route::get('levels/{levelId}/criteria', [App\Http\Controllers\MlmAdminApiController::class, 'getLevelCriteria'])->name('criteria.index');
            Route::post('criteria', [App\Http\Controllers\MlmAdminApiController::class, 'storeCriterion'])->name('criteria.store');
            Route::put('criteria/{id}', [App\Http\Controllers\MlmAdminApiController::class, 'updateCriterion'])->name('criteria.update');
            Route::delete('criteria/{id}', [App\Http\Controllers\MlmAdminApiController::class, 'destroyCriterion'])->name('criteria.destroy');

            // Commissions
            Route::get('commissions', [App\Http\Controllers\MlmAdminApiController::class, 'getCommissions'])->name('commissions.index');
            Route::post('commissions/{id}/mark-paid', [App\Http\Controllers\MlmAdminApiController::class, 'markCommissionPaid'])->name('commissions.mark_paid');
            Route::post('commissions/bulk-mark-paid', [App\Http\Controllers\MlmAdminApiController::class, 'bulkMarkPaid'])->name('commissions.bulk_mark_paid');
            Route::post('commissions/{id}/revert', [App\Http\Controllers\MlmAdminApiController::class, 'revertCommission'])->name('commissions.revert');
            Route::get('commissions/export', [App\Http\Controllers\MlmAdminApiController::class, 'exportCommissions'])->name('commissions.export');

            // Agent Metrics
            Route::get('agent-metrics', [App\Http\Controllers\MlmAdminApiController::class, 'getAgentMetrics'])->name('agent_metrics');
            Route::get('agents/{agentId}/dashboard-stats', [App\Http\Controllers\MlmAdminApiController::class, 'getAgentDashboardStats'])->name('agent_dashboard_stats');
            Route::post('agents/{agentId}/assign-level', [App\Http\Controllers\MlmAdminApiController::class, 'assignAgentLevel'])->name('agent_assign_level');
            Route::get('agents/{agentId}/commission-profile', [App\Http\Controllers\MlmAdminApiController::class, 'getAgentCommissionProfile'])->name('agent_commission_profile.show');
            Route::patch('agents/{agentId}/commission-profile', [App\Http\Controllers\MlmAdminApiController::class, 'updateAgentCommissionProfile'])->name('agent_commission_profile.update');

            // Level History
            Route::get('level-history', [App\Http\Controllers\MlmAdminApiController::class, 'getLevelHistory'])->name('level_history');

            // Hierarchy
            Route::get('hierarchy', [App\Http\Controllers\MlmAdminApiController::class, 'getHierarchy'])->name('hierarchy');
            Route::post('hierarchy/assign', [App\Http\Controllers\MlmAdminApiController::class, 'assignDownline'])->name('hierarchy.assign');
            Route::post('hierarchy/{agentId}/remove', [App\Http\Controllers\MlmAdminApiController::class, 'removeHierarchy'])->name('hierarchy.remove');

            // Settings
            Route::get('settings', [App\Http\Controllers\MlmAdminApiController::class, 'getSettings'])->name('settings.show');
            Route::put('settings', [App\Http\Controllers\MlmAdminApiController::class, 'updateSettings'])->name('settings.update');

            // Simulation
            Route::get('simulate', [App\Http\Controllers\MlmAdminApiController::class, 'simulate'])->name('simulate');

            // Cycles
            Route::get('cycles', [App\Http\Controllers\MlmAdminApiController::class, 'getCycles'])->name('cycles.index');
            Route::get('cycles/active', [App\Http\Controllers\MlmAdminApiController::class, 'getActiveCycle'])->name('cycles.active');
            Route::post('cycles', [App\Http\Controllers\MlmAdminApiController::class, 'createCycle'])->name('cycles.store');
            Route::get('cycles/{id}', [App\Http\Controllers\MlmAdminApiController::class, 'getCycleDetail'])->name('cycles.show');
            Route::put('cycles/{id}', [App\Http\Controllers\MlmAdminApiController::class, 'updateCycle'])->name('cycles.update');
            Route::delete('cycles/{id}', [App\Http\Controllers\MlmAdminApiController::class, 'deleteCycle'])->name('cycles.destroy');
            Route::post('cycles/{cycleId}/enrollments/{enrollmentId}/force-complete', [App\Http\Controllers\MlmAdminApiController::class, 'forceCompleteEnrollment'])->name('cycles.force_complete_enrollment');
            Route::post('cycles/{id}/resnapshot', [App\Http\Controllers\MlmAdminApiController::class, 'resnapshot'])->name('cycles.resnapshot');
        });
    });

    // ══════════════════════════════════════════════════════════════
    //  MLM — Agent Portal Pages (Inertia) & API
    // ══════════════════════════════════════════════════════════════
    Route::prefix('mlm/agent')->name('mlm.agent.')->group(function () {
        Route::get('dashboard', [App\Http\Controllers\MlmAgentController::class, 'dashboard'])->name('dashboard');
        Route::get('commissions', [App\Http\Controllers\MlmAgentController::class, 'commissions'])->name('commissions');
        Route::get('network', [App\Http\Controllers\MlmAgentController::class, 'network'])->name('network');
        Route::get('uplines', [App\Http\Controllers\MlmAgentController::class, 'uplines'])->name('uplines');
        Route::get('my-level', [App\Http\Controllers\MlmAgentController::class, 'myLevel'])->name('my_level');
        Route::get('deal-contributions', [App\Http\Controllers\MlmAgentController::class, 'dealContributions'])->name('deal_contributions');

        // Agent JSON API
        Route::prefix('api')->name('api.')->group(function () {
            Route::get('dashboard-stats', [App\Http\Controllers\MlmAgentController::class, 'dashboardApi'])->name('dashboard_stats');
            Route::get('commissions', [App\Http\Controllers\MlmAgentController::class, 'commissionsApi'])->name('commissions');
            Route::get('network', [App\Http\Controllers\MlmAgentController::class, 'networkApi'])->name('network');
            Route::get('uplines', [App\Http\Controllers\MlmAgentController::class, 'uplinesApi'])->name('uplines');
            Route::get('my-level', [App\Http\Controllers\MlmAgentController::class, 'myLevelApi'])->name('my_level');
            Route::get('deal-contributions', [App\Http\Controllers\MlmAgentController::class, 'dealContributionsApi'])->name('deal_contributions');
            Route::get('my-enrollment', [App\Http\Controllers\MlmAgentController::class, 'myEnrollmentApi'])->name('my_enrollment');

            // Downline deals & agent invitations
            Route::get('downline/{downlineId}/deals', [App\Http\Controllers\MlmAgentController::class, 'downlineDealsApi'])->name('downline_deals');
            Route::get('deals', [App\Http\Controllers\MlmAgentController::class, 'agentDealsApi'])->name('agent_deals');
            Route::get('downlines', [App\Http\Controllers\MlmAgentController::class, 'downlineListApi'])->name('downline_list');
            Route::post('invites', [App\Http\Controllers\MlmAgentController::class, 'sendInviteApi'])->name('send_invite');
            Route::get('invites', [App\Http\Controllers\MlmAgentController::class, 'getInvitesApi'])->name('invites');
        });
    });
});


if (!app()->environment('production')) {
    Route::get('debug/expose-template', function () {
        $data = [
            'assets' => [
                'hero' => ['https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958912490-9a423243-23.jpg'],
                'cover' => ['https://minio.hibarr.org/backend-uploads/developer-projects/47/assets/1777393241134-a23f5af0-5.jpg'],
                'exterior' => [
                    'https://minio.hibarr.org/backend-uploads/developer-projects/51/assets/1777634351907-f0ea70de-1.jpg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/51/assets/1777634351907-f0ea70de-1.jpg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/42/assets/1777023118345-18624e20-2.jpeg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958911743-b21bfa96-22.jpg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958911005-f9c65c66-21.jpg',
                ],
                'interior' => [
                    'https://minio.hibarr.org/backend-uploads/developer-projects/47/unit-types/184/assets/1777394074170-742a602e-6.jpg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/47/unit-types/184/assets/1777394074889-9a34fceb-7.jpg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/47/unit-types/185/assets/1777394345447-ea495007-3.jpg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/47/unit-types/185/assets/1777394345447-ea495007-3.jpg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/47/unit-types/185/assets/1777394351564-2ca4e02f-10.jpg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/47/unit-types/184/assets/1777394073656-eb6805fb-5.jpg'
                ],
                'facilities' => [
                    'https://minio.hibarr.org/backend-uploads/developer-projects/36/assets/1776778138230-ae745cb5-2026-04-21-16-25-26.png',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/37/assets/1776784462866-6403eb43-1.jpeg',
                    'https://minio.hibarr.org/backend-uploads/developer-projects/40/assets/1776874576035-78862d53-carrington-esentepe-vaz-aci-00-email-c.jpg',
                ],
                'floor-plan' => ['https://minio.hibarr.org/backend-uploads/developer-projects/53/unit-types/197/assets/1778240261212-3b37b114-studio-plan.png'],
                'footer' => ['https://minio.hibarr.org/backend-uploads/developer-projects/40/assets/1776874579203-095a9e3f-carrington-esentepe-vaz-aci-130-email-d.jpg']
            ],
            'branding' => [
                'name_space' => url('/property/assets/name_space.png'),
                'hibarr_expose_text' => url('/property/assets/hibarr_expose_text.png'),
                'project_overview' => url('/property/assets/project_overview_space_for_img.png'),
                'cover_image_project' => url('/property/assets/cover_image_project.png'),
                'project_overview_example' => url('/property/assets/project_overview.png'),
                'panther_watermark' => url('/property/assets/panther_watermark.svg'),
                'logo_blue' => url('/property/assets/logo_blue.svg'),
                'expose_name_client' => url('/property/assets/expose_name_client.svg'),
                'sharp_page_header' => url('/property/assets/sharp_page_header.svg'),
                'map' => url('/property/assets/map.svg'),
                'pin' => url('/property/assets/pin.svg'),
                'arrow' => url('/property/assets/arrow.svg'),
                'hibarr_expose_logo' => url('/property/icons/hibarr-expose.png'),
                'logo_white' => url('/property/icons/logo-white.png'),
                'logo_rounded' => url('/property/icons/hibarr-rounded.png'),
                'block_title' => url('/property/icons/block-title.svg'),
                'logo_full' => url('/property/icons/logo.png'),
            ],
            'client' => ['name' => 'Ayomide Oluniyi'],
            'bedrooms' => 4,
            'living_room' => 1,
            'display_label' => '',
            'block_name' => 'Floor Plan',
            'description' => "
            <p>Imagine stepping into a bright, modern studio designed to make everyday living effortless. Soft lighting and clean finishes create a welcoming feel, while a smart layout gives you space to cook, rest, and work in comfort. From wide glass doors overlooking the pool to a window that opens to sea views , the room is filled with sunshine and a soft coastal breeze, filling the room with natural light and a calm, holiday vibe.
            </p>

            <p style='margin-top: 1em;'>
            But it’s not just a lovely place to live, it’s also a smart choice for investors. With its strong rental appeal and low upkeep, it meets the growing demand for stylish, compact living. This studio promises good occupancy rates and impressive returns, making it a fantastic opportunity for those looking to invest wisely.
            </p>
",
            'location_payload' => [
                'name' => ' Esentepe, Kyrenia   ',
                'description' => 
                "
                <p>Esentepe is a scenic coastal village located in Northern Cyprus, east of Kyrenia. Known for its natural beauty, peaceful environment, and panoramic views of the Mediterranean Sea, Esentepe has become an increasingly popular destination for both tourists and property investors. The area combines traditional Cypriot charm with modern developments, offering a mix of tranquil village life and convenient access to amenities.</p>
                <p style='margin-top: 1em;'>
                Surrounded by mountains and sea, Esentepe is home to beautiful beaches, hiking trails, and one of the region’s top golf courses, the Korineum Golf & Beach Resort. Its close proximity to Kyrenia allows for easy access to shopping, dining, and cultural attractions, while maintaining a quieter and more relaxed atmosphere.</p>
              
                "
                ,
                'image_url' => 'https://minio.hibarr.org/backend-uploads/developer-projects/11/assets/1772701670268-a3c13b32-22%20APRIL%20PHUKET%201%201.1.jpg',
            ],
            'location_infrastructure' => [
                ['name' => 'Schools & Universities', 'distance' => '35 min', 'image' => 'https://minio.hibarr.org/backend-uploads/developer-projects/12/assets/1772798642170-98738864-casa-del-mare_1689668374.webp'],
                ['name' => 'Hospital', 'distance' => '35 min', 'image' => 'https://minio.hibarr.org/backend-uploads/developer-projects/12/assets/1772798642636-95838987-casa-del-mare-sea-view-villas-na-sprzedaz-w-polnocnym-cyprze_1763971901_6.webp'],
                ['name' => 'Supermarket', 'distance' => '2 min', 'image' => 'https://minio.hibarr.org/backend-uploads/developer-projects/12/assets/1772798643257-d7420b14-casa-del-mare-sea-view-villas-na-sprzedaz-w-polnocnym-cyprze_1763971901_14.webp'],
                ['name' => 'Beach', 'distance' => '5 min', 'image' => 'https://minio.hibarr.org/backend-uploads/developer-projects/12/assets/1772798643749-4ceddccd-casa-del-mare-sea-view-villas-na-sprzedaz-w-polnocnym-cyprze_1763971956_12.webp'],
            ],
            'location_airports' => [
                ['name' => 'Ercan International', 'distance' => '32', 'image' => 'https://minio.hibarr.org/backend-uploads/developer-projects/13/unit-types/56/assets/1772810961229-006e8c27-villa%20night2.jpg'],
                ['name' => 'Paphos International', 'distance' => '160', 'image' => 'https://minio.hibarr.org/backend-uploads/developer-projects/13/unit-types/56/assets/1772810960321-4298e6da-villa%20night.jpg'],
                ['name' => 'Larnaca International', 'distance' => '81.4', 'image' => 'https://minio.hibarr.org/backend-uploads/developer-projects/13/unit-types/56/assets/1772810961229-006e8c27-villa%20night2.jpg'],
                ],
            'facilities' => [
                'bar', 'basketball_court', 'beach', 'cafe', 'car_park', 'central_generator', 'cleaning_service', 'cycling_routes', 'gated_community', 'gym', 
                
                // 'hamam', 'indoor_pool', 
                'kids_playground', 'massage_spa', 'on_site_management', 
                'outdoor_pool', 'restaurant', 'sauna', 'security_24_7', 
                
                'tennis_court', 
                'walking_paths', 'supermarket'
            ],
            'facility_labels' => [
                'Bar', 'Basketball Court', 'Beach', 'Cafe', 'Car Park', 'Central Generator', 'Cleaning Service', 'Cycling Routes', 'Gated Community', 'Gym', 'Hamam', 'Indoor Pool', 
                'Kids Playground', 'Massage Spa', 'On-site Management', 'Outdoor Pool', 
                'Restaurant', 'Sauna', 'Security 24/7',
                 'Tennis Court', 'Walking Paths', 'Supermarket'
            ],
            'facility_images_by_slug' => [
                'bar' => ['https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958914628-198cbf76-25.jpg'],
                'basketball_court' => ['https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958915571-2f336d93-26.jpg'],
                'beach' => ['https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958916830-c0af6049-27.jpg'],
                'cafe' => ['https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958905344-9edcfc1c-15.jpg'],
                'car_park' => ['https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958906313-48a8e43a-16.jpg'],
                'central_generator' => ['https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319325248-24f790fa-8.jpg'],
                'cleaning_service' => ['https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319348395-f67db718-9.jpg'],
                'cycling_routes' => ['https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319367430-0d6fd132-10.jpg'],
                'gated_community' => ['https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319388730-19ed746c-11.jpg'],
                'gym' => ['https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319452222-94c3cf36-14.jpg'],
                'hamam' => ['https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319462254-c61db28d-16.jpg'],
                'indoor_pool' => ['https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369425974-7083ad4c-6.jpg'],
                'kids_playground' => ['https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369428292-1bed2ca1-7.jpg'],
                'massage_spa' => ['https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369434854-b83be26f-10.jpg'],
                'on_site_management' => ['https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369436478-04334b3f-11.jpg'],
                'outdoor_pool' => ['https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369437648-673730e2-12.jpg'],
                'restaurant' => ['https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369438900-e8b451de-13.jpg'],
                'sauna' => ['https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369440130-11f21c82-14.jpg'],
                'security_24_7' => ['https://minio.hibarr.org/backend-uploads/developer-projects/45/unit-types/180/assets/1777370282693-a9a7668f-copy-of-img-1798.jpg'],
                // tennis_court, walking_paths, supermarket left as defaults if needed
            ],
            'facility_default_images_by_slug' => [
                'bar' => 'https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958914628-198cbf76-25.jpg',
                'basketball_court' => 'https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958915571-2f336d93-26.jpg',
                'beach' => 'https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958916830-c0af6049-27.jpg',
                'cafe' => 'https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958905344-9edcfc1c-15.jpg',
                'car_park' => 'https://minio.hibarr.org/backend-uploads/developer-projects/41/assets/1776958906313-48a8e43a-16.jpg',
                'central_generator' => 'https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319325248-24f790fa-8.jpg',
                'cleaning_service' => 'https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319348395-f67db718-9.jpg',
                'cycling_routes' => 'https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319367430-0d6fd132-10.jpg',
                'gated_community' => 'https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319388730-19ed746c-11.jpg',
                'gym' => 'https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319452222-94c3cf36-14.jpg',
                'hamam' => 'https://minio.hibarr.org/backend-uploads/developer-projects/44/assets/1777319462254-c61db28d-16.jpg',
                'indoor_pool' => 'https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369425974-7083ad4c-6.jpg',
                'kids_playground' => 'https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369428292-1bed2ca1-7.jpg',
                'massage_spa' => 'https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369434854-b83be26f-10.jpg',
                'on_site_management' => 'https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369436478-04334b3f-11.jpg',
                'outdoor_pool' => 'https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369437648-673730e2-12.jpg',
                'restaurant' => 'https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369438900-e8b451de-13.jpg',
                'sauna' => 'https://minio.hibarr.org/backend-uploads/developer-projects/45/assets/1777369440130-11f21c82-14.jpg',
                'security_24_7' => 'https://minio.hibarr.org/backend-uploads/developer-projects/45/unit-types/180/assets/1777370282693-a9a7668f-copy-of-img-1798.jpg',
            ],
            'exterior_features' => [
                'Bar', 'Basketball Court', 'Beach', 'Cafe', 'Car Park', 'Central Generator', 'Cleaning Service', 'Cycling Routes', 'Gated Community', 'Gym', 'Hamam', 'Indoor Pool', 'Kids Playground', 'Massage Spa', 'On-site Management', 'Outdoor Pool', 'Restaurant', 'Sauna', 'Security 24/7', 'Tennis Court', 'Walking Paths', 'Supermarket'
            ],
            'agent' => [
                'name' => 'Rabih Rabea',
                'position' => 'Real Estate Consultant',
                'email' => 'info@hibarr.de',
                'phone' => '+49 173 100 99 00',
            ],
            'company' => [
                'website' => 'www.hibarr.de',
                'address' => 'Sehit Mehmet Mustafa Sokak 171, 9930 Kyrenia Merkez, North Cyprus',
            ],
            'expose_global_config' => [
                'outro' => [
                    'title' => 'ROOTED IN BEAUTY, GROWING IN VALUE',
                    'description' => "
                    <p>A rare Mediterranean destination with crystal-clear waters, golden beaches, and centuries of rich history, creating an unmatched lifestyle.</p>
                    <p style='margin-top: 1em;'>
                    Whether you seek a smart investment or a dream vacation home, North Cyprus blends natural beauty, cultural heritage, and modern comfort.

                    </p>
                    <p style='margin-top: 1em;'>
                    With 340+ sunny days, low living costs, and one of Europe’s safest lifestyles, North Cyprus invites you to belong to a place where time slows, opportunities grow, and the Mediterranean feels truly authentic.

                    </p>
                    
                    ",
                    'primary_image_url' => 'https://minio.hibarr.org/backend-uploads/developer-projects/15/assets/1776678701638-a5b7ecc7-1775145486331-b8d156a2-a-tipi-balkony-1.jpeg',
                    'secondary_image_url' => 'https://minio.hibarr.org/backend-uploads/developer-projects/15/assets/1776678702665-ce9e5bac-1775145487030-3f54324c-a-tipi.jpeg',
                ],
                'qr' => [
                    'enabled' => true,
                    'qr_code_data_uri' => 'https://via.placeholder.com/185?text=QR',
                    'label' => 'Scan for more details',
                ],
            ],
            'unit_style_list' => ['Studio', 'City Apartment'],
            'unit_style' => ['Studio', 'City Apartment'],
            'distances' => [
                ['type' => 'infrastructure', 'title' => 'Metro Station', 'distance' => '2 km', 'image' => 'https://via.placeholder.com/400x300?text=Metro'],
                ['type' => 'airport', 'title' => 'Regional Airport', 'distance' => '25 km', 'image' => 'https://via.placeholder.com/400x300?text=Airport'],
            ],
        ];

        return view('pdf.expose.property.expose-template', compact('data'));
    })->name('debug.expose_template');
}
