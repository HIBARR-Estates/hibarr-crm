<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadAutomation;
use App\Models\LeadAutomationAction;
use App\Models\LeadAutomationLog;
use App\Models\LeadNote;
use App\Models\ReminderEmailTemplate;
use App\Models\User;
use App\Notifications\LeadAutomationEmailNotification;
use App\Scopes\CompanyScope;
use App\Services\ApiV2\CrmWriteService;
use App\Support\FeatureFlags;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class LeadAutomationService
{
    public function __construct(
        protected LeadFieldResolverService $fieldResolver,
        protected ConditionEvaluatorService $conditionEvaluator,
        protected TaskService $taskService,
        protected CrmWriteService $crmWriteService,
    ) {}

    public function process(Lead $lead, ?string $trigger = null): void
    {
        if (! FeatureFlags::enabled('crm.lead-automation-engine')) {
            return;
        }

        if (! $lead->company_id) {
            Log::info('Skipping Lead automations: Lead has no company_id', ['lead_id' => $lead->id]);

            return;
        }

        Log::info('Processing Lead automations', [
            'lead_id' => $lead->id,
            'trigger' => $trigger,
        ]);

        $automations = $this->getAutomations((int) $lead->company_id, $trigger);

        foreach ($automations as $automation) {
            if ($this->evaluateConditions($lead, $automation)) {
                Log::info('Lead automation matched', [
                    'automation_id' => $automation->id,
                    'name' => $automation->name,
                ]);
                $this->executeActions($lead, $automation);
            }
        }
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, LeadAutomation>
     */
    protected function getAutomations(int $companyId, ?string $trigger)
    {
        return LeadAutomation::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('active', true)
            ->where(function ($query) use ($trigger) {
                $query->where('trigger', $trigger)
                    ->orWhereNull('trigger');
            })
            ->orderByDesc('priority')
            ->with(['conditions', 'actions'])
            ->get();
    }

    protected function evaluateConditions(Lead $lead, LeadAutomation $automation): bool
    {
        if ($automation->conditions->isEmpty()) {
            return true;
        }

        foreach ($automation->conditions as $condition) {
            $fieldValue = $this->fieldResolver->resolve($lead, $condition->field);
            $fieldChanged = $condition->operator === 'changed' ? $this->fieldChanged($lead, $condition->field) : null;

            if (! $this->conditionEvaluator->evaluate($fieldValue, $condition, $fieldChanged)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Same reasoning as DealAutomationService::fieldChanged() — only
     * answerable for a native Lead column, only within the same in-memory
     * instance that was just saved, and false for a brand-new record.
     */
    protected function fieldChanged(Lead $lead, string $field): bool
    {
        if ($lead->wasRecentlyCreated) {
            return false;
        }

        $column = $this->fieldResolver->nativeColumn($lead, $field);

        return $column !== null && (bool) $lead->wasChanged($column);
    }

    protected function executeActions(Lead $lead, LeadAutomation $automation): void
    {
        $actions = $automation->actions->sortBy([
            ['priority', 'desc'],
            ['id', 'asc'],
        ]);

        foreach ($actions as $action) {
            try {
                $this->performAction($lead, $action, $automation);
            } catch (\Throwable $e) {
                Log::error('Lead automation action failed', [
                    'lead_id' => $lead->id,
                    'automation_id' => $automation->id,
                    'action_type' => $action->action_type,
                    'error' => $e->getMessage(),
                ]);
                $this->logAction(
                    $lead,
                    $automation,
                    $action->action_type,
                    'failed',
                    ['error' => $e->getMessage()]
                );
            }
        }
    }

    protected function performAction(Lead $lead, LeadAutomationAction $action, LeadAutomation $automation): void
    {
        match ($action->action_type) {
            'create_task' => $this->performCreateTask($lead, $action, $automation),
            'create_meeting' => $this->performCreateMeeting($lead, $action, $automation),
            'create_note' => $this->performCreateNote($lead, $action, $automation),
            'send_email' => $this->performSendEmail($lead, $action, $automation),
            default => $this->logAction(
                $lead,
                $automation,
                (string) $action->action_type,
                'failed',
                ['error' => 'Unknown action type']
            ),
        };
    }

    protected function performCreateTask(Lead $lead, LeadAutomationAction $action, LeadAutomation $automation): void
    {
        $payload = $action->payload ?? [];
        $heading = isset($payload['heading']) ? trim((string) $payload['heading']) : '';

        if ($heading === '') {
            $this->logAction($lead, $automation, 'create_task', 'failed', [
                'error' => 'Missing required payload field: heading',
            ]);

            return;
        }

        $this->ensureCompanySession($lead);

        $data = [
            'heading' => $heading,
            'description' => $payload['description'] ?? '',
            'priority' => $payload['priority'] ?? 'medium',
            'taskable_type' => 'lead',
            'taskable_id' => $lead->id,
        ];

        if (! empty($payload['due_date'])) {
            $formatted = $this->formatDateForCompany($lead, (string) $payload['due_date']);
            if ($formatted !== null) {
                $data['due_date'] = $formatted;
            } else {
                $data['without_duedate'] = true;
            }
        } else {
            $data['without_duedate'] = true;
        }

        if (! empty($payload['user_id']) || ! empty($payload['user_ids'])) {
            $ids = $payload['user_ids'] ?? [$payload['user_id']];
            $data['user_ids'] = array_values(array_map('intval', (array) $ids));
        } elseif ($lead->lead_owner) {
            $data['user_ids'] = [(int) $lead->lead_owner];
        }

        $actor = $this->resolveSystemActor($lead);
        $task = $this->taskService->createTask($data, $actor);

        $this->logAction($lead, $automation, 'create_task', 'success', [
            'task_id' => $task->id,
        ]);
    }

    protected function performCreateMeeting(Lead $lead, LeadAutomationAction $action, LeadAutomation $automation): void
    {
        $payload = $action->payload ?? [];

        if (empty($payload['scheduled_at'])) {
            $this->logAction($lead, $automation, 'create_meeting', 'failed', [
                'error' => 'Missing required payload field: scheduled_at',
            ]);

            return;
        }

        $data = [
            'lead_id' => $lead->id,
            'scheduled_at' => $payload['scheduled_at'],
            'duration' => $payload['duration'] ?? null,
            'remark' => $payload['remark'] ?? null,
            'meeting_type_id' => $payload['meeting_type_id'] ?? null,
            'location' => $payload['location'] ?? 'office',
            'meeting_link' => $payload['meeting_link'] ?? null,
            'reminders' => $payload['reminders'] ?? [],
            'participants' => $payload['participants'] ?? [],
        ];

        if (! empty($payload['timezone'])) {
            $data['timezone'] = $payload['timezone'];
        }

        $actor = $this->resolveSystemActor($lead);
        if ($actor) {
            $data['created_by_user_id'] = $actor->id;
        }

        $meeting = $this->crmWriteService->createMeeting((int) $lead->company_id, $data);

        $this->logAction($lead, $automation, 'create_meeting', 'success', [
            'follow_up_id' => $meeting->id,
            'lead_id' => $meeting->lead_id,
            'deal_id' => $meeting->deal_id,
        ]);
    }

    protected function performCreateNote(Lead $lead, LeadAutomationAction $action, LeadAutomation $automation): void
    {
        $payload = $action->payload ?? [];
        $title = isset($payload['title']) ? trim((string) $payload['title']) : '';
        $details = $payload['details'] ?? $payload['content'] ?? '';

        if ($title === '') {
            $this->logAction($lead, $automation, 'create_note', 'failed', [
                'error' => 'Missing required payload field: title',
            ]);

            return;
        }

        $actor = $this->resolveSystemActor($lead);

        $note = new LeadNote;
        $note->lead_id = $lead->id;
        $note->title = $title;
        $note->details = trim_editor((string) $details);
        $note->type = 0;
        if ($actor) {
            $note->added_by = $actor->id;
            $note->last_updated_by = $actor->id;
        }
        $note->saveQuietly();

        $this->logAction($lead, $automation, 'create_note', 'success', [
            'note_id' => $note->id,
        ]);
    }

    protected function performSendEmail(Lead $lead, LeadAutomationAction $action, LeadAutomation $automation): void
    {
        $companyId = (int) $lead->company_id;
        $templateId = ReminderEmailTemplate::plunkTemplateId($companyId, 'lead');

        if ($templateId === null) {
            $this->logAction($lead, $automation, 'send_email', 'failed', [
                'error' => 'No ReminderEmailTemplate for company + entity type lead',
            ]);

            return;
        }

        $variables = $this->fieldResolver->resolveAll($lead);
        $recipients = $this->resolveEmailRecipients($lead, $action->payload ?? []);

        if ($recipients === []) {
            $this->logAction($lead, $automation, 'send_email', 'failed', [
                'error' => 'No resolvable recipients',
            ]);

            return;
        }

        $company = Company::withoutGlobalScopes()->find($companyId);
        $dispatched = [];
        $skipped = [];

        foreach ($recipients as $recipient) {
            $email = $recipient['email'] ?? null;
            if (! is_string($email) || trim($email) === '') {
                $skipped[] = $recipient;

                continue;
            }

            $correlationId = (string) Str::uuid();

            try {
                $notification = (new LeadAutomationEmailNotification(
                    $templateId,
                    $variables,
                    $company
                ))->withDeliveryContext([
                    // These notifications are queued, so the delivery result
                    // lands in email_delivery_logs (written by
                    // UnsRoutingTransport) rather than here — the correlation
                    // id is what ties the two together.
                    'source' => 'lead_automation',
                    'correlation_id' => $correlationId,
                    'company_id' => $companyId,
                    'automation_id' => $automation->id,
                    'automation_name' => $automation->name,
                    'lead_id' => $lead->id,
                    'plunk_template_id' => $templateId,
                ]);

                if (isset($recipient['user'])) {
                    $recipient['user']->notify($notification);
                } else {
                    Notification::route('mail', $email)->notify($notification);
                }

                $dispatched[] = [
                    'email' => $email,
                    'role' => $recipient['role'] ?? null,
                    'correlation_id' => $correlationId,
                ];
            } catch (\Throwable $e) {
                $skipped[] = [
                    'email' => $email,
                    'correlation_id' => $correlationId,
                    'error' => $e->getMessage(),
                ];
            }
        }

        $result = $dispatched !== [] ? 'success' : 'failed';
        $this->logAction($lead, $automation, 'send_email', $result, [
            'template_id' => $templateId,
            // Queued at this point, not delivered. The system that actually
            // delivered each one (UNS/Plunk or the PHP SMTP fallback) and its
            // response are in email_delivery_logs, joined on correlation_id.
            'delivery' => 'queued',
            'dispatched' => $dispatched,
            'skipped' => $skipped,
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<array{email: string, role?: string, user?: User}>
     */
    protected function resolveEmailRecipients(Lead $lead, array $payload): array
    {
        $roles = [];
        if (! empty($payload['recipients']) && is_array($payload['recipients'])) {
            $roles = array_map('strval', $payload['recipients']);
        } elseif (! empty($payload['recipient'])) {
            $single = (string) $payload['recipient'];
            if ($single === 'both') {
                $roles = ['client', 'owner'];
            } else {
                $roles = [$single];
            }
        }

        $out = [];
        $seen = [];

        $add = function (string $email, string $role, ?User $user = null) use (&$out, &$seen): void {
            $key = strtolower(trim($email));
            if ($key === '' || isset($seen[$key])) {
                return;
            }
            $seen[$key] = true;
            $entry = ['email' => trim($email), 'role' => $role];
            if ($user) {
                $entry['user'] = $user;
            }
            $out[] = $entry;
        };

        foreach ($roles as $role) {
            if ($role === 'client' && ! empty($lead->client_email)) {
                $add((string) $lead->client_email, 'client');
            }
            if ($role === 'owner' && $lead->lead_owner) {
                $owner = User::withoutGlobalScope(CompanyScope::class)
                    ->where('company_id', $lead->company_id)
                    ->find($lead->lead_owner);
                if ($owner && ! empty($owner->email)) {
                    $add((string) $owner->email, 'owner', $owner);
                }
            }
            if ($role === 'added_by' && $lead->added_by) {
                $user = User::withoutGlobalScope(CompanyScope::class)
                    ->where('company_id', $lead->company_id)
                    ->find($lead->added_by);
                if ($user && ! empty($user->email)) {
                    $add((string) $user->email, 'added_by', $user);
                }
            }
        }

        $userIds = $payload['user_ids'] ?? $payload['participant_user_ids'] ?? [];
        if (is_array($userIds)) {
            $users = User::withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $lead->company_id)
                ->whereIn('id', array_map('intval', $userIds))
                ->get();
            foreach ($users as $user) {
                if (! empty($user->email)) {
                    $add((string) $user->email, 'user', $user);
                }
            }
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>|null  $details
     */
    protected function logAction(
        Lead $lead,
        LeadAutomation $automation,
        string $action,
        string $result,
        ?array $details = null
    ): void {
        LeadAutomationLog::withoutGlobalScopes()->create([
            'company_id' => $lead->company_id,
            'lead_id' => $lead->id,
            'automation_id' => $automation->id,
            'action' => $action,
            'result' => $result,
            'details' => $details,
            'executed_at' => now(),
        ]);
    }

    protected function resolveSystemActor(Lead $lead): ?User
    {
        if (auth()->user() instanceof User) {
            return auth()->user();
        }

        if ($lead->lead_owner) {
            return User::withoutGlobalScope(CompanyScope::class)->find($lead->lead_owner);
        }

        if ($lead->added_by) {
            return User::withoutGlobalScope(CompanyScope::class)->find($lead->added_by);
        }

        return null;
    }

    protected function ensureCompanySession(Lead $lead): void
    {
        if (company()) {
            return;
        }

        $company = Company::withoutGlobalScopes()->find($lead->company_id);
        if ($company) {
            session(['company' => $company]);
        }
    }

    protected function formatDateForCompany(Lead $lead, string $raw): ?string
    {
        try {
            $parsed = Carbon::parse($raw);
        } catch (\Throwable) {
            return null;
        }

        $company = company() ?: Company::withoutGlobalScopes()->find($lead->company_id);
        if (! $company || empty($company->date_format)) {
            return null;
        }

        $timeFormat = $company->time_format ?: 'H:i:s';

        return $parsed->format($company->date_format.' '.$timeFormat);
    }
}
