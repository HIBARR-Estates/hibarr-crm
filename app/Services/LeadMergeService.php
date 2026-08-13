<?php

namespace App\Services;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadFlightItinerary;
use App\Models\LeadMarketing;
use App\Models\LeadNote;
use App\Models\LeadQualification;
use App\Models\Taskable;
use App\Models\User;
use App\Scopes\ActiveScope;
use App\Traits\RecordsCrmEvents;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

class LeadMergeService
{
    use RecordsCrmEvents;

    /** @var list<string> */
    private const CONTACT_FIELDS = [
        'client_email',
        'mobile',
        'cell',
        'office',
        'company_name',
        'address',
        'client_whatsapp',
        'client_telegram',
        'client_instagram',
    ];

    /** @var list<string> */
    private const UNIQUE_CHANNEL_FIELDS = [
        'client_email',
        'client_whatsapp',
        'client_telegram',
        'client_instagram',
    ];

    /** @var list<string> */
    private const OWNERSHIP_FIELDS = [
        'lead_owner',
        'added_by',
        'client_id',
        'agent_id',
    ];

    /**
     * Merge $duplicate into $primary. Rolls back entirely on failure.
     *
     * @param  array<string, int|null>  $ownershipFieldPicks
     */
    public function merge(
        Lead $primary,
        Lead $duplicate,
        array $ownershipFieldPicks = [],
        ?int $actorUserId = null,
    ): Lead {
        $this->assertCanMerge($primary, $duplicate);

        return DB::transaction(function () use ($primary, $duplicate, $ownershipFieldPicks, $actorUserId) {
            $primary = Lead::query()->lockForUpdate()->findOrFail($primary->id);
            $duplicate = Lead::query()->lockForUpdate()->findOrFail($duplicate->id);

            $this->assertCanMerge($primary, $duplicate);

            $contactConflicts = $this->fillContactFieldsAndCollectConflicts($primary, $duplicate);
            $customFieldConflicts = $this->reassignCustomFields($primary, $duplicate);

            $this->createConflictNoteIfNeeded(
                $primary,
                $duplicate,
                $contactConflicts,
                $customFieldConflicts,
                $actorUserId,
            );

            $this->applyOwnershipPicks($primary, $ownershipFieldPicks, $actorUserId);

            // Free unique channel values on the duplicate before saving the primary.
            // Otherwise copying an empty primary field from the duplicate hits
            // leads_client_email_unique (and similar indexes) while the duplicate still holds the value.
            $this->invalidateUniqueChannelFields($duplicate);

            $primary->save();

            $this->reassignRelatedRecords($primary, $duplicate);
            $this->mergeMarketing($primary, $duplicate);

            $duplicate->merged_into_lead_id = $primary->id;
            $duplicate->save();
            $duplicate->delete();

            $this->recordCrmEvent('lead_merged', $primary, [
                'user_id' => $actorUserId,
                'metadata' => [
                    'comment' => 'Lead merged',
                    'duplicate_id' => $duplicate->id,
                    'primary_id' => $primary->id,
                    'ownership_picks' => array_intersect_key(
                        $ownershipFieldPicks,
                        array_flip(self::OWNERSHIP_FIELDS),
                    ),
                ],
            ]);

            return $primary->fresh();
        });
    }

    /**
     * Read-only preview for the merge review screen (HIB-1120): connected-record
     * counts for both leads, contact-field conflicts, and ownership-field values.
     * Throws the same InvalidArgumentException as merge() for an invalid pair.
     */
    public function buildReview(Lead $primary, Lead $duplicate): array
    {
        $this->assertCanMerge($primary, $duplicate);

        return [
            'contact_conflicts' => $this->diffContactFields($primary, $duplicate),
            'ownership_fields' => $this->buildOwnershipFieldsView($primary, $duplicate),
            'counts' => [
                'primary' => $this->connectedRecordCounts($primary),
                'duplicate' => $this->connectedRecordCounts($duplicate),
            ],
        ];
    }

