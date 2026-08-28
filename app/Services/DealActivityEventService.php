<?php

namespace App\Services;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Enums\MeetingAttendanceOutcome;
use App\Models\CrmEvent;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\DealNote;
use App\Models\LeadPipeline;
use App\Models\Package;
use App\Models\PipelineStage;
use App\Models\Product;
use App\Models\Property;
use App\Models\Task;
use App\Services\CrmEventDescriptionBuilder;
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

        $noteTitle = trim((string) ($note->title ?? ''));
        $fallbackTitle = $noteTitle !== '' ? $noteTitle : 'Untitled Note';
        $details = trim(strip_tags((string) ($note->details ?? '')));
        $notePreview = Str::limit($details, 120, '...');
        $comment = 'Note added: ' . $fallbackTitle;

        if ($notePreview !== '') {
            $comment .= ' — ' . $notePreview;
        }

        $this->record('deal_note_added', $deal, [
            'comment' => $comment,
            'note_id' => $note->id,
            'note_title' => $fallbackTitle,
            'note_preview' => $notePreview !== '' ? $notePreview : null,
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

        $meetingTypeName = trim((string) ($followUp->meetingType?->type ?? ''));
        $meetingLabel = $meetingTypeName !== '' ? $meetingTypeName : 'Follow-up';
        $scheduledAtLabel = CrmEventDescriptionBuilder::formatDate($followUp->next_follow_up_date);

        $comment = $meetingLabel . ' scheduled';
        if ($scheduledAtLabel !== '--') {
            $comment .= ' for ' . $scheduledAtLabel;
        }

        $this->record('deal_followup_created', $deal, [
            'comment' => $comment,
            'followup_id' => $followUp->id,
            'meeting_type_id' => $followUp->meeting_type_id,
            'meeting_type_name' => $meetingTypeName !== '' ? $meetingTypeName : null,
            'next_follow_up_date' => $followUp->next_follow_up_date?->toIso8601String(),
            'next_follow_up_label' => $scheduledAtLabel !== '--' ? $scheduledAtLabel : null,
            'remark' => $followUp->remark,
            'added_by' => $followUp->added_by,
        ]);
    }

    /**
     * Records the outcome-change itself. The remark text (if any) is created as
     * its own DealNote by MeetingAttendanceConfirmationService — DealNoteObserver
     * already records that as a separate `deal_note_added` timeline entry, so
     * only a cross-reference id is carried here, not the note text.
     */
    public function recordMeetingOutcomeLogged(
        Deal $deal,
        DealFollowUp $followUp,
        MeetingAttendanceOutcome $outcome,
        ?int $noteId = null
    ): void {
        Log::info('[DealActivityEventService::recordMeetingOutcomeLogged] Called.', [
            'deal_id' => $deal->id,
            'followup_id' => $followUp->id,
            'outcome' => $outcome->value,
            'company_id' => $deal->company_id,
        ]);

        $meetingTypeName = trim((string) ($followUp->meetingType?->name ?? ''));
        $meetingLabel = $meetingTypeName !== '' ? $meetingTypeName : 'Follow-up';

        $this->record('deal_meeting_outcome_logged', $deal, [
            'comment' => $meetingLabel . ': ' . $outcome->label(),
            'followup_id' => $followUp->id,
            'meeting_type_id' => $followUp->meeting_type_id,
            'meeting_type_name' => $meetingTypeName !== '' ? $meetingTypeName : null,
            'outcome' => $outcome->value,
            'outcome_label' => $outcome->label(),
            'note_id' => $noteId,
        ], $this->generationTypeForCurrentUser());
    }

    public function recordTaskCreated(Deal $deal, Task $task): void
    {
        $taskHeading = trim((string) $task->heading);
        $taskLabel = $taskHeading !== '' ? $taskHeading : 'Untitled Task';
        $dueDateLabel = CrmEventDescriptionBuilder::formatDate($task->due_date);

        $comment = 'Task added: ' . $taskLabel;
        if ($dueDateLabel !== '--') {
            $comment .= ' (Due ' . $dueDateLabel . ')';
        }

        $this->record('deal_task_created', $deal, [
            'comment' => $comment,
            'task_id' => $task->id,
            'task_heading' => $taskLabel,
            'task_priority' => $task->priority,
            'task_due_date' => $task->due_date?->toIso8601String(),
            'task_due_date_label' => $dueDateLabel !== '--' ? $dueDateLabel : null,
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

    public function recordPropertyUnlinked(Deal $deal, array $oldPropertyIds, array $newPropertyIds, array $oldPropertyNames, array $newPropertyNames): void
    {
        $removedIds = array_values(array_diff($oldPropertyIds, $newPropertyIds));
        $removedNames = array_values(array_filter(array_map(fn ($id) => $oldPropertyNames[$id] ?? null, $removedIds)));

        if (empty($removedIds)) {
            return;
        }

        $comment = 'Deal property removed';
        if (!empty($removedNames)) {
            $comment .= ': ' . implode(', ', $removedNames);
        }

        $this->record('deal_property_unlinked', $deal, [
            'comment' => $comment,
            'old_property_ids' => array_values($oldPropertyIds),
            'new_property_ids' => array_values($newPropertyIds),
            'old_property_names' => array_values($oldPropertyNames),
            'new_property_names' => array_values($newPropertyNames),
            'removed_property_ids' => $removedIds,
            'removed_property_names' => $removedNames ?: null,
        ]);
    }

    public function recordPackagesUpdated(Deal $deal, array $oldPackageIds, array $newPackageIds, array $oldPackageNames, array $newPackageNames): void
    {
        $addedIds = array_values(array_diff($newPackageIds, $oldPackageIds));
        $removedIds = array_values(array_diff($oldPackageIds, $newPackageIds));

        if (empty($addedIds) && empty($removedIds)) {
            return;
        }

        $addedNames = array_values(array_filter(array_map(fn ($id) => $newPackageNames[$id] ?? null, $addedIds)));
        $removedNames = array_values(array_filter(array_map(fn ($id) => $oldPackageNames[$id] ?? null, $removedIds)));
        $commentParts = [];

        if (!empty($addedNames)) {
            $commentParts[] = 'added ' . implode(', ', $addedNames);
        }
        if (!empty($removedNames)) {
            $commentParts[] = 'removed ' . implode(', ', $removedNames);
        }

        $comment = 'Deal packages updated';
        if (!empty($commentParts)) {
            $comment .= ': ' . implode('; ', $commentParts);
        }

        $this->record('deal_packages_updated', $deal, [
            'comment' => $comment,
            'old_package_ids' => array_values($oldPackageIds),
            'new_package_ids' => array_values($newPackageIds),
            'old_package_names' => array_values($oldPackageNames),
            'new_package_names' => array_values($newPackageNames),
            'added_package_ids' => $addedIds,
            'removed_package_ids' => $removedIds,
            'added_package_names' => $addedNames ?: null,
            'removed_package_names' => $removedNames ?: null,
        ]);
    }

    public function recordPackagePipelineRouted(
        Deal $deal,
        Package $package,
        int $fromPipelineId,
        int $fromStageId,
        LeadPipeline $toPipeline,
        ?int $toStageId,
    ): void {
        $fromPipeline = LeadPipeline::find($fromPipelineId);
        $fromStage = PipelineStage::find($fromStageId);
        $toStage = $toStageId ? PipelineStage::find($toStageId) : null;

        if ($fromPipelineId !== (int) $toPipeline->id) {
            $this->record('deal_pipeline_changed', $deal, [
                'comment' => CrmEventDescriptionBuilder::dealPipelineChanged(
                    $fromPipeline?->name,
                    $toPipeline->name,
                ),
                'from_pipeline_id' => $fromPipelineId,
                'to_pipeline_id' => $toPipeline->id,
                'from_pipeline_name' => $fromPipeline?->name,
                'to_pipeline_name' => $toPipeline->name,
                'package_id' => $package->id,
                'package_name' => $package->name,
                'trigger' => 'package_pipeline_routing',
            ]);
        }

        if ($fromStageId !== (int) $toStageId && $toStage) {
            $this->record('deal_stage_changed', $deal, [
                'comment' => CrmEventDescriptionBuilder::dealStageChanged(
                    $fromStage?->name,
                    $toStage->name,
                ),
                'from_stage_id' => $fromStageId,
                'to_stage_id' => $toStageId,
                'from_stage_name' => $fromStage?->name,
                'to_stage_name' => $toStage->name,
                'package_id' => $package->id,
                'package_name' => $package->name,
                'trigger' => 'package_pipeline_routing',
            ]);
        }
    }

    public function recordWatchersUpdated(Deal $deal, array $oldWatcherIds, array $newWatcherIds, array $oldWatcherNames, array $newWatcherNames): void
    {
        $addedIds = array_values(array_diff($newWatcherIds, $oldWatcherIds));
        $removedIds = array_values(array_diff($oldWatcherIds, $newWatcherIds));

        if (empty($addedIds) && empty($removedIds)) {
            return;
        }

        $addedNames = array_values(array_filter(array_map(fn ($id) => $newWatcherNames[$id] ?? null, $addedIds)));
        $removedNames = array_values(array_filter(array_map(fn ($id) => $oldWatcherNames[$id] ?? null, $removedIds)));
        $commentParts = [];

        if (!empty($addedNames)) {
            $commentParts[] = 'added ' . implode(', ', $addedNames);
        }
        if (!empty($removedNames)) {
            $commentParts[] = 'removed ' . implode(', ', $removedNames);
        }

        $comment = 'Deal watchers updated';
        if (!empty($commentParts)) {
            $comment .= ': ' . implode('; ', $commentParts);
        }

        $this->record('deal_watchers_updated', $deal, [
            'comment' => $comment,
            'old_watcher_ids' => array_values($oldWatcherIds),
            'new_watcher_ids' => array_values($newWatcherIds),
            'old_watcher_names' => array_values($oldWatcherNames),
            'new_watcher_names' => array_values($newWatcherNames),
            'added_watcher_ids' => $addedIds,
            'removed_watcher_ids' => $removedIds,
            'added_watcher_names' => $addedNames ?: null,
            'removed_watcher_names' => $removedNames ?: null,
        ]);
    }

    /**
     * Record CRM events for one or more custom field value changes on a deal.
     *
     * @param array<int, array{custom_field_id: int, field_label: string, field_type: ?string, old_value: ?string, new_value: ?string}> $changes
     */
    public function recordCustomFieldsUpdated(Deal $deal, array $changes): void
    {
        foreach ($changes as $change) {
            $this->recordCustomFieldUpdated(
                $deal,
                (int) $change['custom_field_id'],
                (string) $change['field_label'],
                $change['old_value'] ?? null,
                $change['new_value'] ?? null,
                $change['field_type'] ?? null
            );
        }
    }

    public function recordCustomFieldUpdated(
        Deal $deal,
        int $customFieldId,
        string $fieldLabel,
        ?string $oldValue,
        ?string $newValue,
        ?string $fieldType = null
    ): void {
        $oldDisplay = $this->formatCustomFieldValueForDisplay($oldValue, $fieldType);
        $newDisplay = $this->formatCustomFieldValueForDisplay($newValue, $fieldType);

        $this->record('deal_custom_field_updated', $deal, [
            'comment' => CrmEventDescriptionBuilder::dealCustomFieldUpdated($fieldLabel, $oldDisplay, $newDisplay),
            'custom_field_id' => $customFieldId,
            'field_label' => $fieldLabel,
            'field_type' => $fieldType,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'old_value_display' => $oldDisplay,
            'new_value_display' => $newDisplay,
        ], $this->generationTypeForCurrentUser());
    }

    /**
     * @param array<int, array{field_name: string, field_label: string, field_type: ?string, old_value: ?string, new_value: ?string}> $changes
     */
    public function recordHibarrFieldsUpdated(Deal $deal, array $changes): void
    {
        foreach ($changes as $change) {
            $this->recordHibarrFieldUpdated(
                $deal,
                (string) $change['field_name'],
                (string) $change['field_label'],
                $change['old_value'] ?? null,
                $change['new_value'] ?? null,
                $change['field_type'] ?? null
            );
        }
    }

    public function recordHibarrFieldUpdated(
        Deal $deal,
        string $fieldName,
        string $fieldLabel,
        ?string $oldValue,
        ?string $newValue,
        ?string $fieldType = null
    ): void {
        $oldDisplay = $this->formatAssociatableFieldValueForDisplay($oldValue, $fieldType);
        $newDisplay = $this->formatAssociatableFieldValueForDisplay($newValue, $fieldType);

        $this->record('deal_hibarr_field_updated', $deal, [
            'comment' => CrmEventDescriptionBuilder::dealHibarrFieldUpdated($fieldLabel, $oldDisplay, $newDisplay),
            'field_name' => $fieldName,
            'field_label' => $fieldLabel,
            'field_type' => $fieldType,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'old_value_display' => $oldDisplay,
            'new_value_display' => $newDisplay,
        ], $this->generationTypeForCurrentUser());
    }

    /**
     * @param array<int, array{field_name: string, field_label: string, field_type: ?string, old_value: ?string, new_value: ?string}> $changes
     */
    public function recordLeadMarketingFieldsUpdated(Deal $deal, array $changes): void
    {
        foreach ($changes as $change) {
            $this->recordLeadMarketingFieldUpdated(
                $deal,
                (string) $change['field_name'],
                (string) $change['field_label'],
                $change['old_value'] ?? null,
                $change['new_value'] ?? null,
                $change['field_type'] ?? null
            );
        }
    }

    public function recordLeadMarketingFieldUpdated(
        Deal $deal,
        string $fieldName,
        string $fieldLabel,
        ?string $oldValue,
        ?string $newValue,
        ?string $fieldType = null
    ): void {
        $oldDisplay = $this->formatAssociatableFieldValueForDisplay($oldValue, $fieldType);
        $newDisplay = $this->formatAssociatableFieldValueForDisplay($newValue, $fieldType);

        $this->record('deal_lead_marketing_field_updated', $deal, [
            'comment' => CrmEventDescriptionBuilder::dealLeadMarketingFieldUpdated($fieldLabel, $oldDisplay, $newDisplay),
            'field_name' => $fieldName,
            'field_label' => $fieldLabel,
            'field_type' => $fieldType,
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'old_value_display' => $oldDisplay,
            'new_value_display' => $newDisplay,
            'lead_id' => $deal->lead_id,
        ], $this->generationTypeForCurrentUser());
    }

    public function recordParticipantsUpdated(Deal $deal, array $oldParticipantIds, array $newParticipantIds, array $oldParticipantNames, array $newParticipantNames): void
    {
        $addedIds = array_values(array_diff($newParticipantIds, $oldParticipantIds));
        $removedIds = array_values(array_diff($oldParticipantIds, $newParticipantIds));

        if (empty($addedIds) && empty($removedIds)) {
            return;
        }

        $addedNames = array_values(array_filter(array_map(fn ($id) => $newParticipantNames[$id] ?? null, $addedIds)));
        $removedNames = array_values(array_filter(array_map(fn ($id) => $oldParticipantNames[$id] ?? null, $removedIds)));
        $commentParts = [];

        if (!empty($addedNames)) {
            $commentParts[] = 'added ' . implode(', ', $addedNames);
        }
        if (!empty($removedNames)) {
            $commentParts[] = 'removed ' . implode(', ', $removedNames);
        }

        $comment = 'Deal participants updated';
        if (!empty($commentParts)) {
            $comment .= ': ' . implode('; ', $commentParts);
        }

        $this->record('deal_participants_updated', $deal, [
            'comment' => $comment,
            'old_participant_ids' => array_values($oldParticipantIds),
            'new_participant_ids' => array_values($newParticipantIds),
            'old_participant_names' => array_values($oldParticipantNames),
            'new_participant_names' => array_values($newParticipantNames),
            'added_participant_ids' => $addedIds,
            'removed_participant_ids' => $removedIds,
            'added_participant_names' => $addedNames ?: null,
            'removed_participant_names' => $removedNames ?: null,
        ]);
    }

    public function recordAnalysisCompleted(Deal $deal, string $completionType, int $unfilledCount): void
    {
        $this->record('deal_analysis_completed', $deal, [
            'completion_type' => $completionType,
            'unfilled_fields' => $unfilledCount,
        ]);
    }

    // ─── Core recording logic ────────────────────────────────────

    /**
     * Record a CRM event tied to a deal with system_generated type and shared correlation.
     */
    protected function record(
        string $eventTypeSlug,
        Deal $deal,
        array $metadata,
        CrmEventGenerationType $generationType = CrmEventGenerationType::SYSTEM_GENERATED
    ): void {
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
                'generation_type' => $generationType->value,
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

            if ($event === null && in_array($eventTypeSlug, [
                'deal_custom_field_updated',
                'deal_hibarr_field_updated',
                'deal_lead_marketing_field_updated',
            ], true)) {
                Log::warning('[DealActivityEventService::record] Event was not persisted. Run: php artisan db:seed --class=CrmEventSeeder', [
                    'slug' => $eventTypeSlug,
                    'deal_id' => $deal->id,
                    'company_id' => $deal->company_id,
                ]);
            }

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

    protected function generationTypeForCurrentUser(): CrmEventGenerationType
    {
        return auth()->check()
            ? CrmEventGenerationType::USER_GENERATED
            : CrmEventGenerationType::SYSTEM_GENERATED;
    }

    protected function normalizeCustomFieldValue(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return trim((string) $value);
    }

    protected function formatCustomFieldValueForDisplay(?string $value, ?string $fieldType = null): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $trimmed = trim($value);

        if ($fieldType === 'phone') {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded) && !empty($decoded['phone'])) {
                return (string) $decoded['phone'];
            }
        }

        if ($fieldType === 'file') {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                $count = count(array_filter($decoded));

                return $count > 1 ? "{$count} files" : '1 file';
            }

            return '1 file';
        }

        if (in_array($fieldType, ['checkbox', 'multiselect', 'multiSelectCountry'], true)) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded) && !empty($decoded)) {
                return implode(', ', $decoded);
            }

            return $trimmed;
        }

        if (in_array($fieldType, ['repeatable', 'json'], true)) {
            return Str::limit($trimmed, 120, '...');
        }

        return Str::limit($trimmed, 200, '...');
    }

    protected function formatAssociatableFieldValueForDisplay(?string $value, ?string $fieldType = null): ?string
    {
        if ($fieldType === 'boolean') {
            if ($value === null || $value === '') {
                return null;
            }

            return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true) ? 'Yes' : 'No';
        }

        if ($fieldType === 'date' && $value !== null && trim($value) !== '') {
            return CrmEventDescriptionBuilder::formatDate($value);
        }

        return $this->formatCustomFieldValueForDisplay($value, $fieldType);
    }
}
