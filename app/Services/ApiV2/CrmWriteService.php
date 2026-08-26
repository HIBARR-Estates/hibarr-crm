<?php

namespace App\Services\ApiV2;

use App\Enums\IntegrationOrigin;
use App\Events\AutoFollowUpReminderEvent;
use App\Helper\Files;
use App\Models\Currency;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\DealNote;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadNote;
use App\Models\Payment;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Models\User;
use App\Scopes\ActiveScope;
use App\Scopes\CompanyScope;
use App\Services\CalendarSyncDispatcher;
use App\Services\DealActivityEventService;
use App\Services\DealNotificationService;
use App\Services\Reminders\MeetingReminderSync;
use App\Services\Reminders\NoteReminderSync;
use App\Services\Reminders\TaskReminderSync;
use App\Traits\RecordsCrmEvents;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class CrmWriteService
{
    use RecordsCrmEvents;

    private const TASK_SUMMARY_RELATIONS = [
        'users',
        'leads:id,client_name,client_email,mobile',
        'deals:id,name,value,pipeline_stage_id,lead_pipeline_id',
        'deals.leadStage:id,name',
        'deals.pipeline:id,name',
    ];

    private const MEETING_SUMMARY_RELATIONS = ['deal.leadStage', 'deal.pipeline', 'lead', 'meetingType'];

    private const DEAL_NOTE_SUMMARY_RELATIONS = ['deal.leadStage', 'deal.pipeline'];

    /**
     * @param  array<string, mixed>  $data
     */
    public function createTask(int $companyId, array $data): Task
    {
        $lead = $this->resolveLead($companyId, $data);
        $deal = $this->resolveDeal($companyId, $data, $lead);

        if ($deal !== null && ($deal->next_follow_up ?? 'yes') === 'no') {
            throw ValidationException::withMessages([
                'deal_id' => [__('messages.leadFollowUpRestricted')],
            ]);
        }

        $createdByUserId = $this->resolveCreatedByUserId($data, $deal, $lead);
        $boardColumn = $this->resolveDefaultTaskBoardColumn($companyId);

        return DB::transaction(function () use ($companyId, $data, $lead, $deal, $createdByUserId, $boardColumn) {
            $task = new Task;
            $task->company_id = $companyId;
            $task->heading = $data['heading'];
            $task->description = isset($data['description']) ? trim_editor($data['description']) : '';
            $task->priority = $data['priority'] ?? 'medium';
            $task->board_column_id = $boardColumn->id;
            $task->status = $boardColumn->slug === 'completed' ? 'completed' : 'incomplete';
            $task->is_private = 0;
            $task->billable = 0;
            $task->due_date = !empty($data['due_date']) ? Carbon::parse($data['due_date']) : null;
            $task->start_date = !empty($data['start_date']) ? Carbon::parse($data['start_date']) : null;
            if (array_key_exists('reminders', $data)) {
                $task->reminders = $data['reminders'];
            }
            if (array_key_exists('remind_at', $data)) {
                $task->remind_at = ! empty($data['remind_at']) ? Carbon::parse($data['remind_at']) : null;
            }
            if (array_key_exists('integration_origin', $data)) {
                $task->integration_origin = $data['integration_origin'];
            }

            if ($createdByUserId !== null) {
                $task->added_by = $createdByUserId;
                $task->created_by = $createdByUserId;
            }

            $task->save();

            if ($lead !== null) {
                $lead->tasks()->syncWithoutDetaching([$task->id]);
                $this->recordCrmEvent('lead_updated', $lead, [
                    'metadata' => [
                        'action' => 'task_added',
                        'task_id' => $task->id,
                        'task_heading' => $task->heading,
                        'comment' => 'Task added: '.$task->heading,
                    ],
                ]);
            }

            $notifyDeal = null;

            if ($deal !== null) {
                $deal->tasks()->syncWithoutDetaching([$task->id]);
                app(DealActivityEventService::class)->recordTaskCreated($deal, $task);

                $assigneeIds = $this->normalizeAssigneeIds($data, $deal);
                if ($assigneeIds !== []) {
                    $task->users()->syncWithoutDetaching($assigneeIds);
                } elseif ($deal->agent_id) {
                    $agentUserId = LeadAgent::withoutGlobalScope(CompanyScope::class)
                        ->where('id', $deal->agent_id)
                        ->value('user_id');

                    if ($agentUserId) {
                        $task->users()->syncWithoutDetaching([(int) $agentUserId]);
                    }
                }

                $notifyDeal = $deal;
            } elseif (! empty($data['assignee_user_ids'])) {
                $task->users()->syncWithoutDetaching(
                    array_values(array_unique(array_map('intval', $data['assignee_user_ids'])))
                );
            }

            if ($notifyDeal !== null) {
                $savedTask = $task;
                DB::afterCommit(function () use ($notifyDeal, $savedTask) {
                    app(DealNotificationService::class)->notifyTaskAdded(
                        $notifyDeal,
                        $savedTask->heading,
                        $savedTask->id
                    );
                });
            }

            $fresh = $task->fresh(self::TASK_SUMMARY_RELATIONS);
            app(TaskReminderSync::class)->syncFromTask($fresh);

            return $fresh;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{note: DealNote|LeadNote, type: 'deal'|'lead'}
     */
    public function createNote(int $companyId, array $data): array
    {
        $lead = $this->resolveLead($companyId, $data);
        $deal = $this->resolveDeal($companyId, $data, $lead);
        $createdByUserId = $this->resolveCreatedByUserId($data, $deal, $lead);

        if ($deal !== null) {
            $note = new DealNote;
            $note->deal_id = $deal->id;
            $note->title = $data['title'];
            $note->details = trim_editor($data['details']);

            if ($createdByUserId !== null) {
                $note->added_by = $createdByUserId;
                $note->last_updated_by = $createdByUserId;
            }

            if (array_key_exists('remind_at', $data)) {
                $note->remind_at = ! empty($data['remind_at']) ? Carbon::parse($data['remind_at']) : null;
            }
            if (array_key_exists('reminders', $data)) {
                $note->reminders = $data['reminders'];
            }
            if (array_key_exists('integration_origin', $data)) {
                $note->integration_origin = $data['integration_origin'];
            }

            $note->save();
            $note->setRelation('deal', $deal);

            app(DealActivityEventService::class)->recordNoteAdded($deal, $note);
            app(NoteReminderSync::class)->syncFromDealNote($note);

            return ['note' => $note, 'type' => 'deal'];
        }

        if ($lead === null) {
            throw ValidationException::withMessages([
                'lead_id' => ['Unable to resolve a lead for note creation.'],
            ]);
        }

        $note = new LeadNote;
        $note->lead_id = $lead->id;
        $note->title = $data['title'];
        $note->details = trim_editor($data['details']);
        $note->type = 0;

        if ($createdByUserId !== null) {
            $note->added_by = $createdByUserId;
            $note->last_updated_by = $createdByUserId;
        }

        if (array_key_exists('remind_at', $data)) {
            $note->remind_at = ! empty($data['remind_at']) ? Carbon::parse($data['remind_at']) : null;
        }
        if (array_key_exists('reminders', $data)) {
            $note->reminders = $data['reminders'];
        }
        if (array_key_exists('integration_origin', $data)) {
            $note->integration_origin = $data['integration_origin'];
        }

        $note->save();
        $note->setRelation('lead', $lead);

        $this->recordCrmEvent('lead_updated', $lead, [
            'metadata' => [
                'action' => 'note_added',
                'note_id' => $note->id,
                'note_title' => $note->title,
                'comment' => 'Note added: '.($note->title ?? 'Untitled'),
            ],
        ]);

        app(NoteReminderSync::class)->syncFromLeadNote($note);

        return ['note' => $note, 'type' => 'lead'];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createMeeting(int $companyId, array $data): DealFollowUp
    {
        $lead = $this->resolveLead($companyId, $data);
        $deal = $this->resolveDeal($companyId, $data, $lead);

        if ($lead !== null && ($lead->next_follow_up ?? 'yes') === 'no') {
            throw ValidationException::withMessages([
                'lead_id' => [__('messages.leadFollowUpRestricted')],
            ]);
        }

        if ($deal !== null && ($deal->next_follow_up ?? 'yes') === 'no') {
            throw ValidationException::withMessages([
                'deal_id' => [__('messages.leadFollowUpRestricted')],
            ]);
        }

        if ($deal === null && $lead === null) {
            throw ValidationException::withMessages([
                'lead_id' => ['At least one of lead_id or deal_id is required.'],
            ]);
        }

        if ($deal !== null && $lead === null && $deal->lead_id) {
            $lead = Lead::withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $companyId)
                ->find($deal->lead_id);
        }

        $createdByUserId = $this->resolveCreatedByUserId($data, $deal, $lead);
        $timezone = $data['timezone'] ?? $this->resolveCompanyTimezone($companyId);
        $scheduledAt = Carbon::parse($data['scheduled_at'], $timezone)->setTimezone('UTC');

        $defaultReminders = DealFollowUp::DEFAULT_REMINDERS;
        $customReminders = $data['reminders'] ?? [];
        $firstCustomReminder = count($customReminders) > 0 ? $customReminders[0] : $defaultReminders[0];

        $followUp = new DealFollowUp;
        $followUp->lead_id = $lead?->id;
        $followUp->deal_id = $deal?->id;
        $followUp->meeting_type_id = $data['meeting_type_id'] ?? null;
        $followUp->location = $data['location'] ?? 'office';
        $followUp->meeting_link = $data['meeting_link'] ?? null;
        $followUp->next_follow_up_date = $scheduledAt;
        $followUp->remark = $data['remark'] ?? null;
        $followUp->duration = isset($data['duration']) ? (int) $data['duration'] : null;
        $followUp->send_reminder = 'yes';
        $followUp->remind_time = $firstCustomReminder['time'];
        $followUp->remind_type = $firstCustomReminder['type'];
        $followUp->setCustomReminders($customReminders);
        $followUp->status = 'scheduled';

        $participants = is_array($data['participants'] ?? null) ? $data['participants'] : [];
        if ($createdByUserId !== null) {
            $participants = $this->ensureCreatorIsParticipant($participants, $createdByUserId);
        }
        $followUp->participants = $participants;

        if ($createdByUserId !== null) {
            $followUp->added_by = $createdByUserId;
            $followUp->last_updated_by = $createdByUserId;
        }

        $followUp->save();

        $freshFollowUp = $followUp->fresh();

        try {
            event(new AutoFollowUpReminderEvent($freshFollowUp, true));
        } catch (\Throwable $exception) {
            report($exception);
        }

        app(MeetingReminderSync::class)->syncFromFollowUp($followUp);

        if ($freshFollowUp) {
            app(CalendarSyncDispatcher::class)->scheduleSync($freshFollowUp);
        }

        return $followUp->fresh(self::MEETING_SUMMARY_RELATIONS);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{payment: Payment, created: bool}
     */
    public function upsertPayment(int $companyId, array $data, ?UploadedFile $billFile = null): array
    {
        $deal = $this->resolveDeal($companyId, $data, null);
        if ($deal === null) {
            throw (new ModelNotFoundException())->setModel(Deal::class);
        }

        $currencyId = (int) ($data['currency_id'] ?? 0);
        if ($currencyId <= 0) {
            $currency = $this->resolveCurrency($companyId, (string) ($data['currency'] ?? ''));
            $currencyId = $currency->id;
        }

        $externalReference = (string) $data['external_reference'];
        $incomingStatus = strtolower(trim((string) ($data['status'] ?? '')));
        $status = match ($incomingStatus) {
            'approved' => 'complete',
            'rejected' => 'failed',
            'proof_submitted', 'proof-submitted' => 'pending',
            default => (string) $data['status'],
        };
        $rawStatus = strtolower(trim((string) ($data['raw_status'] ?? $data['ol_status'] ?? '')));

        $existing = Payment::withoutGlobalScope(CompanyScope::class)
            ->without(['order'])
            ->where('company_id', $companyId)
            ->where('external_reference', $externalReference)
            ->first();

        $created = $existing === null;
        $payment = $existing ?? new Payment();

        $payment->company_id = $companyId;
        $payment->deal_id = $deal->id;
        $payment->external_reference = $externalReference;
        $payment->amount = round((float) $data['amount'], 2);
        $payment->currency_id = $currencyId;
        $payment->gateway = (string) $data['gateway'];
        $payment->status = $status;

        if (!empty($data['checkout_url'])) {
            $payment->checkout_url = (string) $data['checkout_url'];
        }

        if (!empty($data['expires_at'])) {
            $payment->expires_at = Carbon::parse($data['expires_at']);
        }

        $olStatus = $rawStatus !== '' ? $rawStatus : $this->inferOlStatusFromWriteBack($status, $data);
        if ($olStatus !== null) {
            $payment->ol_status = $olStatus;
        }

        $olPaymentType = $this->inferOlPaymentTypeFromWriteBack($data);
        if ($olPaymentType !== null) {
            $payment->ol_payment_type = $olPaymentType;
        }

        if (array_key_exists('verified_by_user_id', $data) && $data['verified_by_user_id'] !== null) {
            $payment->verified_by_user_id = (int) $data['verified_by_user_id'];
        }

        if (!empty($data['verified_at'])) {
            $payment->verified_at = Carbon::parse($data['verified_at']);
        }

        if (array_key_exists('transaction_id', $data)) {
            $payment->transaction_id = $data['transaction_id'] !== null && $data['transaction_id'] !== ''
                ? (string) $data['transaction_id']
                : null;
        }

        if (!empty($data['paid_on'])) {
            $payment->paid_on = Carbon::parse($data['paid_on']);
        } elseif ($status === 'complete' && ($created || $payment->paid_on === null)) {
            $payment->paid_on = Carbon::now();
        }

        $shouldStoreProof = $billFile !== null || !empty($data['proof_url']);
        $previousBill = $payment->bill;

        if ($shouldStoreProof) {
            $payment->bill = $this->storePaymentProof($billFile, $data['proof_url'] ?? null);
        }

        $payment->save();

        if ($shouldStoreProof && $previousBill && $previousBill !== $payment->bill) {
            try {
                Files::deleteFile($previousBill, Payment::FILE_PATH);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        $payment->loadMissing(['currency', 'deal.leadStage', 'deal.pipeline']);

        return ['payment' => $payment, 'created' => $created];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{items: Collection<int, array<string, mixed>>, paginator: LengthAwarePaginator}
     */
    public function listPayments(int $companyId, array $filters): array
    {
        $query = Payment::withoutGlobalScope(CompanyScope::class)
            ->without(['order'])
            ->with(['currency', 'deal.leadStage', 'deal.pipeline'])
            ->where('company_id', $companyId);

        if (!empty($filters['deal_id'])) {
            $query->where('deal_id', (int) $filters['deal_id']);
        }

        return $this->paginateQuery(
            $query->orderByDesc('id'),
            $filters,
            fn (Payment $payment) => $this->serializePayment($payment)
        );
    }

    public function getPayment(int $companyId, int $paymentId): Payment
    {
        return Payment::withoutGlobalScope(CompanyScope::class)
            ->without(['order'])
            ->with(['currency', 'deal.leadStage', 'deal.pipeline'])
            ->where('company_id', $companyId)
            ->findOrFail($paymentId);
    }

    public function serializePayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'deal_id' => $payment->deal_id,
            'deal' => $this->serializeDealSummary($payment->deal),
            'amount' => $payment->amount,
            'currency' => $payment->currency?->currency_code,
            'currency_id' => $payment->currency_id,
            'status' => $payment->status,
            'gateway' => $payment->gateway,
            'external_reference' => $payment->external_reference,
            'transaction_id' => $payment->transaction_id,
            'paid_on' => $payment->paid_on?->toIso8601String(),
            'bill' => $payment->bill,
            'file_url' => $payment->bill ? $payment->file_url : null,
            'created_at' => $payment->created_at?->toIso8601String(),
            'updated_at' => $payment->updated_at?->toIso8601String(),
        ];
    }

    private function resolveCurrency(int $companyId, string $currencyCode): Currency
    {
        $currency = Currency::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->where('currency_code', strtoupper(trim($currencyCode)))
            ->first();

        if ($currency === null) {
            throw ValidationException::withMessages([
                'currency' => ['The selected currency is invalid for this company.'],
            ]);
        }

        return $currency;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function inferOlStatusFromWriteBack(string $crmStatus, array $data): ?string
    {
        $original = strtolower(trim((string) ($data['status'] ?? '')));
        if (in_array($original, ['proof_submitted', 'proof-submitted'], true)) {
            return 'confirming';
        }

        if ($crmStatus === 'pending' && (!empty($data['proof_url']) || !empty($data['bill']))) {
            return 'confirming';
        }

        return match ($crmStatus) {
            'pending' => 'pending',
            'complete' => 'completed',
            'failed' => 'failed',
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function inferOlPaymentTypeFromWriteBack(array $data): ?string
    {
        if (!empty($data['ol_payment_type'])) {
            return strtolower((string) $data['ol_payment_type']);
        }

        if (!empty($data['payment_type'])) {
            return strtolower((string) $data['payment_type']);
        }

        $gateway = strtolower(trim((string) ($data['gateway'] ?? '')));

        return match ($gateway) {
            'manual-bank-transfer' => 'manual',
            'nowpayments' => 'crypto',
            default => null,
        };
    }

    private function storePaymentProof(?UploadedFile $billFile, ?string $proofUrl): string
    {
        if ($billFile !== null) {
            return Files::uploadLocalOrS3($billFile, Payment::FILE_PATH);
        }

        if ($proofUrl === null || $proofUrl === '') {
            throw ValidationException::withMessages([
                'proof_url' => ['A proof file or proof_url is required when storing payment proof.'],
            ]);
        }

        try {
            $response = Http::timeout(30)->get($proofUrl);
        } catch (\Throwable $exception) {
            throw ValidationException::withMessages([
                'proof_url' => ['Unable to download proof file from the provided URL.'],
            ]);
        }

        if (!$response->successful()) {
            throw ValidationException::withMessages([
                'proof_url' => ['Unable to download proof file from the provided URL.'],
            ]);
        }

        $path = parse_url($proofUrl, PHP_URL_PATH);
        $basename = is_string($path) && $path !== '' ? basename($path) : 'proof.bin';
        if ($basename === '' || $basename === '/' || !str_contains($basename, '.')) {
            $basename = 'proof.pdf';
        }

        $tempPath = tempnam(sys_get_temp_dir(), 'crm-pay-');
        if ($tempPath === false) {
            throw ValidationException::withMessages([
                'proof_url' => ['Unable to store proof file temporarily.'],
            ]);
        }

        file_put_contents($tempPath, $response->body());

        $uploaded = new UploadedFile(
            $tempPath,
            $basename,
            $response->header('Content-Type') ?: null,
            null,
            true
        );

        try {
            return Files::uploadLocalOrS3($uploaded, Payment::FILE_PATH);
        } finally {
            @unlink($tempPath);
        }
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{items: Collection<int, array<string, mixed>>, paginator: LengthAwarePaginator}
     */
    public function listTasks(int $companyId, array $filters): array
    {
        $query = Task::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->with(self::TASK_SUMMARY_RELATIONS);

        $this->applyTaskTargetFilters($query, $filters);
        $this->applyTaskListFilters($query, $filters);

        return $this->paginateQuery($query->orderByDesc('id'), $filters, fn (Task $task) => $this->serializeTask($task));
    }

    public function getTask(int $companyId, int $taskId): Task
    {
        return Task::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->with(self::TASK_SUMMARY_RELATIONS)
            ->findOrFail($taskId);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateTask(int $companyId, int $taskId, array $data): Task
    {
        $task = $this->getTask($companyId, $taskId);

        if (array_key_exists('heading', $data)) {
            $task->heading = $data['heading'];
        }

        if (array_key_exists('description', $data)) {
            $task->description = trim_editor($data['description'] ?? '');
        }

        if (array_key_exists('priority', $data)) {
            $task->priority = $data['priority'];
        }

        if (array_key_exists('due_date', $data)) {
            $task->due_date = ! empty($data['due_date']) ? Carbon::parse($data['due_date']) : null;
        }

        if (array_key_exists('start_date', $data)) {
            $task->start_date = ! empty($data['start_date']) ? Carbon::parse($data['start_date']) : null;
        }

        if (array_key_exists('reminders', $data)) {
            $task->reminders = $data['reminders'];
        }

        if (array_key_exists('remind_at', $data)) {
            $task->remind_at = ! empty($data['remind_at']) ? Carbon::parse($data['remind_at']) : null;
        }

        if (array_key_exists('integration_origin', $data)) {
            $task->integration_origin = $data['integration_origin'];
        }

        if (!empty($data['updated_by_user_id'])) {
            $task->last_updated_by = (int) $data['updated_by_user_id'];
        }

        $task->save();

        if (array_key_exists('assignee_user_ids', $data)) {
            $assigneeIds = array_values(array_unique(array_map('intval', $data['assignee_user_ids'] ?? [])));
            $task->users()->sync($assigneeIds);
        }

        $fresh = $task->fresh([
                'users',
                'leads:id,client_name,client_email,mobile',
                'deals:id,name,value,pipeline_stage_id,lead_pipeline_id',
                'deals.leadStage:id,name',
                'deals.pipeline:id,name',
            ]);
        app(TaskReminderSync::class)->syncFromTask($fresh);

        return $fresh;
    }

    public function deleteTask(int $companyId, int $taskId): void
    {
        $task = $this->getTask($companyId, $taskId);
        app(TaskReminderSync::class)->cancelForTask($task);
        $task->delete();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{items: Collection<int, array<string, mixed>>, paginator: LengthAwarePaginator}
     */
    public function listNotes(int $companyId, array $filters): array
    {
        $queryDeal = $this->shouldQueryDealNotes($filters);
        $queryLead = $this->shouldQueryLeadNotes($filters);

        if ($queryDeal && ! $queryLead) {
            $dealNotesQuery = DealNote::query()
                ->with(self::DEAL_NOTE_SUMMARY_RELATIONS)
                ->whereIn('deal_id', $this->companyDealIdsQuery($companyId));

            if (! empty($filters['deal_id'])) {
                $dealNotesQuery->where('deal_id', (int) $filters['deal_id']);
            }

            $this->applyNoteListFilters($dealNotesQuery, $filters);

            return $this->paginateQuery(
                $dealNotesQuery->orderByDesc('id'),
                $filters,
                fn (DealNote $note) => $this->serializeNote($note, 'deal')
            );
        }

        if ($queryLead && ! $queryDeal) {
            $leadNotesQuery = LeadNote::query()
                ->with('lead')
                ->whereIn('lead_id', $this->companyLeadIdsQuery($companyId));

            if (! empty($filters['lead_id'])) {
                $leadNotesQuery->where('lead_id', (int) $filters['lead_id']);
            }

            $this->applyNoteListFilters($leadNotesQuery, $filters);

            return $this->paginateQuery(
                $leadNotesQuery->orderByDesc('id'),
                $filters,
                fn (LeadNote $note) => $this->serializeNote($note, 'lead')
            );
        }

        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
        $fetchLimit = $page * $perPage;
        $notes = collect();

        if ($queryDeal) {
            $dealNotesQuery = DealNote::query()
                ->with(self::DEAL_NOTE_SUMMARY_RELATIONS)
                ->whereIn('deal_id', $this->companyDealIdsQuery($companyId));

            if (! empty($filters['deal_id'])) {
                $dealNotesQuery->where('deal_id', (int) $filters['deal_id']);
            }

            $this->applyNoteListFilters($dealNotesQuery, $filters);

            foreach ($dealNotesQuery->orderByDesc('id')->limit($fetchLimit)->get() as $note) {
                $notes->push($this->serializeNote($note, 'deal'));
            }
        }

        if ($queryLead) {
            $leadNotesQuery = LeadNote::query()
                ->with('lead')
                ->whereIn('lead_id', $this->companyLeadIdsQuery($companyId));

            if (! empty($filters['lead_id'])) {
                $leadNotesQuery->where('lead_id', (int) $filters['lead_id']);
            }

            $this->applyNoteListFilters($leadNotesQuery, $filters);

            foreach ($leadNotesQuery->orderByDesc('id')->limit($fetchLimit)->get() as $note) {
                $notes->push($this->serializeNote($note, 'lead'));
            }
        }

        $notes = $notes->sortByDesc('id')->values();

        return $this->paginateCollection($notes, $filters);
    }

    /**
     * @return array{note: DealNote|LeadNote, type: 'deal'|'lead'}
     */
    public function getNote(int $companyId, int $noteId, string $type): array
    {
        return $this->findNote($companyId, $noteId, $type);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{note: DealNote|LeadNote, type: 'deal'|'lead'}
     */
    public function updateNote(int $companyId, int $noteId, array $data): array
    {
        $result = $this->findNote($companyId, $noteId, $data['type']);
        $note = $result['note'];

        if (array_key_exists('title', $data)) {
            $note->title = $data['title'];
        }

        if (array_key_exists('details', $data)) {
            $note->details = trim_editor($data['details']);
        }

        if (! empty($data['updated_by_user_id'])) {
            $note->last_updated_by = (int) $data['updated_by_user_id'];
        }

        if (array_key_exists('remind_at', $data)) {
            $note->remind_at = ! empty($data['remind_at']) ? Carbon::parse($data['remind_at']) : null;
        }
        if (array_key_exists('reminders', $data)) {
            $note->reminders = $data['reminders'];
        }
        if (array_key_exists('integration_origin', $data)) {
            $note->integration_origin = $data['integration_origin'];
        }

        $note->save();

        $relations = $result['type'] === 'deal' ? self::DEAL_NOTE_SUMMARY_RELATIONS : ['lead'];
        $fresh = $note->fresh($relations);

        if ($result['type'] === 'deal') {
            app(NoteReminderSync::class)->syncFromDealNote($fresh);
        } else {
            app(NoteReminderSync::class)->syncFromLeadNote($fresh);
        }

        return ['note' => $fresh, 'type' => $result['type']];
    }

    public function deleteNote(int $companyId, int $noteId, string $type): void
    {
        $result = $this->findNote($companyId, $noteId, $type);
        if ($result['type'] === 'deal') {
            app(NoteReminderSync::class)->cancelForDealNote($result['note']);
        } else {
            app(NoteReminderSync::class)->cancelForLeadNote($result['note']);
        }
        $result['note']->delete();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{items: Collection<int, array<string, mixed>>, paginator: LengthAwarePaginator}
     */
    public function listMeetings(int $companyId, array $filters): array
    {
        $dealIds = $this->companyDealIdsQuery($companyId);
        $leadIds = $this->companyLeadIdsQuery($companyId);

        $query = DealFollowUp::query()
            ->with(self::MEETING_SUMMARY_RELATIONS)
            ->where(function ($q) use ($dealIds, $leadIds) {
                $q->whereIn('deal_id', $dealIds)
                    ->orWhereIn('lead_id', $leadIds);
            });

        if (! empty($filters['deal_id'])) {
            $query->where('deal_id', (int) $filters['deal_id']);
        }

        if (! empty($filters['lead_id'])) {
            $query->where('lead_id', (int) $filters['lead_id']);
        }

        $this->applyMeetingListFilters($query, $filters, $companyId);

        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
        $paginator = $query->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);

        $participantUserMap = $this->fetchParticipantUserMap($paginator->items());

        $items = collect($paginator->items())
            ->map(fn (DealFollowUp $meeting) => $this->serializeMeeting($meeting, $participantUserMap))
            ->values();

        return ['items' => $items, 'paginator' => $paginator];
    }

    public function getMeeting(int $companyId, int $meetingId): DealFollowUp
    {
        return $this->findMeeting($companyId, $meetingId);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateMeeting(int $companyId, int $meetingId, array $data): DealFollowUp
    {
        $followUp = $this->findMeeting($companyId, $meetingId);

        if (array_key_exists('scheduled_at', $data)) {
            $timezone = $data['timezone'] ?? $this->resolveCompanyTimezone($companyId);
            $followUp->next_follow_up_date = Carbon::parse($data['scheduled_at'], $timezone)->setTimezone('UTC');
        }

        if (array_key_exists('remark', $data)) {
            $followUp->remark = $data['remark'];
        }

        if (array_key_exists('meeting_type_id', $data)) {
            $followUp->meeting_type_id = $data['meeting_type_id'];
        }

        if (array_key_exists('location', $data)) {
            $followUp->location = $data['location'];
        }

        if (array_key_exists('meeting_link', $data)) {
            $followUp->meeting_link = $data['meeting_link'];
        }

        if (array_key_exists('duration', $data)) {
            $followUp->duration = $data['duration'] !== null ? (int) $data['duration'] : null;
        }

        if (array_key_exists('status', $data)) {
            $followUp->status = $data['status'];
        }

        if (array_key_exists('reminders', $data)) {
            $customReminders = $data['reminders'] ?? [];
            $firstCustomReminder = count($customReminders) > 0
                ? $customReminders[0]
                : DealFollowUp::DEFAULT_REMINDERS[0];
            $followUp->remind_time = $firstCustomReminder['time'];
            $followUp->remind_type = $firstCustomReminder['type'];
            $followUp->setCustomReminders($customReminders);
        }

        if (array_key_exists('participants', $data)) {
            $participants = is_array($data['participants']) ? $data['participants'] : [];
            $creatorId = ! empty($data['updated_by_user_id'])
                ? (int) $data['updated_by_user_id']
                : (int) ($followUp->added_by ?? 0);

            if ($creatorId > 0) {
                $participants = $this->ensureCreatorIsParticipant($participants, $creatorId);
            }

            $followUp->participants = $participants;
        }

        if (! empty($data['updated_by_user_id'])) {
            $followUp->last_updated_by = (int) $data['updated_by_user_id'];
        }

        $followUp->save();

        app(MeetingReminderSync::class)->syncFromFollowUp($followUp);

        return $followUp->fresh(self::MEETING_SUMMARY_RELATIONS);
    }

    public function deleteMeeting(int $companyId, int $meetingId): void
    {
        $followUp = $this->findMeeting($companyId, $meetingId);
        app(MeetingReminderSync::class)->cancelForFollowUp($followUp);
        $followUp->delete();
    }

    /**
     * @return array{note: DealNote|LeadNote, type: 'deal'|'lead'}
     */
    private function findNote(int $companyId, int $noteId, string $type): array
    {
        if ($type === 'deal') {
            $note = DealNote::query()
                ->with(self::DEAL_NOTE_SUMMARY_RELATIONS)
                ->where('id', $noteId)
                ->whereIn('deal_id', $this->companyDealIdsQuery($companyId))
                ->first();

            if ($note !== null) {
                return ['note' => $note, 'type' => 'deal'];
            }
        }

        if ($type === 'lead') {
            $note = LeadNote::query()
                ->with('lead')
                ->where('id', $noteId)
                ->whereIn('lead_id', $this->companyLeadIdsQuery($companyId))
                ->first();

            if ($note !== null) {
                return ['note' => $note, 'type' => 'lead'];
            }
        }

        throw (new ModelNotFoundException)->setModel($type === 'deal' ? DealNote::class : LeadNote::class, [$noteId]);
    }

    private function findMeeting(int $companyId, int $meetingId): DealFollowUp
    {
        $dealIds = $this->companyDealIdsQuery($companyId);
        $leadIds = $this->companyLeadIdsQuery($companyId);

        return DealFollowUp::query()
            ->with(self::MEETING_SUMMARY_RELATIONS)
            ->where('id', $meetingId)
            ->where(function ($q) use ($dealIds, $leadIds) {
                $q->whereIn('deal_id', $dealIds)
                    ->orWhereIn('lead_id', $leadIds);
            })
            ->firstOrFail();
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @param  array<string, mixed>  $filters
     * @param  callable(mixed): array<string, mixed>  $serializer
     * @return array{items: Collection<int, array<string, mixed>>, paginator: LengthAwarePaginator}
     */
    private function paginateQuery($query, array $filters, callable $serializer): array
    {
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $items = collect($paginator->items())->map($serializer)->values();

        return ['items' => $items, 'paginator' => $paginator];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $collection
     * @param  array<string, mixed>  $filters
     * @return array{items: Collection<int, array<string, mixed>>, paginator: LengthAwarePaginator}
     */
    private function paginateCollection(Collection $collection, array $filters): array
    {
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
        $total = $collection->count();
        $items = $collection->slice(($page - 1) * $perPage, $perPage)->values();

        $paginator = new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $page,
            ['path' => request()?->url(), 'query' => request()?->query() ?? []]
        );

        return ['items' => $items, 'paginator' => $paginator];
    }

    /**
     * @param  Builder<Task>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyTaskTargetFilters($query, array $filters): void
    {
        if (! empty($filters['lead_id'])) {
            $query->whereHas('leads', fn ($q) => $q->where('leads.id', (int) $filters['lead_id']));
        }

        if (! empty($filters['deal_id'])) {
            $query->whereHas('deals', fn ($q) => $q->where('deals.id', (int) $filters['deal_id']));
        }
    }

    /**
     * @param  Builder<Task>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyTaskListFilters(Builder $query, array $filters): void
    {
        $this->applySearchFilter($query, $filters, ['heading', 'description']);
        $this->applyCreatedByFilter($query, $filters, ['added_by', 'created_by']);
        $this->applyOwnedByFilter($query, $filters, function (Builder $q, int $userId) {
            $q->whereHas('users', fn (Builder $users) => $users->where('users.id', $userId));
        });
        $this->applyTimeRangeFilter($query, $filters, 'created_at');
    }

    /**
     * @param  Builder<DealNote>|Builder<LeadNote>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyNoteListFilters(Builder $query, array $filters): void
    {
        $this->applySearchFilter($query, $filters, ['title', 'details']);
        $this->applyCreatedByFilter($query, $filters, ['added_by']);
        // Notes have no separate assignee — owned_by also matches the author.
        $this->applyOwnedByFilter($query, $filters, function (Builder $q, int $userId) {
            $q->where('added_by', $userId);
        });
        $this->applyTimeRangeFilter($query, $filters, 'created_at');
    }

    /**
     * @param  Builder<DealFollowUp>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyMeetingListFilters(Builder $query, array $filters, int $companyId): void
    {
        $this->applyMeetingSearchFilter($query, $filters, $companyId);
        $this->applyCreatedByFilter($query, $filters, ['added_by']);
        $this->applyOwnedByFilter($query, $filters, function (Builder $q, int $userId) {
            $q->where(function (Builder $owned) use ($userId) {
                $owned->whereJsonContains('participants', $userId)
                    ->orWhereJsonContains('participants', (string) $userId);
            });
        });
        // Meeting "time" is the scheduled slot, not created_at.
        $this->applyTimeRangeFilter($query, $filters, 'next_follow_up_date');
    }

    /**
     * Search meetings across remark, location, link, duration, type, deal/lead names, and participant names.
     *
     * @param  Builder<DealFollowUp>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyMeetingSearchFilter(Builder $query, array $filters, int $companyId): void
    {
        $search = trim((string) ($filters['search'] ?? ''));
        if ($search === '') {
            return;
        }

        $like = $this->searchLikePattern($search);

        $query->where(function (Builder $q) use ($like, $search, $companyId) {
            $q->where('remark', 'like', $like)
                ->orWhere('location', 'like', $like)
                ->orWhere('meeting_link', 'like', $like)
                ->orWhereRaw('CAST(COALESCE(duration, ?) AS CHAR) LIKE ?', [
                    DealFollowUp::DEFAULT_DURATION_MINUTES,
                    $like,
                ])
                ->orWhereHas('meetingType', fn (Builder $type) => $type->where('name', 'like', $like))
                ->orWhereHas('deal', fn (Builder $deal) => $deal->where('name', 'like', $like))
                ->orWhereHas('lead', fn (Builder $lead) => $lead->where('client_name', 'like', $like));

            if (ctype_digit($search)) {
                $q->orWhere('duration', (int) $search);
            }

            $participantUserIds = User::withoutGlobalScope(ActiveScope::class)
                ->where('company_id', $companyId)
                ->where('name', 'like', $like)
                ->pluck('id');

            if ($participantUserIds->isNotEmpty()) {
                $q->orWhere(function (Builder $participantQuery) use ($participantUserIds) {
                    foreach ($participantUserIds as $userId) {
                        $participantQuery
                            ->orWhereJsonContains('participants', $userId)
                            ->orWhereJsonContains('participants', (string) $userId);
                    }
                });
            }
        });
    }

    private function searchLikePattern(string $search): string
    {
        return '%'.addcslashes($search, '%_\\').'%';
    }

    /**
     * @param  Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @param  array<string, mixed>  $filters
     * @param  list<string>  $columns
     */
    private function applySearchFilter(Builder $query, array $filters, array $columns): void
    {
        $search = trim((string) ($filters['search'] ?? ''));
        if ($search === '' || $columns === []) {
            return;
        }

        $like = $this->searchLikePattern($search);

        $query->where(function (Builder $q) use ($columns, $like) {
            foreach ($columns as $index => $column) {
                $method = $index === 0 ? 'where' : 'orWhere';
                $q->{$method}($column, 'like', $like);
            }
        });
    }

    /**
     * @param  Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @param  array<string, mixed>  $filters
     * @param  list<string>  $columns
     */
    private function applyCreatedByFilter(Builder $query, array $filters, array $columns): void
    {
        if (! array_key_exists('created_by', $filters) || $filters['created_by'] === null || $filters['created_by'] === '') {
            return;
        }

        $userId = (int) $filters['created_by'];
        if ($userId <= 0) {
            $query->whereRaw('0 = 1');

            return;
        }

        $query->where(function (Builder $q) use ($columns, $userId) {
            foreach ($columns as $index => $column) {
                $method = $index === 0 ? 'where' : 'orWhere';
                $q->{$method}($column, $userId);
            }
        });
    }

    /**
     * @param  Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @param  array<string, mixed>  $filters
     * @param  callable(Builder<\Illuminate\Database\Eloquent\Model>, int): void  $applier
     */
    private function applyOwnedByFilter(Builder $query, array $filters, callable $applier): void
    {
        if (! array_key_exists('owned_by', $filters) || $filters['owned_by'] === null || $filters['owned_by'] === '') {
            return;
        }

        $userId = (int) $filters['owned_by'];
        if ($userId <= 0) {
            $query->whereRaw('0 = 1');

            return;
        }

        $applier($query, $userId);
    }

    /**
     * @param  Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyTimeRangeFilter(Builder $query, array $filters, string $column): void
    {
        if (! empty($filters['from'])) {
            $query->where($column, '>=', Carbon::parse($filters['from'])->utc());
        }

        if (! empty($filters['to'])) {
            $to = Carbon::parse($filters['to']);
            if (is_string($filters['to']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', trim($filters['to'])) === 1) {
                $to = $to->endOfDay();
            }
            $query->where($column, '<=', $to->utc());
        }
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function shouldQueryDealNotes(array $filters): bool
    {
        if (($filters['type'] ?? null) === 'lead') {
            return false;
        }

        if (! empty($filters['deal_id'])) {
            return true;
        }

        if (! empty($filters['lead_id'])) {
            return false;
        }

        return ($filters['type'] ?? null) !== 'lead';
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function shouldQueryLeadNotes(array $filters): bool
    {
        if (($filters['type'] ?? null) === 'deal') {
            return false;
        }

        if (! empty($filters['deal_id'])) {
            return false;
        }

        return true;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Builder<Deal>
     */
    private function companyDealIdsQuery(int $companyId)
    {
        return Deal::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->select('id');
    }

    /**
     * @return \Illuminate\Database\Eloquent\Builder<Lead>
     */
    private function companyLeadIdsQuery(int $companyId)
    {
        return Lead::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->select('id');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveLead(int $companyId, array $data): ?Lead
    {
        if (empty($data['lead_id'])) {
            return null;
        }

        return Lead::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->findOrFail((int) $data['lead_id']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveDeal(int $companyId, array $data, ?Lead $lead): ?Deal
    {
        if (empty($data['deal_id'])) {
            return null;
        }

        $query = Deal::withoutGlobalScope(CompanyScope::class)
            ->with(['leadStage', 'pipeline'])
            ->where('company_id', $companyId)
            ->where('id', (int) $data['deal_id']);

        if ($lead !== null) {
            $query->where('lead_id', $lead->id);
        }

        return $query->firstOrFail();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveCreatedByUserId(array $data, ?Deal $deal, ?Lead $lead): ?int
    {
        if (! empty($data['created_by_user_id'])) {
            return (int) $data['created_by_user_id'];
        }

        if ($deal?->agent_id) {
            $agentUserId = LeadAgent::withoutGlobalScope(CompanyScope::class)
                ->where('id', $deal->agent_id)
                ->value('user_id');

            if ($agentUserId) {
                return (int) $agentUserId;
            }
        }

        if ($lead?->lead_owner) {
            return (int) $lead->lead_owner;
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<int>
     */
    private function normalizeAssigneeIds(array $data, Deal $deal): array
    {
        if (! empty($data['assignee_user_ids'])) {
            return array_values(array_unique(array_map('intval', $data['assignee_user_ids'])));
        }

        return [];
    }

    private function resolveDefaultTaskBoardColumn(int $companyId): TaskboardColumn
    {
        $column = TaskboardColumn::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereIn('slug', ['to_do', 'incomplete'])
            ->orderByRaw("FIELD(slug, 'to_do', 'incomplete')")
            ->first();

        if ($column === null) {
            throw ValidationException::withMessages([
                'heading' => ['No default task board column found for this company.'],
            ]);
        }

        return $column;
    }

    private function resolveCompanyTimezone(int $companyId): string
    {
        $timezone = DB::table('companies')
            ->where('id', $companyId)
            ->value('timezone');

        return is_string($timezone) && $timezone !== '' ? $timezone : 'UTC';
    }

    /**
     * @param  array<int|string>  $participants
     * @return array<int>
     */
    private function ensureCreatorIsParticipant(array $participants, int $creatorId): array
    {
        $normalized = array_values(array_unique(array_map('intval', array_filter($participants, 'is_numeric'))));

        if (! in_array($creatorId, $normalized, true)) {
            array_unshift($normalized, $creatorId);
        }

        return $normalized;
    }

    public function serializeTask(Task $task): array
    {
        return [
            'id' => $task->id,
            'heading' => $task->heading,
            'description' => $task->description,
            'priority' => $task->priority,
            'status' => $task->status,
            'due_date' => $task->due_date?->toIso8601String(),
            'start_date' => $task->start_date?->toIso8601String(),
            'integration_origin' => $this->serializeIntegrationOrigin($task->integration_origin),
            'assignee_user_ids' => $task->users?->pluck('id')->values()->all() ?? [],
            'lead_ids' => $task->relationLoaded('leads') ? $task->leads->pluck('id')->values()->all() : [],
            'deal_ids' => $task->relationLoaded('deals') ? $task->deals->pluck('id')->values()->all() : [],
            'leads' => $task->relationLoaded('leads')
                ? $task->leads->map(fn (Lead $lead) => $this->serializeLeadSummary($lead))->values()->all()
                : [],
            'deals' => $task->relationLoaded('deals')
                ? $task->deals->map(fn (Deal $deal) => $this->serializeDealSummary($deal))->values()->all()
                : [],
            'created_at' => $task->created_at?->toIso8601String(),
            'updated_at' => $task->updated_at?->toIso8601String(),
        ];
    }

    public function serializeNote(DealNote|LeadNote $note, string $type): array
    {
        return [
            'id' => $note->id,
            'type' => $type,
            'title' => $note->title,
            'details' => $note->details,
            'integration_origin' => $this->serializeIntegrationOrigin($note->integration_origin),
            'lead_id' => $type === 'lead' ? $note->lead_id : null,
            'deal_id' => $type === 'deal' ? $note->deal_id : null,
            'lead' => $type === 'lead' ? $this->serializeLeadSummary($note->lead) : null,
            'deal' => $type === 'deal' ? $this->serializeDealSummary($note->deal) : null,
            'created_at' => $note->created_at?->toIso8601String(),
            'updated_at' => $note->updated_at?->toIso8601String(),
        ];
    }

    private function serializeIntegrationOrigin(IntegrationOrigin|string|null $integrationOrigin): ?string
    {
        if ($integrationOrigin instanceof IntegrationOrigin) {
            return $integrationOrigin->value;
        }

        return $integrationOrigin;
    }

    /**
     * @param  Collection<int, User>|null  $participantUserMap  Pre-fetched users keyed by id, to avoid
     *                                                          a per-meeting query when serializing a page of results.
     */
    public function serializeMeeting(DealFollowUp $meeting, ?Collection $participantUserMap = null): array
    {
        return [
            'id' => $meeting->id,
            'lead_id' => $meeting->lead_id,
            'deal_id' => $meeting->deal_id,
            'lead' => $this->serializeLeadSummary($meeting->lead),
            'deal' => $this->serializeDealSummary($meeting->deal),
            'remark' => $meeting->remark,
            'scheduled_at' => $meeting->next_follow_up_date?->toIso8601String(),
            'location' => $meeting->location,
            'meeting_link' => $meeting->meeting_link,
            'meeting_type_id' => $meeting->meeting_type_id,
            'meeting_type' => $meeting->meetingType?->name,
            'duration' => $meeting->getEffectiveDuration(),
            'status' => $meeting->status,
            'participants' => $this->serializeParticipants($meeting->participants ?? [], $participantUserMap),
            'created_at' => $meeting->created_at?->toIso8601String(),
            'updated_at' => $meeting->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @param  iterable<DealFollowUp>  $meetings
     * @return Collection<int, User>
     */
    private function fetchParticipantUserMap(iterable $meetings): Collection
    {
        $ids = collect($meetings)
            ->flatMap(fn (DealFollowUp $meeting) => $meeting->participants ?? [])
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return User::withoutGlobalScope(ActiveScope::class)
            ->whereIn('id', $ids)
            ->get(['id', 'name', 'email'])
            ->keyBy('id');
    }

    /**
     * @param  array<int|string>  $participantIds
     * @param  Collection<int, User>|null  $userMap  Pre-fetched users keyed by id; falls back to a single
     *                                               query for this call's participants when not supplied.
     * @return list<array{id: int, name: string, email: string}>
     */
    private function serializeParticipants(array $participantIds, ?Collection $userMap = null): array
    {
        $ids = array_values(array_unique(array_map('intval', array_filter($participantIds, 'is_numeric'))));

        if ($ids === []) {
            return [];
        }

        $users = $userMap ?? User::withoutGlobalScope(ActiveScope::class)
            ->whereIn('id', $ids)
            ->get(['id', 'name', 'email'])
            ->keyBy('id');

        return collect($ids)
            ->map(fn (int $id) => $users->get($id))
            ->filter()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{id: int, name: ?string, value: ?float, stage: ?array, pipeline: ?array}|null
     */
    private function serializeDealSummary(?Deal $deal): ?array
    {
        if ($deal === null) {
            return null;
        }

        return [
            'id' => $deal->id,
            'name' => $deal->name,
            'value' => $deal->value,
            'stage' => $deal->relationLoaded('leadStage') && $deal->leadStage
                ? ['id' => $deal->leadStage->id, 'name' => $deal->leadStage->name]
                : null,
            'pipeline' => $deal->relationLoaded('pipeline') && $deal->pipeline
                ? ['id' => $deal->pipeline->id, 'name' => $deal->pipeline->name]
                : null,
        ];
    }

    /**
     * @return array{id: int, name: ?string, email: ?string, phone: ?string}|null
     */
    private function serializeLeadSummary(?Lead $lead): ?array
    {
        if ($lead === null) {
            return null;
        }

        $phone = $lead->mobile_with_phone_code;

        return [
            'id' => $lead->id,
            'name' => $lead->client_name,
            'email' => $lead->client_email,
            'phone' => $phone === '--' ? null : $phone,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializePaginatedList(Collection $items, LengthAwarePaginator $paginator): array
    {
        return [
            'data' => $items->values()->all(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }
}
