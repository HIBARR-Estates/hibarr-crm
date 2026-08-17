<?php

namespace App\Console;

use App\Console\Commands\AddMissingRolePermission;
use App\Console\Commands\AssignEmployeeShiftRotation;
use App\Console\Commands\AssignShiftRotation;
use App\Console\Commands\AutoClockOut;
use App\Console\Commands\AutoCreateRecurringExpenses;
use App\Console\Commands\AutoCreateRecurringInvoices;
use App\Console\Commands\AutoCreateRecurringTasks;
use App\Console\Commands\AutoStopTimer;
use App\Console\Commands\BirthdayReminderCommand;
use App\Console\Commands\CarryForwardLeaves;
use App\Console\Commands\ClearLogs;
use App\Console\Commands\ClearNullSessions;
use App\Console\Commands\CreateEmployeeLeaveQuotaHistory;
use App\Console\Commands\CreateTranslations;
use App\Console\Commands\DeduplicateProjectLocations;
use App\Console\Commands\EscalateOverdueAvailabilityRequests;
use App\Console\Commands\FetchTicketEmails;
use App\Console\Commands\HideCronJobMessage;
use App\Console\Commands\InActiveEmployee;
use App\Console\Commands\LeavesQuotaRenew;
use App\Console\Commands\MigrateFilesToExternalStorage;
use App\Console\Commands\RecalculateLeavesQuotas;
use App\Console\Commands\RecoverProjectFacilities;
use App\Console\Commands\RemoveSeenNotification;
use App\Console\Commands\SendApproachingDealCloseDateNotifications;
use App\Console\Commands\SendAttendanceReminder;
use App\Console\Commands\SendAutoFollowUpReminder;
use App\Console\Commands\SendAutoTaskReminder;
use App\Console\Commands\SendDailyTimelogReport;
use App\Console\Commands\SendEventReminder;
use App\Console\Commands\SendInvoiceReminder;
use App\Console\Commands\SendMonthlyAttendanceReport;
use App\Console\Commands\SendOverdueLeadFollowUpNotifications;
use App\Console\Commands\SendOverdueTaskNotifications;
use App\Console\Commands\SendProjectReminder;
use App\Console\Commands\SendTimeTracker;
use App\Console\Commands\SyncDynamicTranslations;
use App\Console\Commands\SyncUserPermissions;
use App\Console\Commands\SendMlmApproachingNotifications;
use App\Console\Commands\TestNotificationsCommand;
use App\Console\Commands\UpdateExchangeRates;
use DateTimeZone;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * The Artisan commands provided by your application.
     *
     * @var array
     */
    protected $commands = [
        AutoClockOut::class,
        UpdateExchangeRates::class,
        AutoStopTimer::class,
        SendEventReminder::class,
        SendProjectReminder::class,
        HideCronJobMessage::class,
        SendAutoTaskReminder::class,
        CreateTranslations::class,
        AutoCreateRecurringInvoices::class,
        CarryForwardLeaves::class,
        AutoCreateRecurringExpenses::class,
        ClearNullSessions::class,
        SendInvoiceReminder::class,
        RemoveSeenNotification::class,
        SendAttendanceReminder::class,
        AutoCreateRecurringTasks::class,
        SyncUserPermissions::class,
        SendAutoFollowUpReminder::class,
        SendOverdueLeadFollowUpNotifications::class,
        SendOverdueTaskNotifications::class,
        SendApproachingDealCloseDateNotifications::class,
        FetchTicketEmails::class,
        AddMissingRolePermission::class,
        BirthdayReminderCommand::class,
        SendTimeTracker::class,
        SendMonthlyAttendanceReport::class,
        SendDailyTimelogReport::class,
        LeavesQuotaRenew::class,
        ClearLogs::class,
        InActiveEmployee::class,
        CreateEmployeeLeaveQuotaHistory::class,
        DeduplicateProjectLocations::class,
        AssignShiftRotation::class,
        AssignEmployeeShiftRotation::class,
        RecalculateLeavesQuotas::class,
        EscalateOverdueAvailabilityRequests::class,
        MigrateFilesToExternalStorage::class,
        RecoverProjectFacilities::class,
        SyncDynamicTranslations::class,
        TestNotificationsCommand::class,
        SendMlmApproachingNotifications::class,
    ];

    /**
     * Get the timezone that should be used by default for scheduled events.
     */
    protected function scheduleTimezone(): DateTimeZone|string|null
    {
        // Get the timezone from the configuration
        return config('app.cron_timezone');

    }

    /**
     * Shared cache store for schedule mutexes (withoutOverlapping).
     * Must be persistent across processes — not the in-memory array driver.
     */
    protected function scheduleCache()
    {
        $store = config('cache.default');

        return ($store === 'array' || $store === null) ? 'file' : $store;
    }

    /**
     * Define the application's command schedule.
     *
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {

        $schedule->command('recurring-task-create')->dailyAt('00:30');
        $schedule->command('auto-stop-timer')->everyThirtyMinutes();
        $schedule->command('birthday-notification')->dailyAt('09:00');

        // Every Minute
        $schedule->command('send-event-reminder')->everyMinute();
        $schedule->command('auto-clock-out')->everyMinute();
        $schedule->command('hide-cron-message')->everyMinute();
        $schedule->command('send-attendance-reminder')->everyMinute();
        $schedule->command('sync-user-permissions')->everyMinute();
        // $schedule->command('fetch-ticket-emails')->everyMinute(); // phpcs:ignore
        $schedule->command('send-auto-followup-reminder')->everyMinute();
        $schedule->command('send-overdue-lead-followup-notifications')->hourly()->withoutOverlapping();
        $schedule->command('send-overdue-task-notifications')->hourly()->withoutOverlapping();
        $schedule->command('send-approaching-deal-close-date-notifications')->dailyAt('08:00');
        $schedule->command('send-mlm-approaching-notifications')->dailyAt('08:15');
        $schedule->command('reminders:prepare')->everyFifteenMinutes();
        $schedule->command('reminders:send-due')->everyMinute();
        $schedule->command('send-time-tracker')->everyMinute();
        // Retry queue process every 5 minutes
        // $schedule->command('activity:retry-queue process --limit=50')->everyFiveMinutes();

        // Daily added different time to reduce server load
        $schedule->command('send-project-reminder')->dailyAt('01:10');
        $schedule->command('send-auto-task-reminder')->dailyAt('01:20');
        $schedule->command('recurring-invoice-create')->dailyAt('01:30');
        $schedule->command('recurring-expenses-create')->dailyAt('01:40');
        $schedule->command('send-invoice-reminder')->dailyAt('01:50');
        $schedule->command('delete-seen-notification')->dailyAt('02:10');
        $schedule->command('update-exchange-rate')->dailyAt('02:20');
        $schedule->command('send-daily-timelog-report')->dailyAt('02:30');
        // $schedule->command('app:leaves-quota-renew')->dailyAt('02:30');
        $schedule->command('log:clean --keep-last')->dailyAt('02:40');
        $schedule->command('crm:archive-events --sync')->dailyAt('03:00');
        $schedule->command('inactive-employee')->dailyAt('02:50');
        $schedule->command('daily-schedule-reminder')->daily();
        $schedule->command('assign-shift-rotation')->dailyAt('00:01');
        // Retry queue cleanup every day at 3:00 AM
        $schedule->command('activity:retry-queue cleanup --days=30')->dailyAt('03:00');

        // MLM cycle management: transition statuses, handle overflows, auto-generate cycles
        $schedule->command('mlm:cycle-check')->dailyAt('00:15');

        // Hourly
        $schedule->command('clear-null-session')->hourly();
        $schedule->command('create-database-backup')->hourly();
        $schedule->command('delete-database-backup')->hourly();
        $schedule->command('add-missing-permissions')->everyThirtyMinutes();
        $schedule->command('escalate-availability-requests')->everyThirtyMinutes();

        $schedule->command('send-monthly-attendance-report')->monthly();
        $schedule->command('app:create-employee-leave-quota-history')->monthly();
        // $schedule->command('carry-forward-leave')->monthly();
        $schedule->command('app:annual-carry-forward-leaves')->monthly();
        $schedule->command('app:annual-reimburse-leaves')->monthly();
        $schedule->command('app:recalculate-leaves-quotas')->monthly();

        $schedule->command('queue:flush')->weekly();

        // Drain named queues (incl. entity reminders) when supervisor is briefly down.
        // Primary workers still come from supervisor (see scripts/fix_for_supervisor*).
        $schedule->command('queue:work database --queue=default,communication_activities,resolvers,PropertyImport,LeadImport,DealImport,reminders-prepare,reminders-send --tries=3 --stop-when-empty')
            ->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');
    }
}
