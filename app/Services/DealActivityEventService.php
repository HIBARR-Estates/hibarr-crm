<?php

namespace App\Services;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Models\CrmEvent;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\DealNote;
use App\Models\Product;
use App\Models\Property;
use App\Models\Task;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Centralised service for recording deal-related CRM activity events.
 *
 * Registered as a **scoped singleton** (one instance per HTTP request) so that
 * every event recorded within a single request automatically shares the same
 * correlation_id. A fresh instance — and therefore a fresh correlation — is
 * created for each new request.
 *
 * All events recorded through this service:
 * - Target model_type = App\Models\Deal (so they appear on the deal timeline)
 * - Use generation_type = system_generated
 * - Are processed asynchronously (sync_processing = false in config)
 */
class DealActivityEventService
{
    protected CrmEventService $eventService;

    /** Lazy-initialised correlation ID shared across all events in one request. */
    protected ?string $correlationId = null;

    /** The ID of the first event recorded in this request (used as causation_id for subsequent events). */
    protected ?int $rootEventId = null;

    public function __construct(CrmEventService $eventService)
    {
        $this->eventService = $eventService;
    }

    // ─── Public recording methods ────────────────────────────────

    public function recordNoteAdded(Deal $deal, DealNote $note): void
    {
        Log::info('[DealActivityEventService::recordNoteAdded] Called.', [
            'deal_id' => $deal->id,
            'note_id' => $note->id,
            'company_id' => $deal->company_id,
        ]);

        $this->record('deal_note_added', $deal, [
            'comment' => 'Note added: ' . ($note->title ?? 'Untitled Note'),
            'note_id' => $note->id,
            'note_title' => $note->title,
            'added_by' => $note->added_by,
        ]);
    }

    public function recordFollowUpCreated(Deal $deal, DealFollowUp $followUp): void
    {
        Log::info('[DealActivityEventService::recordFollowUpCreated] Called.', [
            'deal_id' => $deal->id,
            'followup_id' => $followUp->id,
            'company_id' => $deal->company_id,
        ]);

        $this->record('deal_followup_created', $deal, [
            'comment' => 'Follow-up scheduled' . ($followUp->next_follow_up_date ? ' for ' . $followUp->next_follow_up_date->format('M d, Y H:i') : ''),
            'followup_id' => $followUp->id,
            'meeting_type_id' => $followUp->meeting_type_id,
            'next_follow_up_date' => $followUp->next_follow_up_date?->toIso8601String(),
            'remark' => $followUp->remark,
            'added_by' => $followUp->added_by,
        ]);
    }

    public function recordTaskCreated(Deal $deal, Task $task): void
    {
        $this->record('deal_task_created', $deal, [
            'comment' => 'Task added: ' . $task->heading,
            'task_id' => $task->id,
            'task_heading' => $task->heading,
            'task_priority' => $task->priority,
            'added_by' => $task->added_by,
        ]);
    }

    public function recordProductLinked(Deal $deal, Product $product, ?Property $property = null): void
    {
        $metadata = [
            'comment' => 'Product linked: ' . $product->name . ($property ? ' (Property: ' . ($property->title ?? $property->reference_code ?? '#' . $property->id) . ')' : ''),
            'product_id' => $product->id,
            'product_name' => $product->name,
        ];

        if ($property) {
            $metadata['property_id'] = $property->id;
            $metadata['property_title'] = $property->title ?? null;
            $metadata['property_reference_code'] = $property->reference_code ?? null;
        }

        $this->record('deal_property_linked', $deal, $metadata);
    }

    // ─── Core recording logic ────────────────────────────────────

    /**
     * Record a CRM event tied to a deal with system_generated type and shared correlation.
     */
    protected function record(string $eventTypeSlug, Deal $deal, array $metadata): void
    {
        Log::info('[DealActivityEventService::record] Dispatching to CrmEventService.', [
            'slug' => $eventTypeSlug,
            'deal_id' => $deal->id,
            'company_id' => $deal->company_id,
            'user_id' => auth()->id(),
            'correlation_id' => $this->getCorrelationId(),
        ]);

        try {
            $event = $this->eventService->record([
                'event_type_slug' => $eventTypeSlug,
                'company_id' => $deal->company_id,
                'user_id' => auth()->id(),
                'model_type' => Deal::class,
                'model_id' => $deal->id,
                'generation_type' => CrmEventGenerationType::SYSTEM_GENERATED->value,
                'source' => CrmEventSource::SYSTEM->value,
                'correlation_id' => $this->getCorrelationId(),
                'causation_id' => $this->rootEventId,
                'metadata' => $metadata,
            ]);

            Log::info('[DealActivityEventService::record] CrmEventService returned.', [
                'slug' => $eventTypeSlug,
                'event_id' => $event?->id,
                'was_async' => $event === null,
            ]);

            // Track the first event as the root for causation chaining
            if ($event && $this->rootEventId === null) {
                $this->rootEventId = $event->id;
            }
        } catch (\Throwable $e) {
            Log::error('[DealActivityEventService::record] Exception thrown.', [
                'slug' => $eventTypeSlug,
                'deal_id' => $deal->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Get or lazily generate the correlation ID for the current request.
     */
    protected function getCorrelationId(): string
    {
        if ($this->correlationId === null) {
            $this->correlationId = Str::uuid()->toString();
        }

        return $this->correlationId;
    }
}
