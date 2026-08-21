<?php

namespace App\Console\Commands;

use App\Enums\DealActivityType;
use App\Enums\LeadActivityType;
use App\Enums\PropertyActivityType;
use App\Enums\MlmNotificationEvent;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmCycle;
use App\Models\MlmLevel;
use App\Models\Company;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use App\Notifications\BaseNotification;
use App\Notifications\DealCloseDateApproaching;
use App\Notifications\LeadFollowUpOverdue;
use App\Services\DealNotificationService;
use App\Services\LeadNotificationService;
use App\Services\MlmNotificationService;
use App\Services\PropertyNotificationService;
use App\Services\TaskLifecycleNotificationService;
use App\Support\FeatureFlags;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;

/**
 * Dev helper to exercise CRM notification types (in-app bell + email when enabled).
 *
 * Examples:
 *   php artisan notifications:test --list
 *   php artisan notifications:test --cron --force
 *   php artisan notifications:test --to-user=1 --all
 *   php artisan notifications:test --to-user=1 --type=task-overdue --type=deal-close-approaching --force
 */
class TestNotificationsCommand extends Command
{
    protected $signature = 'notifications:test
                            {--list : List testable notification type slugs}
                            {--cron : Run scheduled notification commands}
                            {--to-user= : Send sample notification(s) to this user only}
                            {--all : With --to-user, send every listed type (otherwise --type is required)}
                            {--type=* : Notification slug(s) to send (repeatable)}
                            {--company= : Company id for entity lookup}
                            {--deal= : Deal id override}
                            {--lead= : Lead id override}
                            {--task= : Task id override}
                            {--property= : Property id override}
                            {--follow-up= : DealFollowUp id override}
                            {--force : Clear per-day dedup cache keys before sending}
                            {--dry-run : Print actions without sending}';

    protected $description = 'List, dry-run, or send sample CRM notifications for local testing';

