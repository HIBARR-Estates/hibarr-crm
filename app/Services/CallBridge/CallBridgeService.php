<?php

namespace App\Services\CallBridge;

use App\Enums\CrmEventDirection;
use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Enums\CrmEventStatus;
use App\Models\CrmEvent;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Services\CrmEventService;
use App\Services\Reminders\TaskReminderSync;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Integration layer between the CRM and OL's call bridge.
 *
 * OL owns all call data — this service holds no call tables or models of its
 * own. It proxies call control to OL, polls the bridge for call events, and
 * projects those events onto the CRM timeline (crm_events) plus any open
 * "call"/"call back" category tasks linked to the same entity.
 *
 * Provisional contract: OL event payloads are expected to look like
 * { id, call_id, event, direction, phone_number, entity_type, entity_id,
 *   user_id, company_id, status, duration, occurred_at, task_id }.
 * Every field is tolerated as optional — unknown/missing data is logged
 * rather than fatal.
 */
class CallBridgeService
{
    private const PROCESSED_TTL = 604800; // 7 days

    private const CORRELATION_TTL = 604800;

    public function __construct(
        private readonly CallBridgeClient $client,
        private readonly CrmEventService $events,
    ) {}

    // ─── Call control (proxied; timeline logging is the first consumer) ──