    /**
     * @return array<string, array{primary: mixed, duplicate: mixed}>
     */
    private function diffContactFields(Lead $primary, Lead $duplicate): array
    {
        $conflicts = [];

        foreach (self::CONTACT_FIELDS as $field) {
            if (!Schema::hasColumn('leads', $field)) {
                continue;
            }

            $primaryValue = $primary->{$field};
            $duplicateValue = $duplicate->{$field};

            if (
                !$this->isEmptyValue($primaryValue)
                && !$this->isEmptyValue($duplicateValue)
                && (string) $primaryValue !== (string) $duplicateValue
            ) {
                $conflicts[$field] = [
                    'primary' => $primaryValue,
                    'duplicate' => $duplicateValue,
                ];
            }
        }

        return $conflicts;
    }

    /**
     * @return list<array{field: string, primary_value: int|null, primary_label: string|null, duplicate_value: int|null, duplicate_label: string|null, differs: bool}>
     */
    private function buildOwnershipFieldsView(Lead $primary, Lead $duplicate): array
    {
        $fields = [];

        foreach (self::OWNERSHIP_FIELDS as $field) {
            if (!Schema::hasColumn('leads', $field)) {
                continue;
            }

            $primaryValue = $primary->{$field} === null ? null : (int) $primary->{$field};
            $duplicateValue = $duplicate->{$field} === null ? null : (int) $duplicate->{$field};

            $fields[] = [
                'field' => $field,
                'primary_value' => $primaryValue,
                'primary_label' => $this->resolveOwnershipLabel($field, $primaryValue),
                'duplicate_value' => $duplicateValue,
                'duplicate_label' => $this->resolveOwnershipLabel($field, $duplicateValue),
                'differs' => $primaryValue !== $duplicateValue,
            ];
        }

        return $fields;
    }

    private function resolveOwnershipLabel(string $field, ?int $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if ($field === 'agent_id') {
            return LeadAgent::query()->find($value)?->user?->name;
        }

        return User::withoutGlobalScope(ActiveScope::class)->find($value)?->name;
    }

    /**
     * @return array{deals: int, notes: int, follow_ups: int, qualifications: int, communication_activities: int, tasks: int, flight_itineraries: int}
     */
    private function connectedRecordCounts(Lead $lead): array
    {
        return [
            'deals' => Deal::query()->where('lead_id', $lead->id)->count(),
            'notes' => LeadNote::query()->where('lead_id', $lead->id)->count(),
            'follow_ups' => DealFollowUp::query()->where('lead_id', $lead->id)->count(),
            'qualifications' => LeadQualification::query()->where('lead_id', $lead->id)->count(),
            'communication_activities' => CommunicationActivity::query()->where('lead_id', $lead->id)->count(),
            'tasks' => Taskable::query()
                ->where('taskable_type', Lead::class)
                ->where('taskable_id', $lead->id)
                ->count(),
            'flight_itineraries' => LeadFlightItinerary::query()->where('lead_id', $lead->id)->count(),
        ];
    }

    private function assertCanMerge(Lead $primary, Lead $duplicate): void
    {
        if ($primary->id === $duplicate->id) {
            throw new InvalidArgumentException('Cannot merge a lead into itself.');
        }

        if ((int) $primary->company_id !== (int) $duplicate->company_id) {
            throw new InvalidArgumentException('Leads must belong to the same company.');
        }

        if ($primary->trashed()) {
            throw new InvalidArgumentException('Primary lead is soft-deleted.');
        }

        if ($duplicate->trashed()) {
            throw new InvalidArgumentException('Duplicate lead is already soft-deleted.');
        }

        if ($duplicate->merged_into_lead_id) {
            throw new InvalidArgumentException('Duplicate lead was already merged.');
        }
    }

    /**
     * @return array<string, array{primary: mixed, duplicate: mixed}>
     */
    private function fillContactFieldsAndCollectConflicts(Lead $primary, Lead $duplicate): array
    {
        $conflicts = [];

        foreach (self::CONTACT_FIELDS as $field) {
            if (!Schema::hasColumn('leads', $field)) {
                continue;
            }

            $primaryValue = $primary->{$field};
            $duplicateValue = $duplicate->{$field};

            $primaryEmpty = $this->isEmptyValue($primaryValue);
            $duplicateEmpty = $this->isEmptyValue($duplicateValue);

            if ($primaryEmpty && !$duplicateEmpty) {
                $primary->{$field} = $duplicateValue;
                continue;
            }

            if (!$primaryEmpty && !$duplicateEmpty && (string) $primaryValue !== (string) $duplicateValue) {
                $conflicts[$field] = [
                    'primary' => $primaryValue,
                    'duplicate' => $duplicateValue,
                ];
            }
        }

        return $conflicts;
    }

