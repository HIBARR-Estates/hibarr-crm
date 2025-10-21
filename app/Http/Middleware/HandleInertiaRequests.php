<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     */
    protected $rootView = 'layouts.inertia_alt';

    /**
     * Determines the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Defines the props that are shared by default.
     */
    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => fn () => [
                'user' => auth()->user(),
            ],
            'default_currency_symbol' => company()?->currency?->currency_symbol,
            'default_currency_code' => company()?->currency?->currency_code,
            'currencies' => fn () => company()?->currencies,
            'errors' => fn () => $request->session()->get('errors')
                ? $request->session()->get('errors')->getBag('default')->getMessages()
                : (object) [],
            'flash' => [
                'property' => fn () => $request->session()->get('property'),
                'message' => fn () => $request->session()->get('message'),
                'error' => fn () => $request->session()->get('error'),
                'success' => fn () => $request->session()->get('success'),
            ],
            'csrf_token' => csrf_token(),
            'app_url' => config('app.url'),
            'company' => function_exists('companyOrGlobalSetting') ? companyOrGlobalSetting() : null,
            'appName' => function_exists('companyOrGlobalSetting') ? companyOrGlobalSetting()->app_name ?? config('app.name') : config('app.name'),
            'appTheme' => function_exists('companyOrGlobalSetting') ? companyOrGlobalSetting() : null,
            'sidebar' => [
                'permissions' => function_exists('user') && function_exists('user_modules') ? $this->getSidebarPermissions() : [],
                'modules' => function_exists('user_modules') ? user_modules() : [],
                'unreadMessagesCount' => function_exists('user') && user() ? $this->getUnreadMessagesCount() : 0,
                'customLinks' => function_exists('user') ? $this->getCustomLinks() : [],
                'worksuitePlugins' => function_exists('user') ? $this->getWorksuitePlugins() : [],
            ],
            'currentRouteName' => $request->route() ? $request->route()->getName() : '',
        ]);
    }

    private function getSidebarPermissions(): array
    {
        if (!function_exists('user') || !user()) {
            return [];
        }

        return [
            'view_overview_dashboard' => user()->permission('view_overview_dashboard') ?? 4,
            'view_project_dashboard' => user()->permission('view_project_dashboard') ?? 4,
            'view_client_dashboard' => user()->permission('view_client_dashboard') ?? 4,
            'view_hr_dashboard' => user()->permission('view_hr_dashboard') ?? 4,
            'view_ticket_dashboard' => user()->permission('view_ticket_dashboard') ?? 4,
            'view_finance_dashboard' => user()->permission('view_finance_dashboard') ?? 4,
            'view_lead' => user()->permission('view_lead') ?? 4,
            'view_deals' => user()->permission('view_deals') ?? 4,
            'view_clients' => user()->permission('view_clients') ?? 4,
            'view_employees' => user()->permission('view_employees') ?? 4,
            'view_leave' => user()->permission('view_leave') ?? 4,
            'view_attendance' => user()->permission('view_attendance') ?? 4,
            'view_holiday' => user()->permission('view_holiday') ?? 4,
            'view_shift_roster' => user()->permission('view_shift_roster') ?? 4,
            'view_contract' => user()->permission('view_contract') ?? 4,
            'view_projects' => user()->permission('view_projects') ?? 4,
            'view_tasks' => user()->permission('view_tasks') ?? 4,
            'view_timelogs' => user()->permission('view_timelogs') ?? 4,
            'view_estimates' => user()->permission('view_estimates') ?? 4,
            'view_invoices' => user()->permission('view_invoices') ?? 4,
            'view_payments' => user()->permission('view_payments') ?? 4,
            'view_expenses' => user()->permission('view_expenses') ?? 4,
            'view_bankaccount' => user()->permission('view_bankaccount') ?? 4,
            'view_lead_proposals' => user()->permission('view_lead_proposals') ?? 4,
            'view_product' => user()->permission('view_product') ?? 4,
            'view_order' => user()->permission('view_order') ?? 4,
            'view_tickets' => user()->permission('view_tickets') ?? 4,
            'view_events' => user()->permission('view_events') ?? 4,
            'view_notice' => user()->permission('view_notice') ?? 4,
            'view_knowledgebase' => user()->permission('view_knowledgebase') ?? 4,
            'view_client_note' => user()->permission('view_client_note') ?? 4,
            'manage_company_setting' => user()->permission('manage_company_setting') ?? 1,
            'add_employees' => user()->permission('add_employees') ?? 1,
            'view_designation' => user()->permission('view_designation') ?? 1,
            'view_department' => user()->permission('view_department') ?? 1,
            'view_appreciation' => user()->permission('view_appreciation') ?? 1,
            'manage_award' => user()->permission('manage_award') ?? 1,
            'view_task_report' => user()->permission('view_task_report') ?? 1,
            'view_time_log_report' => user()->permission('view_time_log_report') ?? 1,
            'view_finance_report' => user()->permission('view_finance_report') ?? 1,
            'view_income_expense_report' => user()->permission('view_income_expense_report') ?? 1,
            'view_leave_report' => user()->permission('view_leave_report') ?? 1,
            'view_attendance_report' => user()->permission('view_attendance_report') ?? 1,
            'view_expense_report' => user()->permission('view_expense_report') ?? 1,
            'view_lead_report' => user()->permission('view_lead_report') ?? 1,
            'view_sales_report' => user()->permission('view_sales_report') ?? 1,
        ];
    }

    private function getUnreadMessagesCount(): int
    {
        // Return unread messages count - implement based on your message system
        return 0; // Placeholder
    }

    private function getCustomLinks(): array
    {
        // Return custom links based on your system
        return []; // Placeholder
    }

    private function getWorksuitePlugins(): array
    {
        // Return worksuite plugins
        return []; // Placeholder
    }
}