    /**
     * Start a call through OL and log call_started on the entity timeline.
     *
     * @param  array{phone_number: string, entity_type: string, entity_id: int, user_id: int, company_id?: int}  $payload
     * @return array<string, mixed>
     */
    public function startCall(array $payload): array
    {
        $response = $this->client->startCall($payload);

        // Best-effort: the call is already live; a timeline failure must not
        // fail the request that started it.
        try {
            $this->logCallEvent([
                'call_id' => $response['call_id'] ?? null,
                'event' => 'call.started',
                'direction' => $payload['direction'] ?? 'outbound',
                'phone_number' => $payload['phone_number'],
                'entity_type' => $payload['entity_type'],
                'entity_id' => $payload['entity_id'],
                'user_id' => $payload['user_id'],
                'company_id' => $payload['company_id'] ?? null,
                'occurred_at' => now(),
            ], CrmEventGenerationType::USER_GENERATED);
        } catch (\Throwable $e) {
            Log::warning('CallBridgeService: failed to log call_started', [
                'call_id' => $response['call_id'] ?? null,
                'error' => $e->getMessage(),
            ]);
        }

        // Emit the call start event to the OL call bridge so it records
        // the call happening on its side. This enables OL to track the
        // call lifecycle (started → answered → ended) alongside the CRM.
        if (! empty($response['call_id'])) {
            try {
                $this->client->emitCallEvent([
                    'event' => 'call.started',
                    'call_id' => $response['call_id'],
                    'direction' => $payload['direction'] ?? 'outbound',
                    'phone_number' => $payload['phone_number'],
                    'entity_type' => $payload['entity_type'],
                    'entity_id' => $payload['entity_id'],
                    'status' => 'pending',
                ]);
            } catch (\Throwable $e) {
                Log::warning('CallBridgeService: failed to emit call_started to OL', [
                    'call_id' => $response['call_id'] ?? null,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $response;
    }

    /**
     * End an active call through OL and log call_ended on the entity timeline.
     *
     * @param  array<string, mixed>  $context  Extra context (entity, phone, user) when the caller has it.
     * @return array<string, mixed>
     */
    public function endCall(string $callId, array $context = []): array
    {
        $response = $this->client->endCall($callId);

        // Best-effort, same as startCall: the call already ended.
        try {
            $this->logCallEvent(array_merge($context, [
                'call_id' => $callId,
                'event' => 'call.ended',
                'duration' => $response['duration'] ?? null,
                'status' => $response['status'] ?? null,
                'occurred_at' => now(),
            ]), CrmEventGenerationType::USER_GENERATED);
        } catch (\Throwable $e) {
            Log::warning('CallBridgeService: failed to log call_ended', [
                'call_id' => $callId,
                'error' => $e->getMessage(),
            ]);
        }

        // Emit the call end event to the OL call bridge so it records
        // the call ending on its side.
        if (! empty($callId)) {
            try {
                $this->client->emitCallEvent([
                    'event' => 'call.ended',
                    'call_id' => $callId,
                    'status' => $response['status'] ?? null,
                ]);
            } catch (\Throwable $e) {
                Log::warning('CallBridgeService: failed to emit call_ended to OL', [
                    'call_id' => $callId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $response;
    }

    /**
     * @return array<string, mixed>
     */
    public function getCallStatus(string $callId): array
    {
        return $this->client->getCallStatus($callId);
    }

    // ─── Polling ─────────────────────────────────────────────────────────

    /**
     * Pull new call events from the bridge and project them onto the timeline.
     *
     * @param  int  $limit  Max events fetched per request.
     * @return array{fetched: int, logged: int, skipped: int, errors: int}
     */
    public function poll(int $limit = 100): array
    {
        $summary = ['fetched' => 0, 'logged' => 0, 'skipped' => 0, 'errors' => 0];

        if (!$this->client->configured()) {
            Log::warning('CallBridgeService: poll skipped — call bridge not configured.');

            return $summary;
        }

        $since = $this->cursor();
        $pages = 0;

        do {
            $page = $this->client->fetchEvents($since, $limit);
            $pages++;

            $errorsThisPage = 0;

            foreach ($page['events'] as $olEvent) {
                $summary['fetched']++;

                try {
                    $result = $this->logCallEvent($olEvent);
                    $result ? $summary['logged']++ : $summary['skipped']++;

                    // Emit a leg event to the OL call bridge when the call is
                    // answered or connected. This ensures OL records the full
                    // call lifecycle (started → answered → ended) alongside
                    // the CRM timeline.
                    if ($result !== null) {
                        $eventType = ($olEvent['event'] ?? $olEvent['type'] ?? '') ?? '';
                        $lower = strtolower($eventType);
                        $isAnswered = in_array($lower, [
                            'call.started', 'call.initiated', 'started', 'initiated',
                            'call.ended', 'call.completed', 'ended', 'completed',
                            'call_answered', 'answered', 'connect', 'connected',
                        ], true);

                        if ($isAnswered) {
                            try {
                                $callId = $olEvent['call_id'] ?? null;
                                if (! empty($callId)) {
                                    $this->client->emitCallEvent([
                                        'event' => 'call.answered',
                                        'call_id' => $callId,
                                        'status' => $result->status ?? 'completed',
                                    ]);
                                }
                            } catch (\Throwable $e) {
                                Log::warning('CallBridgeService: failed to emit call_answered to OL', [
                                    'event' => $eventType,
                                    'call_id' => $callId ?? null,
                                    'error' => $e->getMessage(),
                                ]);
                            }
                        }
                    }
                } catch (\Throwable $e) {
                    $errorsThisPage++;
                    $summary['errors']++;
                    Log::error('CallBridgeService: failed to project OL call event', [
                        'event' => is_array($olEvent) ? ($olEvent['id'] ?? null) : null,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Don't advance past events that failed to project — the cursor is
            // the only resume point, so moving it would silently drop them.
            // They are re-fetched next poll; already-written events dedupe.
            if ($errorsThisPage > 0) {
                Log::warning('CallBridgeService: page had projection errors; cursor not advanced.', [
                    'errors' => $errorsThisPage,
                    'cursor' => $since,
                ]);

                break;
            }

            $nextSince = ($page['cursor'] !== null && $page['cursor'] !== '')
                ? $page['cursor']
                : $this->latestOccurredAt($page['events']);

            // No forward movement means the bridge is returning the same page;
            // looping again would just refetch it ten times.
            if ($nextSince === null || $nextSince === $since) {
                break;
            }

            $since = $nextSince;
            $this->setCursor($since);
        } while ($page['has_more'] && $pages < 10);

        Log::info('CallBridgeService: poll complete', $summary);

        return $summary;
    }

    // ─── Timeline logging ────────────────────────────────────────────────

    /**
     * Project a single OL call event onto the CRM timeline.
     *
     * Idempotent: replayed OL events are skipped (cache fast-path plus a
     * metadata lookup that survives cache flushes). The dedupe marker is only
     * written after a successful projection, so a transient failure is retried
     * on the next poll instead of being dropped.
     *
     * @param  array<string, mixed>  $olEvent
     * @param  string|CrmEventGenerationType  $generationType  CrmEventGenerationType value — USER_GENERATED by
     *                                  default, since the CRM auto-logs call outcomes on behalf of the
     *                                  agent. Pass EXTERNAL only for genuinely third-party sources.
     * @return CrmEvent|null Null when the event was skipped or unresolvable.
     */
    public function logCallEvent(array $olEvent, CrmEventGenerationType|string $generationType = CrmEventGenerationType::USER_GENERATED): ?CrmEvent
    {
        $generationType = $generationType instanceof CrmEventGenerationType
            ? $generationType->value
            : $generationType;

        $dedupeKey = $this->dedupeKey($olEvent);
        if ($dedupeKey !== null && $this->alreadyProcessed($dedupeKey, $olEvent)) {
            return null;
        }

        $mapped = $this->mapEventType($olEvent);

        // Intermediate status pings and unrecognised events are not logged —
        // mark processed and move on so they are not re-fetched.
        if ($mapped === null) {
            if ($dedupeKey !== null) {
                $this->markProcessed($dedupeKey);
            }

            return null;
        }

        [$slug, $status] = $mapped;

        $companyId = $this->resolveCompanyId($olEvent);
        if ($companyId === null) {
            Log::warning('CallBridgeService: cannot resolve company for call event; skipped.', [
                'call_id' => $olEvent['call_id'] ?? null,
                'event' => $olEvent['event'] ?? null,
            ]);

            return null;
        }

        [$modelType, $modelId] = $this->resolveEntity($olEvent, $companyId);
        $userId = !empty($olEvent['user_id']) ? (int) $olEvent['user_id'] : null;
        $correlationId = !empty($olEvent['call_id'])
            ? $this->correlationForCall((string) $olEvent['call_id'])
            : $this->events->startCorrelation();

        $metadata = $this->buildMetadata($olEvent, $dedupeKey);

        $event = null;
        if ($modelType !== null) {
            $event = $this->events->record([
                'event_type_slug' => $slug,
                'company_id' => $companyId,
                'user_id' => $userId,
                'model_type' => $modelType,
                'model_id' => $modelId,
                'generation_type' => $generationType,
                'source' => CrmEventSource::API->value,
                'direction' => $this->direction($olEvent),
                'status' => $status,
                'correlation_id' => $correlationId,
                'metadata' => $metadata,
                'occurred_at' => $this->occurredAt($olEvent),
            ], forceSync: true);
        }

        $this->projectToCallTasks($olEvent, $slug, $status, $companyId, $correlationId, $event, $metadata, $generationType);

        if ($dedupeKey !== null) {
            $this->markProcessed($dedupeKey);
        }

        return $event;
    }

    // ─── Task integration (categories: call / call back) ─────────────────

    /**
     * Open tasks linked to the event's entity whose category is "call" or
     * "call back" (matched after normalising the category name).
     *
     * @return Collection<int, Task>
     */
    public function findCallTasks(string $entityType, int $entityId, int $companyId): Collection
    {
        $entity = $this->findEntity($entityType, $entityId, $companyId);
        if (!$entity instanceof Lead && !$entity instanceof Deal) {
            return collect();
        }

        $wanted = $this->wantedCategoryKeys();

        return $entity->tasks()
            ->whereNull('tasks.completed_on')
            ->whereNull('tasks.deleted_at')
            ->with('category')
            ->get()
            ->filter(function (Task $task) use ($wanted) {
                $name = $task->category?->category_name;

                return $name !== null && in_array($this->normalizeCategoryKey($name), $wanted, true);
            })
            ->values();
    }

    /**
     * Mirror the call event onto each matching open call/callback task, then
     * complete those tasks when the call ended answered (config-gated).
     *
     * @param  array<string, mixed>  $olEvent
     */
    private function projectToCallTasks(
        array $olEvent,
        string $slug,
        CrmEventStatus $status,
        int $companyId,
        string $correlationId,
        ?CrmEvent $sourceEvent,
        array $metadata,
        string $generationType = CrmEventGenerationType::USER_GENERATED->value,
    ): void {
        $entityType = is_string($olEvent['entity_type'] ?? null) ? $olEvent['entity_type'] : null;
        $entityId = !empty($olEvent['entity_id']) ? (int) $olEvent['entity_id'] : 0;

        $tasks = ($entityType && $entityId)
            ? $this->findCallTasks($entityType, $entityId, $companyId)
            : collect();

        // An explicit task_id from OL wins over entity matching.
        if (!empty($olEvent['task_id'])) {
            $explicit = Task::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereKey((int) $olEvent['task_id'])
                ->with('category')
                ->first();
            if ($explicit && !$tasks->contains('id', $explicit->id)) {
                $tasks->push($explicit);
            }
        }

        foreach ($tasks as $task) {
            $this->events->record([
                'event_type_slug' => $slug,
                'company_id' => $companyId,
                'user_id' => $sourceEvent?->user_id,
                'model_type' => Task::class,
                'model_id' => $task->id,
                'generation_type' => $generationType,
                'source' => CrmEventSource::API->value,
                'direction' => $this->direction($olEvent),
                'status' => $status,
                'correlation_id' => $correlationId,
                'causation_id' => $sourceEvent?->id,
                'metadata' => $metadata,
                'occurred_at' => $this->occurredAt($olEvent),
            ], forceSync: true);
        }

        // Only a genuinely answered/connected call that ended completes tasks —
        // missed, voicemail, declined, busy and failed leave them open.
        if ($slug === 'call_ended'
            && $status === CrmEventStatus::COMPLETED
            && (bool) config('services.call_bridge.complete_tasks_on_call_end', true)
        ) {
            $this->completeCallTasks($tasks, $companyId, $correlationId);
        }
    }

    /**
     * Move matching tasks to the done column without firing the request-bound
     * TaskObserver side effects (this runs from console/poller context).
     *
     * @param  Collection<int, Task>  $tasks
     */
    private function completeCallTasks(Collection $tasks, int $companyId, string $correlationId): void
    {
        // Scoped to $companyId, not the session: this runs from the console/poller
        // where TaskboardColumn::doneColumn() reads a session-derived cache key
        // and can return another company's column.
        $doneColumn = TaskboardColumn::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('slug', 'done')
            ->first();

        if (!$doneColumn) {
            Log::warning('CallBridgeService: no "done" taskboard column; tasks left open.', [
                'company_id' => $companyId,
            ]);

            return;
        }

        foreach ($tasks as $task) {
            if ((int) $task->board_column_id === (int) $doneColumn->id) {
                continue;
            }

            $task->board_column_id = $doneColumn->id;
            $task->completed_on = now()->toDateString();
            $task->saveQuietly();

            try {
                app(TaskReminderSync::class)->syncFromTask($task);
            } catch (\Throwable $e) {
                Log::warning('CallBridgeService: reminder sync failed after completing task', [
                    'task_id' => $task->id,
                    'error' => $e->getMessage(),
                ]);
            }

            $this->events->record([
                'event_type_slug' => 'task_completed',
                'company_id' => $companyId,
                'model_type' => Task::class,
                'model_id' => $task->id,
                'generation_type' => CrmEventGenerationType::SYSTEM_GENERATED->value,
                'source' => CrmEventSource::SYSTEM->value,
                'correlation_id' => $correlationId,
                'metadata' => ['comment' => 'Completed by call bridge'],
                'occurred_at' => now(),
            ], forceSync: true);
        }
    }

    // ─── Resolution helpers ──────────────────────────────────────────────

    /**
     * Map an OL call event to a CRM event type and status.
     *
     * The poll only records meaningful call outcomes — answered, voicemail,
     * declined, busy, failed, missed/dropped, or started. Intermediate status
     * pings (ringing, dialing, etc.) and unrecognised events return null so
     * they are skipped rather than logged as noise on the timeline.
     *
     * @param  array<string, mixed>  $olEvent
     * @return array{0: string, 1: CrmEventStatus}|null Null when the event is not a loggable outcome.
     */
    private function mapEventType(array $olEvent): ?array
    {
        $raw = strtolower((string) ($olEvent['event'] ?? $olEvent['type'] ?? ''));
        $olStatus = strtolower((string) ($olEvent['status'] ?? ''));

        return match (true) {
            // Status-driven outcomes (the most specific signal OL sends).
            in_array($olStatus, ['answered', 'connected'], true) => ['call_ended', CrmEventStatus::COMPLETED],
            in_array($olStatus, ['voicemail', 'voice_mail', 'voice mail', 'vm'], true) => ['call_voicemail', CrmEventStatus::COMPLETED],
            in_array($olStatus, ['declined', 'reject', 'rejected'], true) => ['call_declined', CrmEventStatus::REJECTED],
            in_array($olStatus, ['busy', 'busy_line'], true) => ['call_busy', CrmEventStatus::MISSED],
            in_array($olStatus, ['failed', 'failure', 'error', 'cancel', 'cancelled', 'canceled'], true) => ['call_failed', CrmEventStatus::ERROR_OCCURRED],
            in_array($olStatus, ['missed', 'dropped', 'no_answer', 'unanswered', 'no_pickup'], true) => ['call_missed', CrmEventStatus::MISSED],
            // Event-name-driven outcomes (when no usable status is present).
            in_array($raw, ['call.ended', 'call.completed', 'ended', 'completed'], true) => ['call_ended', CrmEventStatus::COMPLETED],
            in_array($raw, ['call.missed', 'missed'], true) => ['call_missed', CrmEventStatus::MISSED],
            in_array($raw, ['call.declined', 'call.rejected', 'declined', 'rejected'], true) => ['call_declined', CrmEventStatus::REJECTED],
            in_array($raw, ['call.voicemail', 'voicemail', 'voice_mail'], true) => ['call_voicemail', CrmEventStatus::COMPLETED],
            in_array($raw, ['call.busy', 'busy'], true) => ['call_busy', CrmEventStatus::MISSED],
            in_array($raw, ['call.failed', 'failed', 'error'], true) => ['call_failed', CrmEventStatus::ERROR_OCCURRED],
            // Started (once per call; CRM-initiated calls already log this via startCall).
            in_array($raw, ['call.started', 'call.initiated', 'started', 'initiated'], true) => ['call_started', CrmEventStatus::COMPLETED],
            // Everything else — ringing, dialing, status pings — is not logged.
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $olEvent
     * @return array{0: string|null, 1: int|null}
     */
    private function resolveEntity(array $olEvent, int $companyId): array
    {
        $type = is_string($olEvent['entity_type'] ?? null) ? strtolower($olEvent['entity_type']) : null;
        $id = !empty($olEvent['entity_id']) ? (int) $olEvent['entity_id'] : 0;
        if ($type === null || $id <= 0) {
            return [null, null];
        }

        $entity = $this->findEntity($type, $id, $companyId);
        if (!$entity) {
            return [null, null];
        }

        return [get_class($entity), $entity->getKey()];
    }

    private function findEntity(string $type, int $id, int $companyId): Lead|Deal|null
    {
        $model = match ($type) {
            'lead' => Lead::class,
            'deal' => Deal::class,
            default => null,
        };

        if ($model === null) {
            return null;
        }

        /** @var Lead|Deal|null $entity */
        $entity = $model::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereKey($id)
            ->first();

        return $entity;
    }

    /**
     * @param  array<string, mixed>  $olEvent
     */
    private function resolveCompanyId(array $olEvent): ?int
    {
        if (!empty($olEvent['company_id'])) {
            return (int) $olEvent['company_id'];
        }

        $entityType = is_string($olEvent['entity_type'] ?? null) ? strtolower($olEvent['entity_type']) : null;
        $entityId = !empty($olEvent['entity_id']) ? (int) $olEvent['entity_id'] : 0;
        if ($entityType && $entityId) {
            $model = match ($entityType) {
                'lead' => Lead::class,
                'deal' => Deal::class,
                default => null,
            };
            if ($model) {
                $companyId = $model::withoutGlobalScopes()->whereKey($entityId)->value('company_id');
                if ($companyId) {
                    return (int) $companyId;
                }
            }
        }

        if (!empty($olEvent['user_id'])) {
            $companyId = \App\Models\User::withoutGlobalScopes()
                ->whereKey((int) $olEvent['user_id'])
                ->value('company_id');
            if ($companyId) {
                return (int) $companyId;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $olEvent
     */
    private function direction(array $olEvent): ?string
    {
        $value = strtolower((string) ($olEvent['direction'] ?? ''));

        return match ($value) {
            'inbound', 'incoming' => CrmEventDirection::INBOUND->value,
            'outbound', 'outgoing' => CrmEventDirection::OUTBOUND->value,
            default => null,
        };
    }

    /**
     * OL sends ISO-8601 timestamps (often with a `Z` suffix). The ApiModel
     * base class only parses a couple of ISO shapes strictly, so normalise
     * to Carbon here rather than passing the raw string through.
     *
     * @param  array<string, mixed>  $olEvent
     */
    private function occurredAt(array $olEvent): \DateTimeInterface
    {
        $raw = $olEvent['occurred_at'] ?? null;

        if ($raw instanceof \DateTimeInterface) {
            return $raw;
        }

        if (is_string($raw) && $raw !== '') {
            try {
                return new \Carbon\CarbonImmutable($raw);
            } catch (\Throwable) {
                Log::warning('CallBridgeService: unparseable occurred_at; using now.', [
                    'occurred_at' => $raw,
                ]);
            }
        }

        return now();
    }

    /**
     * @param  array<string, mixed>  $olEvent
     * @return array<string, mixed>
     */
    private function buildMetadata(array $olEvent, ?string $dedupeKey): array
    {
        $metadata = array_filter([
            'call_id' => $olEvent['call_id'] ?? null,
            // Stable per-call reference shared with the recording upload, so the
            // timeline can say whether audio was captured for this call.
            'call_ref' => $olEvent['call_ref'] ?? null,
            'ol_event_id' => $olEvent['id'] ?? null,
            'phone_number' => $olEvent['phone_number'] ?? null,
            'direction' => $olEvent['direction'] ?? null,
            'status' => $olEvent['status'] ?? null,
            'previous_status' => $olEvent['previous_status'] ?? null,
            'duration' => isset($olEvent['duration']) ? (int) $olEvent['duration'] : null,
            'task_id' => $olEvent['task_id'] ?? null,
            'entity_type' => $olEvent['entity_type'] ?? null,
            'entity_id' => $olEvent['entity_id'] ?? null,
            'comment' => $olEvent['comment'] ?? null,
            'dedupe_key' => $dedupeKey,
        ], fn ($v) => $v !== null && $v !== '');

        return $metadata + ['source' => 'ol_call_bridge'];
    }

    // ─── Idempotency & correlation ───────────────────────────────────────

    /**
     * @param  array<string, mixed>  $olEvent
     */
    private function dedupeKey(array $olEvent): ?string
    {
        if (!empty($olEvent['id'])) {
            return 'evt:' . $olEvent['id'];
        }

        if (empty($olEvent['call_id'])) {
            return null;
        }

        return implode(':', [
            'call',
            $olEvent['call_id'],
            $olEvent['event'] ?? $olEvent['type'] ?? 'unknown',
            $olEvent['status'] ?? '',
            $olEvent['occurred_at'] ?? '',
        ]);
    }

    private function alreadyProcessed(string $key, array $olEvent): bool
    {
        if (Cache::get($this->processedCacheKey($key))) {
            return true;
        }

        // Survives a cache flush: OL event ids are stored on the timeline row.
        if (str_starts_with($key, 'evt:')) {
            return CrmEvent::withoutGlobalScopes()
                ->where('metadata->ol_event_id', $olEvent['id'])
                ->exists();
        }

        return false;
    }

    private function markProcessed(string $key): void
    {
        Cache::put($this->processedCacheKey($key), 1, self::PROCESSED_TTL);
    }

    private function processedCacheKey(string $key): string
    {
        return 'call_bridge:processed:' . sha1($key);
    }

    /** One correlation UUID per OL call so started/ended/status chain together. */
    private function correlationForCall(string $callId): string
    {
        return Cache::remember(
            'call_bridge:corr:' . $callId,
            self::CORRELATION_TTL,
            fn () => Str::uuid()->toString()
        );
    }

    // ─── Cursor ──────────────────────────────────────────────────────────

    private function cursor(): ?string
    {
        $cursor = Cache::get('call_bridge:cursor');

        return is_string($cursor) && $cursor !== '' ? $cursor : null;
    }

    private function setCursor(string $cursor): void
    {
        Cache::put('call_bridge:cursor', $cursor, now()->addDays(30));
    }

    /**
     * @param  array<int, array<string, mixed>>  $events
     */
    private function latestOccurredAt(array $events): ?string
    {
        $latest = null;
        foreach ($events as $event) {
            $at = $event['occurred_at'] ?? null;
            if (is_string($at) && ($latest === null || strcmp($at, $latest) > 0)) {
                $latest = $at;
            }
        }

        return $latest;
    }

    // ─── Category matching ───────────────────────────────────────────────

    /** @return array<int, string> Normalised category keys, e.g. ['call', 'callback']. */
    private function wantedCategoryKeys(): array
    {
        $names = (array) config('services.call_bridge.task_categories', ['call', 'call back']);

        return array_values(array_unique(array_map(
            fn ($name) => $this->normalizeCategoryKey((string) $name),
            $names
        )));
    }

    private function normalizeCategoryKey(string $name): string
    {
        return strtolower(preg_replace('/[^a-z0-9]/i', '', $name));
    }
}