    private function isEmptyValue(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }

        if (is_string($value) && trim($value) === '') {
            return true;
        }

        return false;
    }

    /**
     * Reassign custom field rows from duplicate → primary when primary has none.
     * Conflicting duplicate rows stay on duplicate and are returned for the conflict note.
     *
     * @return array<int, array{custom_field_id: int, value: string}>
     */
    private function reassignCustomFields(Lead $primary, Lead $duplicate): array
    {
        if (!Schema::hasTable('custom_fields_data')) {
            return [];
        }

        $model = Lead::CUSTOM_FIELD_MODEL;
        $conflicts = [];

        $duplicateRows = DB::table('custom_fields_data')
            ->where('model', $model)
            ->where('model_id', $duplicate->id)
            ->get();

        foreach ($duplicateRows as $row) {
            $primaryRow = DB::table('custom_fields_data')
                ->where('model', $model)
                ->where('model_id', $primary->id)
                ->where('custom_field_id', $row->custom_field_id)
                ->first();

            if (!$primaryRow || $this->isEmptyValue($primaryRow->value ?? null)) {
                if ($primaryRow && $this->isEmptyValue($primaryRow->value ?? null)) {
                    DB::table('custom_fields_data')->where('id', $primaryRow->id)->delete();
                }

                DB::table('custom_fields_data')
                    ->where('id', $row->id)
                    ->update(['model_id' => $primary->id]);

                continue;
            }

            if ((string) $primaryRow->value !== (string) $row->value) {
                $conflicts[] = [
                    'custom_field_id' => (int) $row->custom_field_id,
                    'value' => (string) $row->value,
                ];
            }
        }

        return $conflicts;
    }

    /**
     * @param  array<string, array{primary: mixed, duplicate: mixed}>  $contactConflicts
     * @param  array<int, array{custom_field_id: int, value: string}>  $customFieldConflicts
     */
    private function createConflictNoteIfNeeded(
        Lead $primary,
        Lead $duplicate,
        array $contactConflicts,
        array $customFieldConflicts,
        ?int $actorUserId,
    ): void {
        if ($contactConflicts === [] && $customFieldConflicts === []) {
            return;
        }

        $lines = [
            'Merged from lead #' . $duplicate->id . ' (' . ($duplicate->client_name ?? 'unnamed') . ').',
            'Kept primary values; discarded duplicate values below:',
            '',
        ];

        foreach ($contactConflicts as $field => $values) {
            $lines[] = sprintf(
                '- %s: kept "%s"; discarded "%s"',
                $field,
                $this->stringifyForNote($values['primary']),
                $this->stringifyForNote($values['duplicate']),
            );
        }

        foreach ($customFieldConflicts as $conflict) {
            $lines[] = sprintf(
                '- custom_field_%d: discarded "%s"',
                $conflict['custom_field_id'],
                $this->stringifyForNote($conflict['value']),
            );
        }

        $note = new LeadNote();
        $note->lead_id = $primary->id;
        $note->title = 'Merged lead — previous contact details';
        $note->details = trim_editor(implode("\n", $lines));
        $note->type = 0;

        if ($actorUserId !== null) {
            $note->added_by = $actorUserId;
            $note->last_updated_by = $actorUserId;
        }

        $note->save();
    }

    private function stringifyForNote(mixed $value): string
    {
        if (is_array($value) || is_object($value)) {
            return json_encode($value) ?: '';
        }

        return (string) $value;
    }

    /**
     * @param  array<string, int|null>  $ownershipFieldPicks
     */
    private function applyOwnershipPicks(Lead $primary, array $ownershipFieldPicks, ?int $actorUserId): void
    {
        foreach (self::OWNERSHIP_FIELDS as $field) {
            if (!array_key_exists($field, $ownershipFieldPicks)) {
                continue;
            }

            if (!Schema::hasColumn('leads', $field)) {
                continue;
            }

            $primary->{$field} = $ownershipFieldPicks[$field];
        }

        if ($actorUserId !== null && Schema::hasColumn('leads', 'last_updated_by')) {
            $primary->last_updated_by = $actorUserId;
        }
    }

    private function reassignRelatedRecords(Lead $primary, Lead $duplicate): void
    {
        $fromId = $duplicate->id;
        $toId = $primary->id;

        Deal::withoutEvents(function () use ($fromId, $toId) {
            Deal::query()->where('lead_id', $fromId)->update(['lead_id' => $toId]);
        });

        LeadNote::withoutEvents(function () use ($fromId, $toId) {
            LeadNote::query()->where('lead_id', $fromId)->update(['lead_id' => $toId]);
        });

        LeadQualification::withoutEvents(function () use ($fromId, $toId) {
            LeadQualification::query()->where('lead_id', $fromId)->update(['lead_id' => $toId]);
        });

        DealFollowUp::withoutEvents(function () use ($fromId, $toId) {
            DealFollowUp::query()->where('lead_id', $fromId)->update(['lead_id' => $toId]);
        });

        CommunicationActivity::withoutEvents(function () use ($fromId, $toId) {
            CommunicationActivity::query()->where('lead_id', $fromId)->update(['lead_id' => $toId]);
        });

        LeadFlightItinerary::withoutEvents(function () use ($fromId, $toId) {
            LeadFlightItinerary::query()->where('lead_id', $fromId)->update(['lead_id' => $toId]);
        });

        $this->reassignTaskables($fromId, $toId);
    }

    private function reassignTaskables(int $fromLeadId, int $toLeadId): void
    {
        if (!Schema::hasTable('taskables')) {
            return;
        }

        $type = Lead::class;

        $existingTaskIds = Taskable::query()
            ->where('taskable_type', $type)
            ->where('taskable_id', $toLeadId)
            ->pluck('task_id')
            ->all();

        Taskable::query()
            ->where('taskable_type', $type)
            ->where('taskable_id', $fromLeadId)
            ->whereIn('task_id', $existingTaskIds)
            ->delete();

        Taskable::query()
            ->where('taskable_type', $type)
            ->where('taskable_id', $fromLeadId)
            ->update(['taskable_id' => $toLeadId]);
    }

    private function mergeMarketing(Lead $primary, Lead $duplicate): void
    {
        if (!Schema::hasTable('lead_marketing')) {
            return;
        }

        $primaryMarketing = LeadMarketing::query()->where('lead_id', $primary->id)->first();
        $duplicateMarketing = LeadMarketing::query()->where('lead_id', $duplicate->id)->first();

        if ($primaryMarketing && $duplicateMarketing) {
            $duplicateMarketing->delete();

            return;
        }

        if (!$primaryMarketing && $duplicateMarketing) {
            $duplicateMarketing->lead_id = $primary->id;
            $duplicateMarketing->save();
        }
    }

    private function invalidateUniqueChannelFields(Lead $duplicate): void
    {
        foreach (self::UNIQUE_CHANNEL_FIELDS as $field) {
            if (!Schema::hasColumn('leads', $field)) {
                continue;
            }

            $original = $duplicate->{$field};

            if ($this->isEmptyValue($original)) {
                continue;
            }

            $duplicate->{$field} = $this->buildInvalidatedUniqueValue((string) $original, $field);
        }

        $duplicate->save();
    }

    private function buildInvalidatedUniqueValue(string $original, string $field): string
    {
        $prefix = 'invalid_lead_' . Str::random(8) . '_';
        $maxLength = $this->stringColumnMaxLength($field);
        $available = max(0, $maxLength - strlen($prefix));

        return $prefix . substr($original, 0, $available);
    }

    private function stringColumnMaxLength(string $column): int
    {
        try {
            $type = Schema::getColumnType('leads', $column);
            // Default Laravel string columns are 255; fall back safely.
            if (in_array($type, ['string', 'varchar'], true)) {
                return 255;
            }
        } catch (Throwable) {
            // ignore
        }

        return 255;
    }
}