    public function handle(
        DealNotificationService $dealNotifications,
        LeadNotificationService $leadNotifications,
        TaskLifecycleNotificationService $taskLifecycleNotifications,
        PropertyNotificationService $propertyNotifications,
        MlmNotificationService $mlmNotifications,
    ): int {
        if ($this->option('list')) {
            $this->printCatalog();

            return self::SUCCESS;
        }

        if ($this->option('cron')) {
            return $this->runCronCommands();
        }

        $toUserId = $this->option('to-user');
        if ($toUserId === null || $toUserId === '') {
            $this->error('Specify --list, --cron, or --to-user=<id> (with --type or --all).');
            $this->line('Example: php artisan notifications:test --to-user=1 --all --force');

            return self::FAILURE;
        }

        $user = User::query()->find((int) $toUserId);
        if (! $user) {
            $this->error("User {$toUserId} not found.");

            return self::FAILURE;
        }

        $types = $this->resolveTypes();
        if ($types === []) {
            $this->error('No types selected. Use --all or --type=<slug> (see --list).');

            return self::FAILURE;
        }

        $companyId = $this->resolveCompanyId($user);
        if (! $companyId) {
            $this->error('Could not resolve company. Pass --company=<id>.');

            return self::FAILURE;
        }

        try {
            $context = $this->buildContext($companyId, $user);
        } catch (\RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');
        $sent = 0;
        $skipped = 0;

        foreach ($types as $slug) {
            $handler = $this->handlers(
                $dealNotifications,
                $leadNotifications,
                $taskLifecycleNotifications,
                $propertyNotifications,
                $mlmNotifications,
            )[$slug] ?? null;

            if ($handler === null) {
                $this->warn("Unknown type: {$slug}");
                $skipped++;

                continue;
            }

            if ($dryRun) {
                $this->line("[dry-run] would send: {$slug} → user #{$user->id} ({$user->email})");
                $sent++;

                continue;
            }

            try {
                if ($force) {
                    $this->clearDedupCacheForType($slug, $context);
                }

                $handler($context);
                $this->info("Sent: {$slug}");
                $sent++;
            } catch (\Throwable $e) {
                $this->warn("Skipped {$slug}: {$e->getMessage()}");
                $skipped++;
            }
        }

        $this->newLine();
        $this->line("Done. sent={$sent}, skipped={$skipped}. Check the bell for user #{$user->id}.");

        return $skipped > 0 && $sent === 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @return list<string>
     */
    private function resolveTypes(): array
    {
        /** @var list<string> $explicit */
        $explicit = array_values(array_filter($this->option('type') ?? []));

        if ($explicit !== []) {
            return $explicit;
        }

        if ($this->option('all')) {
            return array_keys($this->typeLabels());
        }

        return [];
    }

    private function resolveCompanyId(User $user): ?int
    {
        $company = $this->option('company');
        if ($company !== null && $company !== '') {
            return (int) $company;
        }

        return $user->company_id ? (int) $user->company_id : null;
    }

    /**
     * @return array{user: User, company: Company, deal: Deal, lead: Lead, task: Task, property: Property, followUp: DealFollowUp}
     */
    private function buildContext(int $companyId, User $user): array
    {
        $company = Company::query()->find($companyId);
        if (! $company) {
            throw new \RuntimeException("Company {$companyId} not found.");
        }

        $deal = $this->option('deal')
            ? Deal::query()->where('company_id', $companyId)->findOrFail((int) $this->option('deal'))
            : Deal::query()->where('company_id', $companyId)->latest('id')->first();

        $lead = $this->option('lead')
            ? Lead::query()->where('company_id', $companyId)->findOrFail((int) $this->option('lead'))
            : Lead::query()->where('company_id', $companyId)->latest('id')->first();

        $task = $this->option('task')
            ? Task::query()->where('company_id', $companyId)->findOrFail((int) $this->option('task'))
            : Task::query()->where('company_id', $companyId)->whereNotNull('due_date')->latest('id')->first()
                ?? Task::query()->where('company_id', $companyId)->latest('id')->first();

        $property = $this->option('property')
            ? Property::query()->where('company_id', $companyId)->findOrFail((int) $this->option('property'))
            : Property::query()->where('company_id', $companyId)->latest('id')->first();

        $followUp = $this->option('follow-up')
            ? DealFollowUp::query()->findOrFail((int) $this->option('follow-up'))
            : DealFollowUp::query()
                ->where(function ($q) use ($companyId) {
                    $q->whereHas('deal', fn ($dq) => $dq->where('company_id', $companyId))
                        ->orWhereHas('lead', fn ($lq) => $lq->where('company_id', $companyId));
                })
                ->latest('id')
                ->first();

        $missing = array_filter([
            'deal' => $deal,
            'lead' => $lead,
            'task' => $task,
            'property' => $property,
            'follow-up' => $followUp,
        ], fn ($model) => $model === null);

        if ($missing !== []) {
            throw new \RuntimeException(
                'Missing sample data for company '.$companyId.': '.implode(', ', array_keys($missing))
                .'. Create records or pass --deal/--lead/--task/--property/--follow-up.'
            );
        }

        return [
            'user' => $user,
            'company' => $company,
            'deal' => $deal,
            'lead' => $lead,
            'task' => $task,
            'property' => $property,
            'followUp' => $followUp,
        ];
    }

    private function runCronCommands(): int
    {
        $commands = [
            'send-overdue-task-notifications',
            'send-overdue-lead-followup-notifications',
            'send-approaching-deal-close-date-notifications',
            'send-mlm-approaching-notifications',
        ];

        if ($this->option('dry-run')) {
            foreach ($commands as $command) {
                $this->line("[dry-run] would run: php artisan {$command}");
            }

            return self::SUCCESS;
        }

        if ($this->option('force')) {
            $this->warn('--force with --cron clears ALL dedup keys for overdue/close-date notifications.');
            Cache::flush();
        }

        foreach ($commands as $command) {
            $this->line("Running: {$command}");
            Artisan::call($command);
            $this->line(trim(Artisan::output()) ?: '  (no output)');
        }

        $this->info('Cron notification commands finished. Check assignees’ bell icons and mail logs.');

        return self::SUCCESS;
    }

    private function printCatalog(): void
    {
        $this->info('Notification test slugs (use with --type= or --all):');
        $this->table(['Slug', 'Description'], collect($this->typeLabels())->map(
            fn (string $label, string $slug) => [$slug, $label]
        )->values()->all());

        $this->newLine();
        $this->line('Scheduled commands (--cron):');
        $this->line('  send-overdue-task-notifications');
        $this->line('  send-overdue-lead-followup-notifications');
        $this->line('  send-approaching-deal-close-date-notifications');
        $this->line('  send-mlm-approaching-notifications');
        $this->newLine();
        $this->line('Notes:');
        $this->line('  • deal-deleted is skipped in console (production guard).');
        $this->line('  • task-lifecycle-* requires feature flag crm.task-lifecycle-notifications.');
        $this->line('  • overdue types dedupe once per day — use --force to bypass.');
    }

    /**
     * @return array<string, string>
     */
    private function typeLabels(): array
    {
        $labels = [];

        foreach (DealActivityType::cases() as $case) {
            $labels['deal-'.$case->value] = 'Deal: '.$case->label();
        }

        $labels['deal-close-approaching'] = 'Deal: close date approaching (cron)';
        $labels['lead-followup-overdue'] = 'Lead/Deal: follow-up overdue (cron)';

        foreach (LeadActivityType::cases() as $case) {
            $labels['lead-'.$case->value] = 'Lead: '.$case->label();
        }

        $labels['lead-deleted'] = 'Lead: deleted';

        foreach (PropertyActivityType::cases() as $case) {
            $labels['property-'.$case->value] = 'Property: '.$case->label();
        }

        $labels['task-overdue'] = 'Task: overdue (cron)';
        $labels['task-deleted'] = 'Task: deleted';
        $labels['task-rejected'] = 'Task: rejected';
        $labels['task-priority-changed'] = 'Task: priority changed';
        $labels['task-lifecycle-created'] = 'Task lifecycle: created';
        $labels['task-lifecycle-updated'] = 'Task lifecycle: updated';
        $labels['task-lifecycle-due'] = 'Task lifecycle: due';
        $labels['task-lifecycle-completed'] = 'Task lifecycle: completed';

        foreach (MlmNotificationEvent::cases() as $case) {
            $labels[$case->value] = 'MLM: '.str_replace('mlm_', '', $case->value);
        }

        return $labels;
    }

    /**
     * @return array<string, callable(array): void>
     */
    private function handlers(
        DealNotificationService $dealNotifications,
        LeadNotificationService $leadNotifications,
        TaskLifecycleNotificationService $taskLifecycleNotifications,
        PropertyNotificationService $propertyNotifications,
        MlmNotificationService $mlmNotifications,
    ): array {
        $handlers = [];

        foreach (DealActivityType::cases() as $case) {
            $handlers['deal-'.$case->value] = function (array $ctx) use ($dealNotifications, $case) {
                $dealNotifications->notifyDealActivity(
                    $ctx['deal'],
                    $case,
                    $this->sampleDealActivityData($case),
                    null,
                    [],
                    $this->onlyUser($ctx['user']),
                );
            };
        }

        $handlers['deal-close-approaching'] = function (array $ctx) {
            \Illuminate\Support\Facades\Notification::send(
                $this->onlyUser($ctx['user']),
                BaseNotification::applySuppressionFromContainer(new DealCloseDateApproaching($ctx['deal'])),
            );
        };

        $handlers['lead-followup-overdue'] = function (array $ctx) {
            \Illuminate\Support\Facades\Notification::send(
                $this->onlyUser($ctx['user']),
                new LeadFollowUpOverdue($ctx['followUp']),
            );
        };

        foreach (LeadActivityType::cases() as $case) {
            $handlers['lead-'.$case->value] = function (array $ctx) use ($leadNotifications, $case) {
                $leadNotifications->notifyLeadActivity(
                    $ctx['lead'],
                    $case,
                    $this->sampleLeadActivityData($case),
                    null,
                    $this->onlyUser($ctx['user']),
                );
            };
        }

        $handlers['lead-deleted'] = function (array $ctx) {
            \Illuminate\Support\Facades\Notification::send(
                $this->onlyUser($ctx['user']),
                new \App\Notifications\LeadDeleted($ctx['lead'], $ctx['user']),
            );
        };

        foreach (PropertyActivityType::cases() as $case) {
            $handlers['property-'.$case->value] = function (array $ctx) use ($propertyNotifications, $case) {
                $propertyNotifications->notifyPropertyActivity(
                    $ctx['property'],
                    $case,
                    $this->samplePropertyActivityData($case, $ctx['property']),
                    null,
                    $this->onlyUser($ctx['user']),
                );
            };
        }

        $handlers['task-overdue'] = function (array $ctx) {
            \Illuminate\Support\Facades\Notification::send(
                $this->onlyUser($ctx['user']),
                new \App\Notifications\TaskOverdue($ctx['task'], 1),
            );
        };
        $handlers['task-deleted'] = function (array $ctx) {
            \Illuminate\Support\Facades\Notification::send(
                $this->onlyUser($ctx['user']),
                new \App\Notifications\TaskDeleted($ctx['task'], $ctx['user']),
            );
        };
        $handlers['task-rejected'] = function (array $ctx) {
            \Illuminate\Support\Facades\Notification::send(
                $this->onlyUser($ctx['user']),
                new \App\Notifications\TaskRejected($ctx['task'], 'Test rejection reason', $ctx['user']),
            );
        };
        $handlers['task-priority-changed'] = function (array $ctx) {
            \Illuminate\Support\Facades\Notification::send(
                $this->onlyUser($ctx['user']),
                new \App\Notifications\TaskPriorityUpdated($ctx['task'], 'medium', $ctx['user']),
            );
        };

        $handlers['task-lifecycle-created'] = function (array $ctx) use ($taskLifecycleNotifications) {
            $this->assertTaskLifecycleEnabled();
            $this->sendTaskLifecycleToUser($taskLifecycleNotifications, 'created', $ctx);
        };
        $handlers['task-lifecycle-updated'] = function (array $ctx) use ($taskLifecycleNotifications) {
            $this->assertTaskLifecycleEnabled();
            $this->sendTaskLifecycleToUser($taskLifecycleNotifications, 'updated', $ctx);
        };
        $handlers['task-lifecycle-due'] = function (array $ctx) use ($taskLifecycleNotifications) {
            $this->assertTaskLifecycleEnabled();
            $this->sendTaskLifecycleToUser($taskLifecycleNotifications, 'due', $ctx);
        };
        $handlers['task-lifecycle-completed'] = function (array $ctx) use ($taskLifecycleNotifications) {
            $this->assertTaskLifecycleEnabled();
            $this->sendTaskLifecycleToUser($taskLifecycleNotifications, 'completed', $ctx);
        };

        foreach (MlmNotificationEvent::cases() as $event) {
            $handlers[$event->value] = function (array $ctx) use ($mlmNotifications, $event) {
                $this->sendMlmSample($mlmNotifications, $event, $ctx);
            };
        }

        return $handlers;
    }

    private function sendMlmSample(MlmNotificationService $mlmNotifications, MlmNotificationEvent $event, array $ctx): void
    {
        $companyId = (int) $ctx['company']->id;
        $user = $ctx['user'];
        $mlmNotifications->notify(
            $event,
            $companyId,
            collect([$user]),
            $this->mlmSampleContext($event, $ctx, $companyId),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function mlmSampleContext(MlmNotificationEvent $event, array $ctx, int $companyId): array
    {
        $commission = MlmCommission::query()->where('company_id', $companyId)->latest('id')->first();
        $agent = LeadAgent::query()->where('company_id', $companyId)->where('user_id', $ctx['user']->id)->first()
            ?? LeadAgent::query()->where('company_id', $companyId)->first();
        $cycle = MlmCycle::query()->where('company_id', $companyId)->latest('id')->first();
        $level = MlmLevel::query()->where('company_id', $companyId)->ordered()->first();

        return match ($event) {
            MlmNotificationEvent::CommissionEarned,
            MlmNotificationEvent::CommissionPaid,
            MlmNotificationEvent::CommissionClawback,
            MlmNotificationEvent::CommissionDisputed => (function () use ($commission, $ctx, $level) {
                $deal = $ctx['deal'] ?? null;
                $deal?->loadMissing('currency');
                $symbol = $deal?->currency?->currency_symbol ?? '$';
                $code = $deal?->currency?->currency_code ?? 'USD';
                $amount = (float) ($commission?->amount ?? 250);

                return [
                    'commission_id' => $commission?->id ?? 0,
                    'amount' => $symbol.number_format($amount, 2),
                    'currency_code' => $code,
                    'currency_symbol' => $symbol,
                    'percentage' => number_format((float) ($commission?->percentage ?? 5), 2),
                    'deal_name' => $deal?->name ?? 'Sample deal',
                    'deal_id' => $deal?->id,
                    'level_name' => $level?->name ?? 'Partner',
                    'reason' => 'Sample adjustment',
                ];
            })(),
            MlmNotificationEvent::AgentLevelUpgraded,
            MlmNotificationEvent::AgentLevelDowngraded,
            MlmNotificationEvent::AgentLevelCriteriaApproaching => [
                'agent_name' => $ctx['user']->name,
                'level_name' => $level?->name ?? 'Senior Partner',
                'previous_level_name' => 'Partner',
                'progress_percent' => 85,
            ],
            MlmNotificationEvent::AgentCommissionProfileChanged => [
                'agent_name' => $ctx['user']->name,
                'previous_rate' => '5.00%',
                'new_rate' => '7.50%',
            ],
            MlmNotificationEvent::CycleStarted,
            MlmNotificationEvent::CycleCompleted,
            MlmNotificationEvent::CycleCriteriaMet,
            MlmNotificationEvent::CycleDeadlineApproaching => [
                'cycle_name' => $cycle?->name ?? 'Cycle #1',
                'cycle_id' => $cycle?->id,
                'start_date' => now()->startOfMonth()->format('Y-m-d'),
                'end_date' => now()->endOfMonth()->format('Y-m-d'),
                'days_remaining' => 5,
                'level_name' => $level?->name,
            ],
            MlmNotificationEvent::ReferralCodeUsed => [
                'lead_name' => $ctx['lead']->client_name ?? 'Sample lead',
                'lead_id' => $ctx['lead']->id ?? null,
            ],
            MlmNotificationEvent::NewRecruitAdded => [
                'recruit_name' => $ctx['user']->name,
                'upline_name' => 'Sample upline',
            ],
            MlmNotificationEvent::PartnerNetworkJoined => [
                'agent_name' => $ctx['user']->name,
            ],
            MlmNotificationEvent::ReferralConvertedToDeal => [
                'lead_name' => $ctx['lead']->client_name ?? 'Sample lead',
                'deal_name' => $ctx['deal']->name ?? 'Sample deal',
                'deal_id' => $ctx['deal']->id ?? null,
            ],
        };
    }

    /**
     * @return Collection<int, User>
     */
    private function onlyUser(User $user): Collection
    {
        return collect([$user]);
    }

    private function assertTaskLifecycleEnabled(): void
    {
        if (! FeatureFlags::enabled('crm.task-lifecycle-notifications')) {
            throw new \RuntimeException('Feature flag crm.task-lifecycle-notifications is disabled.');
        }
    }

    /**
     * Lifecycle service targets assignees; for testing, call underlying notification directly.
     */
    private function sendTaskLifecycleToUser(
        TaskLifecycleNotificationService $service,
        string $variant,
        array $ctx,
    ): void {
        $task = $ctx['task'];
        $user = $ctx['user'];
        $task->loadMissing(['users', 'createBy', 'addedByUser', 'company']);

        $notification = match ($variant) {
            'created' => new \App\Notifications\TaskLifecycleCreatedNotification($task),
            'updated' => new \App\Notifications\TaskLifecycleUpdatedNotification($task),
            'due' => new \App\Notifications\TaskLifecycleDueNotification($task),
            'completed' => new \App\Notifications\TaskLifecycleCompletedNotification($task),
            default => throw new \InvalidArgumentException("Unknown lifecycle variant: {$variant}"),
        };

        \Illuminate\Support\Facades\Notification::send(
            collect([$user]),
            $notification,
        );
    }

    private function sampleDealActivityData(DealActivityType $type): array
    {
        return match ($type) {
            DealActivityType::NOTE_ADDED,
            DealActivityType::NOTE_UPDATED,
            DealActivityType::NOTE_DELETED => ['note_title' => 'Test note', 'note_id' => 0],
            DealActivityType::STAGE_CHANGED => ['from_stage' => 'Qualification', 'to_stage' => 'Proposal'],
            DealActivityType::PIPELINE_CHANGED => ['from_pipeline' => 'Sales', 'to_pipeline' => 'VIP'],
            DealActivityType::TASK_ADDED,
            DealActivityType::TASK_UPDATED,
            DealActivityType::TASK_COMPLETED,
            DealActivityType::TASK_DELETED => ['task_heading' => 'Test task', 'task_id' => 0],
            DealActivityType::MEETING_SCHEDULED,
            DealActivityType::MEETING_UPDATED,
            DealActivityType::MEETING_CANCELLED => [
                'meeting_remark' => 'Discovery call',
                'meeting_date' => now()->addDays(2)->toIso8601String(),
                'follow_up_id' => 0,
            ],
            DealActivityType::FILE_UPLOADED,
            DealActivityType::FILE_UPDATED,
            DealActivityType::FILE_DELETED => ['file_id' => 0, 'field_label' => 'Passport'],
            DealActivityType::PROPERTY_LINKED,
            DealActivityType::PROPERTY_UNLINKED => ['property_title' => 'Test property', 'property_id' => 0],
            DealActivityType::PACKAGE_ASSIGNED,
            DealActivityType::PACKAGE_REMOVED => ['package_names' => ['Test package']],
            DealActivityType::OFFER_APPLIED,
            DealActivityType::OFFER_REMOVED => ['offer_name' => 'Test offer'],
            DealActivityType::AGENT_CHANGED => ['from_agent' => 'Agent A', 'to_agent' => 'Agent B'],
            DealActivityType::AGENT_ASSIGNED => ['agent_name' => 'Test Agent'],
            DealActivityType::WATCHER_ADDED,
            DealActivityType::WATCHER_REMOVED => ['watcher_name' => 'Test Watcher'],
            DealActivityType::DEAL_WON => ['outcome' => 'won'],
            DealActivityType::DEAL_LOST => ['outcome' => 'lost'],
            default => [],
        };
    }

    private function sampleLeadActivityData(LeadActivityType $type): array
    {
        return match ($type) {
            LeadActivityType::NOTE_ADDED,
            LeadActivityType::NOTE_UPDATED,
            LeadActivityType::NOTE_DELETED => ['note_title' => 'Test note', 'note_id' => 0],
            LeadActivityType::FILE_UPLOADED,
            LeadActivityType::FILE_UPDATED,
            LeadActivityType::FILE_DELETED => ['file_id' => 0],
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function samplePropertyActivityData(PropertyActivityType $type, Property $property): array
    {
        return match ($type) {
            PropertyActivityType::STATUS_CHANGED => ['old_status' => 'draft', 'new_status' => $property->status],
            PropertyActivityType::PRICE_CHANGED => ['old_price' => 100000, 'new_price' => $property->price ?? 120000],
            PropertyActivityType::AGENT_ASSIGNED => ['agent_id' => 0, 'agent_name' => 'Test Agent'],
            PropertyActivityType::DOCUMENT_UPLOADED => ['document_name' => 'brochure.pdf'],
            default => [],
        };
    }

    private function clearDedupCacheForType(string $slug, array $context): void
    {
        $company = $context['company'];
        $timezone = $company->timezone ?: 'UTC';
        $today = now($timezone)->toDateString();

        if ($slug === 'task-overdue') {
            Cache::forget("task_overdue_sent:{$context['task']->id}:{$today}");
        }

        if ($slug === 'lead-followup-overdue') {
            Cache::forget("lead_followup_overdue_sent:{$context['followUp']->id}:{$today}");
        }

        if ($slug === 'deal-close-approaching') {
            Cache::forget("deal_close_date_reminder_sent:{$context['deal']->id}:{$today}");
        }
    }
}
