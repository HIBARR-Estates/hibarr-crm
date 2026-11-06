<?php

namespace App\Services;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadContactMethod;
use App\Models\LeadFlightItinerary;
use App\Models\LeadMarketing;
use App\Models\LeadUtmTouch;
use App\Models\LeadNote;
use App\Models\LeadQualification;
use App\Models\Taskable;
use App\Models\User;
use App\Notifications\LeadMerged;
use App\Services\LeadMerge\LeadMergeFields;
use App\Support\LeadMergeContext;
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

    /** @var array<string, true>|null */
    private ?array $marketingColumns = null;

    /** Columns per table, read once per merge or review. @var array<string, array<string, true>|null> */
    private array $tableColumns = [];

    public function __construct(
        private LeadContactMethodService $contactMethodService,
    ) {
    }

    /** @var list<string> */
    private const UNIQUE_CHANNEL_FIELDS = [
        'client_email',
        'client_whatsapp',
        'client_telegram',
        'client_instagram',
    ];

    /** Engagement flags on lead_marketing: true on either lead stays true. @var list<string> */
    public const MARKETING_FLAGS = [
        'has_registered_for_the_webinar',
        'has_attended_the_webinar',
        'registered_for_zoom_meeting',
        'has_downloaded_the_ebook',
        'has_joined_the_facebook_group',
        'has_joined_the_whatsapp_group',
    ];

    /** lead_marketing columns filled from the duplicate when the kept lead has none. @var list<string> */
    private const MARKETING_FILL_FIELDS = [
        'traffic_source_id',
        'facebook_click_id',
        'facebook_lead_id',
        'facebook_browser_id',
        'user_agent',
        'ip_address',
    ];

    /**
     * Tables whose rows belong to a lead through a plain lead_id column and
     * simply move to the kept lead. (Deals, notes, qualifications, follow-ups,
     * activities and itineraries move through their models, above.)
     *
     * @var list<string>
     */
    private const LEAD_ID_TABLES = [
        'lead_contact_files',
        'deal_exposes',
        'expose_snapshots',
        'proposals',
        'proposal_templates',
        'removal_requests_lead',
        'lead_products',
        'partner_flags',
        'sally_meeting_insights',
        'sally_suggestion_logs',
        'deal_notes',
        'deal_files',
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
     * $fieldPicks says, for a value both leads hold differently, which lead's
     * value the kept lead ends up with: ['client_email' => 'duplicate',
     * 'custom:12' => 'duplicate', 'marketing:contact_score' => 'primary', ...].
     * Anything not picked keeps the kept lead's value (or, for the lead score,
     * the higher one). $ownershipFieldPicks (explicit user ids) is the older
     * form and wins over a field pick for the same column.
     *
     * @param  array<string, int|null>  $ownershipFieldPicks
     * @param  array<string, string>  $fieldPicks
     */
    public function merge(
        Lead $primary,
        Lead $duplicate,
        array $ownershipFieldPicks = [],
        ?int $actorUserId = null,
        array $fieldPicks = [],
    ): Lead {
        $this->resetSchemaCaches();
        $this->assertCanMerge($primary, $duplicate);

        // The duplicate's owner before the merge, for the "Lead merged" notice.
        $duplicateOwnerId = $duplicate->lead_owner !== null ? (int) $duplicate->lead_owner : null;

        // Both leads are marked for the whole merge so the Lead observer skips
        // automations, the "Lead removed from pipeline" notice and the separate
        // owner-assigned email for the merge's own saves and soft delete.
        $merged = LeadMergeContext::run(
            [(int) $primary->id, (int) $duplicate->id],
            fn () => $this->mergeInTransaction($primary, $duplicate, $ownershipFieldPicks, $actorUserId, $fieldPicks),
        );

        $this->notifyOwners($merged, $duplicate->id, $duplicateOwnerId, $actorUserId);

        return $merged;
    }

    /**
     * @param  array<string, int|null>  $ownershipFieldPicks
     * @param  array<string, string>  $fieldPicks
     */
    private function mergeInTransaction(
        Lead $primary,
        Lead $duplicate,
        array $ownershipFieldPicks,
        ?int $actorUserId,
        array $fieldPicks,
    ): Lead {
        return DB::transaction(function () use ($primary, $duplicate, $ownershipFieldPicks, $actorUserId, $fieldPicks) {
            $primary = Lead::query()->lockForUpdate()->findOrFail($primary->id);
            $duplicate = Lead::query()->lockForUpdate()->findOrFail($duplicate->id);

            $this->assertCanMerge($primary, $duplicate);

            ['set_aside' => $setAside, 'contact_conflicts' => $contactConflicts]
                = $this->mergeLeadFields($primary, $duplicate, $fieldPicks);
            $this->mergeLanguages($primary, $duplicate);
            $customFieldSetAside = $this->reassignCustomFields($primary, $duplicate, $fieldPicks);
            $marketingSetAside = $this->mergeMarketing($primary, $duplicate, $fieldPicks);

            $this->createConflictNoteIfNeeded(
                $primary,
                $duplicate,
                array_merge($setAside, $customFieldSetAside, $marketingSetAside),
                $actorUserId,
            );

            $this->applyOwnershipPicks($primary, $ownershipFieldPicks, $actorUserId);

            $this->contactMethodService->absorbFromLead($primary, $duplicate, $contactConflicts);

            // Free unique channel values on the duplicate before saving the primary.
            // Otherwise copying an empty primary field from the duplicate hits
            // leads_client_email_unique (and similar indexes) while the duplicate still holds the value.
            Lead::withoutEvents(function () use ($duplicate) {
                $this->invalidateUniqueChannelFields($duplicate);
            });

            $primary->save();

            $this->reassignRelatedRecords($primary, $duplicate);
            $this->mergeCategories($primary, $duplicate);

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
                    'field_picks' => array_filter($fieldPicks, fn ($side) => $side === 'duplicate'),
                ],
            ]);

            return $primary->fresh(['contactMethods']);
        });
    }

    /**
     * Tell the owners of both leads (once each, never the person who merged)
     * what happened: which lead the duplicate went into, and who owns it now.
     * Sent after the transaction commits; a failure here never undoes a merge.
     */
    private function notifyOwners(Lead $kept, int $duplicateId, ?int $duplicateOwnerId, ?int $actorUserId): void
    {
        try {
            $duplicate = Lead::withTrashed()->find($duplicateId);
            if ($duplicate === null) {
                return;
            }

            $kept->loadMissing(['company']);
            $ownerIds = array_values(array_unique(array_filter([
                $duplicateOwnerId,
                $kept->lead_owner !== null ? (int) $kept->lead_owner : null,
            ], fn ($id) => $id !== null && $id !== $actorUserId)));

            if ($ownerIds === []) {
                return;
            }

            // Deactivated users are included: they still get the in-app notice
            // (LeadMerged::via only mails active users), and a deactivated
            // actor is still named rather than shown as "a team member".
            $recipients = User::withoutGlobalScope(ActiveScope::class)->whereIn('id', $ownerIds)->get();
            $actor = $actorUserId !== null
                ? User::withoutGlobalScope(ActiveScope::class)->find($actorUserId)
                : null;

            \Illuminate\Support\Facades\Notification::send($recipients, new LeadMerged($kept, $duplicate, $actor));
        } catch (Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Failed to notify owners after lead merge', [
                'kept_lead_id' => $kept->id,
                'duplicate_lead_id' => $duplicateId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Read-only preview for the merge modal: every field both leads hold
     * (grouped as the modal shows them), what combines automatically, and how
     * many records of each kind move from the duplicate to the kept lead.
     * Throws the same InvalidArgumentException as merge() for an invalid pair.
     */
    public function buildReview(Lead $primary, Lead $duplicate): array
    {
        $this->resetSchemaCaches();
        $this->assertCanMerge($primary, $duplicate);

        return [
            'contact_conflicts' => $this->diffContactFields($primary, $duplicate),
            'ownership_fields' => $this->buildOwnershipFieldsView($primary, $duplicate),
            'counts' => [
                'primary' => $this->connectedRecordCounts($primary),
                'duplicate' => $this->connectedRecordCounts($duplicate),
            ],
            'field_groups' => $this->buildFieldGroupsView($primary, $duplicate),
            'combined' => $this->buildCombinedView($primary, $duplicate),
            'moves' => $this->movedRecordCounts($duplicate),
        ];
    }

    /**
     * One row per field either lead holds. state: "same" (equal), "fill" (only
     * the duplicate has it, so it is copied), "keep" (only the kept lead has
     * it) or "choose" (both differ; default_pick says which one wins unless
     * the person picks the other).
     *
     * @return list<array{key: string, rows: list<array<string, mixed>>}>
     */
    private function buildFieldGroupsView(Lead $primary, Lead $duplicate): array
    {
        $groups = [];

        foreach (LeadMergeFields::groups() as $group => $fields) {
            $rows = [];
            foreach ($fields as $field) {
                $row = $this->fieldRow(
                    $field,
                    LeadMergeFields::LABELS[$field] ?? Str::headline($field),
                    LeadMergeFields::raw($primary, $field),
                    LeadMergeFields::raw($duplicate, $field),
                    LeadMergeFields::display($primary, $field),
                    LeadMergeFields::display($duplicate, $field),
                );
                if ($row !== null) {
                    if ($row['state'] === 'choose' && in_array($field, LeadMergeFields::ALTERNATE_CONTACT_FIELDS, true)) {
                        $row['hint'] = 'kept_as_alternate';
                    }
                    if ($row['state'] === 'choose' && in_array($field, LeadMergeFields::LOCKED_FIELDS, true)) {
                        $row['state'] = 'locked';
                        $row['hint'] = 'referrer_locked';
                    }
                    $rows[] = $row;
                }
            }
            $groups[] = ['key' => $group, 'rows' => $rows];
        }

        $groups[] = ['key' => 'marketing', 'rows' => $this->marketingRows($primary, $duplicate)];
        $groups[] = ['key' => 'custom', 'rows' => $this->customFieldRows($primary, $duplicate)];

        return array_values(array_filter($groups, fn ($g) => $g['rows'] !== []));
    }

    /**
     * @return array<string, mixed>|null
     */
    private function fieldRow(
        string $key,
        string $label,
        ?string $primaryRaw,
        ?string $duplicateRaw,
        ?string $primaryDisplay,
        ?string $duplicateDisplay,
        string $defaultPick = 'primary',
    ): ?array {
        if ($primaryRaw === null && $duplicateRaw === null) {
            return null;
        }

        $state = match (true) {
            $primaryRaw === $duplicateRaw => 'same',
            $primaryRaw === null => 'fill',
            $duplicateRaw === null => 'keep',
            default => 'choose',
        };

        return [
            'key' => $key,
            'label' => $label,
            'primary' => $primaryDisplay ?? $primaryRaw,
            'duplicate' => $duplicateDisplay ?? $duplicateRaw,
            'state' => $state,
            'default_pick' => $state === 'choose' ? $defaultPick : ($state === 'fill' ? 'duplicate' : 'primary'),
            'hint' => null,
        ];
    }

    /** @return list<array<string, mixed>> */
    private function marketingRows(Lead $primary, Lead $duplicate): array
    {
        if (! Schema::hasTable('lead_marketing')) {
            return [];
        }

        $p = LeadMarketing::query()->where('lead_id', $primary->id)->first();
        $d = LeadMarketing::query()->where('lead_id', $duplicate->id)->first();
        $rows = [];

        if ($this->marketingHasColumn('contact_score')) {
            $ps = $p?->contact_score;
            $ds = $d?->contact_score;
            $row = $this->fieldRow(
                'marketing:contact_score',
                LeadMergeFields::LABELS['contact_score'],
                $ps === null ? null : (string) $ps,
                $ds === null ? null : (string) $ds,
                null,
                null,
                $ps !== null && $ds !== null && $ds > $ps ? 'duplicate' : 'primary',
            );
            if ($row !== null) {
                if ($row['state'] === 'choose') {
                    $row['hint'] = 'higher_score';
                }
                $rows[] = $row;
            }
        }

        if ($this->marketingHasColumn('traffic_source_id')) {
            $row = $this->fieldRow(
                'marketing:traffic_source_id',
                LeadMergeFields::LABELS['traffic_source_id'],
                filled($p?->traffic_source_id) ? (string) $p->traffic_source_id : null,
                filled($d?->traffic_source_id) ? (string) $d->traffic_source_id : null,
                null,
                null,
            );
            if ($row !== null) {
                $rows[] = $row;
            }
        }

        $pt = $this->utmLabel($p);
        $dt = $this->utmLabel($d);
        $row = $this->fieldRow(
            'marketing:first_touch',
            'First touch (UTM)',
            $pt,
            $dt,
            null,
            null,
            $this->defaultFirstTouchPick($p, $d),
        );
        if ($row !== null) {
            if ($row['state'] === 'choose') {
                $row['hint'] = 'touch_history';
            }
            $rows[] = $row;
        }

        return $rows;
    }

    /** "source / medium / campaign" for a marketing row's first touch, or null without UTM data. */
    private function utmLabel(?LeadMarketing $marketing): ?string
    {
        if (! $marketing || ! $this->hasUtm($marketing)) {
            return null;
        }

        $parts = array_filter([$marketing->utm_source, $marketing->utm_medium, $marketing->utm_campaign], 'filled');

        return $parts !== [] ? implode(' / ', $parts) : (string) collect($marketing->only(LeadUtmTouch::UTM_FIELDS))->filter()->first();
    }

    /** The earlier of the two first touches stays first unless the person picks the other. */
    private function defaultFirstTouchPick(?LeadMarketing $primary, ?LeadMarketing $duplicate): string
    {
        if ($primary?->created_at && $duplicate?->created_at && $duplicate->created_at->lt($primary->created_at)) {
            return 'duplicate';
        }

        return 'primary';
    }

    /** @return list<array<string, mixed>> */
    private function customFieldRows(Lead $primary, Lead $duplicate): array
    {
        if (! Schema::hasTable('custom_fields_data')) {
            return [];
        }

        $model = Lead::CUSTOM_FIELD_MODEL;
        $values = DB::table('custom_fields_data')
            ->where('model', $model)
            ->whereIn('model_id', [$primary->id, $duplicate->id])
            ->get(['custom_field_id', 'model_id', 'value']);

        if ($values->isEmpty()) {
            return [];
        }

        $labels = Schema::hasTable('custom_fields')
            ? DB::table('custom_fields')->whereIn('id', $values->pluck('custom_field_id')->unique()->all())->pluck('label', 'id')
            : collect();

        $rows = [];
        foreach ($values->groupBy('custom_field_id') as $fieldId => $rowsForField) {
            $pv = $rowsForField->firstWhere('model_id', $primary->id)?->value;
            $dv = $rowsForField->firstWhere('model_id', $duplicate->id)?->value;
            $row = $this->fieldRow(
                'custom:'.$fieldId,
                (string) ($labels[$fieldId] ?? 'Custom field #'.$fieldId),
                $this->isEmptyValue($pv) ? null : trim((string) $pv),
                $this->isEmptyValue($dv) ? null : trim((string) $dv),
                null,
                null,
            );
            if ($row !== null) {
                $row['custom'] = true;
                $rows[] = $row;
            }
        }

        return $rows;
    }

    /**
     * What combines on its own: languages and categories are joined, an
     * engagement flag set on either lead stays set, and the latest webinar
     * date wins. (The first UTM touch is a pick: see marketingRows.)
     *
     * @return array<string, mixed>
     */
    private function buildCombinedView(Lead $primary, Lead $duplicate): array
    {
        $combined = [];

        if (LeadMergeFields::hasLeadColumn('languages')) {
            $pl = array_values(array_filter((array) ($primary->languages ?? [])));
            $dl = array_values(array_filter((array) ($duplicate->languages ?? [])));
            if ($pl !== [] || $dl !== []) {
                $combined['languages'] = [
                    'primary' => $pl,
                    'duplicate' => $dl,
                    'result' => array_values(array_unique(array_merge($pl, $dl))),
                ];
            }
        }

        if (Schema::hasTable('lead_lead_category') && Schema::hasTable('lead_category')) {
            $names = fn (Lead $lead) => DB::table('lead_lead_category')
                ->join('lead_category', 'lead_category.id', '=', 'lead_lead_category.lead_category_id')
                ->where('lead_lead_category.lead_id', $lead->id)
                ->orderBy('lead_category.category_name')
                ->pluck('lead_category.category_name')
                ->all();
            $pc = $names($primary);
            $dc = $names($duplicate);
            if ($pc !== [] || $dc !== []) {
                $combined['categories'] = [
                    'primary' => $pc,
                    'duplicate' => $dc,
                    'result' => array_values(array_unique(array_merge($pc, $dc))),
                ];
            }
        }

        if (Schema::hasTable('lead_marketing')) {
            $p = LeadMarketing::query()->where('lead_id', $primary->id)->first();
            $d = LeadMarketing::query()->where('lead_id', $duplicate->id)->first();

            $flags = [];
            foreach (self::MARKETING_FLAGS as $flag) {
                if (! $this->marketingHasColumn($flag)) {
                    continue;
                }
                $pf = (bool) ($p?->{$flag} ?? false);
                $df = (bool) ($d?->{$flag} ?? false);
                if ($pf || $df) {
                    $flags[] = ['key' => $flag, 'primary' => $pf, 'duplicate' => $df, 'result' => true];
                }
            }
            if ($flags !== []) {
                $combined['engagement'] = $flags;
            }

            if ($this->marketingHasColumn('last_webinar_date') && ($p?->last_webinar_date || $d?->last_webinar_date)) {
                $dates = array_filter([$p?->last_webinar_date, $d?->last_webinar_date]);
                $combined['last_webinar_date'] = [
                    'primary' => $p?->last_webinar_date?->format('j M Y'),
                    'duplicate' => $d?->last_webinar_date?->format('j M Y'),
                    'result' => max($dates)->format('j M Y'),
                ];
            }
        }

        return $combined;
    }

    /**
     * @return array<string, array{primary: mixed, duplicate: mixed}>
     */
    private function diffContactFields(Lead $primary, Lead $duplicate): array
    {
        $conflicts = [];

        foreach (LeadMergeFields::groups()['contact'] as $field) {
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

    /**
     * How many records of each kind move from the duplicate to the kept lead,
     * for the modal's "Moves to the kept lead" summary.
     *
     * @return array<string, int>
     */
    private function movedRecordCounts(Lead $duplicate): array
    {
        $id = $duplicate->id;
        $count = function (string $table, string $column = 'lead_id', ?callable $scope = null) use ($id): int {
            if (! $this->tableHas($table, $column)) {
                return 0;
            }
            $query = DB::table($table)->where($column, $id);
            if ($this->tableHas($table, 'deleted_at')) {
                $query->whereNull('deleted_at');
            }
            if ($scope) {
                $scope($query);
            }

            return $query->count();
        };
        $leadTypes = $this->leadModelTypes();

        return [
            'deals' => $count('deals'),
            'notes' => $count('lead_notes'),
            'tasks' => $count('taskables', 'taskable_id', fn ($q) => $q->where('taskable_type', Lead::class)),
            'meetings' => $count('lead_follow_up'),
            'calls' => $count('call_recordings', 'entity_id', fn ($q) => $q->whereIn('entity_type', ['lead', Lead::class])),
            'files' => $count('lead_contact_files'),
            'exposes' => $count('deal_exposes') + $count('expose_snapshots'),
            'proposals' => $count('proposals'),
            'consents' => $count('purpose_consent_leads'),
            'products' => $count('lead_products'),
            'sally_insights' => $count('sally_meeting_insights'),
            'qualifications' => $count('lead_qualifications'),
            'communication_activities' => $count('communication_activities'),
            'flight_itineraries' => $count('lead_flight_itineraries'),
            'partner_flags' => $count('partner_flags'),
            'utm_touches' => $count('lead_utm_touches'),
            'timeline_events' => $count('crm_events', 'model_id', fn ($q) => $q->whereIn('model_type', $leadTypes)),
        ];
    }

    /** @return list<string> */
    private function leadModelTypes(): array
    {
        return array_values(array_unique([Lead::class, (new Lead())->getMorphClass(), 'lead']));
    }

    private function marketingHasColumn(string $column): bool
    {
        if ($this->marketingColumns === null) {
            $this->marketingColumns = Schema::hasTable('lead_marketing')
                ? array_fill_keys(Schema::getColumnListing('lead_marketing'), true)
                : [];
        }

        return isset($this->marketingColumns[$column]);
    }

    /** Whether a table (and, given one, a column on it) exists; one schema read per table. */
    private function tableHas(string $table, ?string $column = null): bool
    {
        if (! array_key_exists($table, $this->tableColumns)) {
            $this->tableColumns[$table] = Schema::hasTable($table)
                ? array_fill_keys(Schema::getColumnListing($table), true)
                : null;
        }

        $columns = $this->tableColumns[$table];

        return $columns !== null && ($column === null || isset($columns[$column]));
    }

    /** Column lists are read once per merge or review (the schema can change between tests). */
    private function resetSchemaCaches(): void
    {
        $this->marketingColumns = null;
        $this->tableColumns = [];
        LeadMergeFields::flush();
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
     * Copy each lead column the kept lead lacks from the duplicate, and where
     * both differ apply the person's pick (the kept lead's value by default).
     * Returns what was set aside, for the merge note, and the contact values
     * that lost, so they stay on the lead as additional contact methods.
     *
     * @param  array<string, string>  $fieldPicks
     * @return array{set_aside: list<array{label: string, set_aside: string, kept: string}>, contact_conflicts: array<string, array{primary: mixed, duplicate: mixed}>}
     */
    private function mergeLeadFields(Lead $primary, Lead $duplicate, array $fieldPicks): array
    {
        $setAside = [];
        $contactConflicts = [];

        foreach (LeadMergeFields::fields() as $field) {
            $kept = LeadMergeFields::raw($primary, $field);
            $other = LeadMergeFields::raw($duplicate, $field);

            if ($other === null || $kept === $other) {
                continue;
            }

            if ($kept === null) {
                $this->copyRawAttribute($primary, $duplicate, $field);
                continue;
            }

            // A referrer, once set, can't be changed (LeadObserver::saving
            // rejects it), so the kept lead's referrer always stays.
            $useDuplicate = ! in_array($field, LeadMergeFields::LOCKED_FIELDS, true)
                && ($fieldPicks[$field] ?? 'primary') === 'duplicate';
            $winner = $useDuplicate ? $duplicate : $primary;
            $loser = $useDuplicate ? $primary : $duplicate;

            $setAside[] = [
                'label' => LeadMergeFields::LABELS[$field] ?? Str::headline($field),
                'set_aside' => (string) LeadMergeFields::display($loser, $field),
                'kept' => (string) LeadMergeFields::display($winner, $field),
            ];

            if (in_array($field, LeadMergeFields::ALTERNATE_CONTACT_FIELDS, true)) {
                $contactConflicts[$field] = [
                    'primary' => $winner->getAttributes()[$field],
                    'duplicate' => $loser->getAttributes()[$field],
                ];
            }

            if ($useDuplicate) {
                $this->copyRawAttribute($primary, $duplicate, $field);
            }
        }

        return ['set_aside' => $setAside, 'contact_conflicts' => $contactConflicts];
    }

    /** Copy the stored value as is, so enum/date casts are not round-tripped. */
    private function copyRawAttribute(Lead $to, Lead $from, string $field): void
    {
        $attributes = $to->getAttributes();
        $attributes[$field] = $from->getAttributes()[$field] ?? null;
        $to->setRawAttributes($attributes);
    }

    /** Spoken languages are joined; the primary language is a normal pick. */
    private function mergeLanguages(Lead $primary, Lead $duplicate): void
    {
        if (! LeadMergeFields::hasLeadColumn('languages')) {
            return;
        }

        $kept = array_values(array_filter((array) ($primary->languages ?? [])));
        $joined = array_values(array_unique(array_merge($kept, array_filter((array) ($duplicate->languages ?? [])))));

        if ($joined !== $kept) {
            $primary->languages = $joined;
        }
    }

    /**
     * The kept lead ends up in every category either lead was in; its main
     * category is filled from the duplicate when it had none.
     */
    private function mergeCategories(Lead $primary, Lead $duplicate): void
    {
        if (LeadMergeFields::hasLeadColumn('category_id') && $primary->category_id === null && $duplicate->category_id !== null) {
            DB::table('leads')->where('id', $primary->id)->update(['category_id' => $duplicate->category_id]);
        }

        if (! Schema::hasTable('lead_lead_category')) {
            return;
        }

        $existing = DB::table('lead_lead_category')->where('lead_id', $primary->id)->pluck('lead_category_id')->all();

        DB::table('lead_lead_category')
            ->where('lead_id', $duplicate->id)
            ->whereIn('lead_category_id', $existing)
            ->delete();

        DB::table('lead_lead_category')
            ->where('lead_id', $duplicate->id)
            ->update(['lead_id' => $primary->id]);
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
     * Custom field values: the kept lead's empty ones are filled from the
     * duplicate; where both differ the pick decides ("custom:<id>" =>
     * "duplicate" takes the duplicate's value). The value set aside goes in
     * the merge note.
     *
     * @param  array<string, string>  $fieldPicks
     * @return list<array{label: string, set_aside: string, kept: string}>
     */
    private function reassignCustomFields(Lead $primary, Lead $duplicate, array $fieldPicks = []): array
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

            if ($this->isEmptyValue($row->value ?? null) || trim((string) $primaryRow->value) === trim((string) $row->value)) {
                continue;
            }

            $useDuplicate = ($fieldPicks['custom:'.$row->custom_field_id] ?? 'primary') === 'duplicate';

            if ($useDuplicate) {
                DB::table('custom_fields_data')->where('id', $primaryRow->id)->update(['value' => $row->value]);
            }

            $conflicts[] = [
                'custom_field_id' => (int) $row->custom_field_id,
                'set_aside' => (string) ($useDuplicate ? $primaryRow->value : $row->value),
                'kept' => (string) ($useDuplicate ? $row->value : $primaryRow->value),
            ];
        }

        if ($conflicts === []) {
            return [];
        }

        $labels = Schema::hasTable('custom_fields')
            ? DB::table('custom_fields')->whereIn('id', array_column($conflicts, 'custom_field_id'))->pluck('label', 'id')
            : collect();

        return array_map(fn (array $c) => [
            'label' => (string) ($labels[$c['custom_field_id']] ?? 'Custom field #'.$c['custom_field_id']),
            'set_aside' => $c['set_aside'],
            'kept' => $c['kept'],
        ], $conflicts);
    }

    /**
     * A note on the kept lead listing every value the merge set aside, so
     * nothing the duplicate held is lost without a trace.
     *
     * @param  list<array{label: string, set_aside: string, kept: string}>  $setAside
     */
    private function createConflictNoteIfNeeded(
        Lead $primary,
        Lead $duplicate,
        array $setAside,
        ?int $actorUserId,
    ): void {
        if ($setAside === []) {
            return;
        }

        $actorName = $actorUserId !== null
            ? (User::withoutGlobalScope(ActiveScope::class)->whereKey($actorUserId)->value('name') ?? null)
            : null;

        $intro = sprintf(
            'This lead was merged with the duplicate record <strong>%s</strong> (lead #%d) on %s%s.',
            e($duplicate->client_name ?: 'Unnamed lead'),
            $duplicate->id,
            e(now()->format('j F Y')),
            $actorName ? ' by '.e($actorName) : '',
        );

        $items = array_map(fn (array $item) => sprintf(
            '<li><strong>%s:</strong> %s <em>(this lead keeps %s)</em></li>',
            e($item['label']),
            e($item['set_aside']),
            e($item['kept']),
        ), $setAside);

        $html = '<p>'.$intro.'</p>'
            .'<p>Where both records held different information, one value was kept on this lead. '
            .'The values that were not kept are recorded here for reference:</p>'
            .'<ul>'.implode('', $items).'</ul>';

        $note = new LeadNote();
        $note->lead_id = $primary->id;
        $note->title = 'Merged record: details from the duplicate lead';
        $note->details = trim_editor($html);
        $note->type = 0;

        if ($actorUserId !== null) {
            $note->added_by = $actorUserId;
            $note->last_updated_by = $actorUserId;
        }

        $note->save();
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

        // Repair drifted meetings, including moved follow-ups whose deals
        // belong to a lead outside this merge.
        app(DealMeetingLeadLinker::class)->syncAll();

        CommunicationActivity::withoutEvents(function () use ($fromId, $toId) {
            CommunicationActivity::query()->where('lead_id', $fromId)->update(['lead_id' => $toId]);
        });

        LeadFlightItinerary::withoutEvents(function () use ($fromId, $toId) {
            LeadFlightItinerary::query()->where('lead_id', $fromId)->update(['lead_id' => $toId]);
        });

        $this->reassignTaskables($fromId, $toId);
        $this->reassignContactMethods($fromId, $toId);
        $this->reassignLeadIdTables($fromId, $toId);
    }

    /**
     * Everything else that hangs off a lead: files, exposés, proposals,
     * consents, products, partner flags, Sally insights (moved before the
     * duplicate is deleted, so its deleted hook has nothing to purge), the
     * timeline and call log, and call recordings.
     */
    private function reassignLeadIdTables(int $fromId, int $toId): void
    {
        $this->moveRowsNotOnKeptLead('lead_products', 'product_id', $fromId, $toId);
        $this->moveRowsNotOnKeptLead('purpose_consent_leads', 'purpose_consent_id', $fromId, $toId);

        foreach (self::LEAD_ID_TABLES as $table) {
            if ($this->tableHas($table, 'lead_id')) {
                DB::table($table)->where('lead_id', $fromId)->update(['lead_id' => $toId]);
            }
        }

        if ($this->tableHas('crm_events')) {
            DB::table('crm_events')
                ->whereIn('model_type', $this->leadModelTypes())
                ->where('model_id', $fromId)
                ->update(['model_id' => $toId]);
        }

        if ($this->tableHas('call_recordings')) {
            DB::table('call_recordings')
                ->whereIn('entity_type', ['lead', Lead::class])
                ->where('entity_id', $fromId)
                ->update(['entity_id' => $toId]);
        }
    }

    /** Move a link table's rows, dropping those the kept lead already has. */
    private function moveRowsNotOnKeptLead(string $table, string $column, int $fromId, int $toId): void
    {
        if (! $this->tableHas($table, 'lead_id') || ! $this->tableHas($table, $column)) {
            return;
        }

        $existing = DB::table($table)->where('lead_id', $toId)->pluck($column)->all();

        DB::table($table)->where('lead_id', $fromId)->whereIn($column, $existing)->delete();
        DB::table($table)->where('lead_id', $fromId)->update(['lead_id' => $toId]);
    }

    private function reassignContactMethods(int $fromLeadId, int $toLeadId): void
    {
        if (! Schema::hasTable('lead_contact_methods')) {
            return;
        }

        $primaryKeys = LeadContactMethod::query()
            ->where('lead_id', $toLeadId)
            ->get(['type', 'normalized']);

        if ($primaryKeys->isNotEmpty()) {
            LeadContactMethod::query()
                ->where('lead_id', $fromLeadId)
                ->where(function ($query) use ($primaryKeys) {
                    foreach ($primaryKeys as $row) {
                        $query->orWhere(function ($inner) use ($row) {
                            $inner->where('type', $row->type)
                                ->where('normalized', $row->normalized);
                        });
                    }
                })
                ->delete();
        }

        LeadContactMethod::query()
            ->where('lead_id', $fromLeadId)
            ->update(['lead_id' => $toLeadId, 'is_main' => false]);
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

    /**
     * Marketing data is merged, not dropped: the higher lead score by default
     * (or the pick), any engagement flag set on either lead, the latest
     * webinar date, tracking ids the kept lead lacks, and the kept lead's own
     * first UTM touch (the duplicate's when it never had one). The
     * duplicate's touches join the kept lead's touch history.
     *
     * @param  array<string, string>  $fieldPicks
     * @return list<array{label: string, set_aside: string, kept: string}>
     */
    private function mergeMarketing(Lead $primary, Lead $duplicate, array $fieldPicks = []): array
    {
        if (!Schema::hasTable('lead_marketing')) {
            return [];
        }

        $primaryMarketing = LeadMarketing::query()->where('lead_id', $primary->id)->first();
        $duplicateMarketing = LeadMarketing::query()->where('lead_id', $duplicate->id)->first();
        $setAside = [];

        // Whether the duplicate's UTM values end up as the primary's first touch.
        $duplicateIsFirstTouch = false;

        if ($primaryMarketing && $duplicateMarketing) {
            // First touch: a lead without UTM data inherits the duplicate's.
            // When both have one, the earlier stays first unless the person
            // picked the other; the losing one stays in the touch history.
            if (!$this->hasUtm($primaryMarketing) && $this->hasUtm($duplicateMarketing)) {
                $primaryMarketing->fill($duplicateMarketing->only(LeadUtmTouch::UTM_FIELDS));
                $duplicateIsFirstTouch = true;
            } elseif ($this->hasUtm($primaryMarketing) && $this->hasUtm($duplicateMarketing)
                && $this->utmLabel($primaryMarketing) !== $this->utmLabel($duplicateMarketing)) {
                $pick = $fieldPicks['marketing:first_touch']
                    ?? $this->defaultFirstTouchPick($primaryMarketing, $duplicateMarketing);
                $keptLabel = (string) $this->utmLabel($primaryMarketing);
                $otherLabel = (string) $this->utmLabel($duplicateMarketing);

                if ($pick === 'duplicate') {
                    $primaryMarketing->fill($duplicateMarketing->only(LeadUtmTouch::UTM_FIELDS));
                    $duplicateIsFirstTouch = true;

                    if ($this->tableHas('lead_utm_touches')) {
                        LeadUtmTouch::query()->where('lead_id', $primary->id)->update(['is_first_touch' => false]);

                        // The duplicate's first touch may exist only on its
                        // marketing row (written before touch history). Log it,
                        // as LeadUtmService does with origin "backfill", so the
                        // kept lead still has a first touch in its history.
                        $hasFirstTouchRow = LeadUtmTouch::query()
                            ->where('lead_id', $duplicate->id)
                            ->where('is_first_touch', true)
                            ->exists();

                        if (! $hasFirstTouchRow) {
                            $touch = new LeadUtmTouch($duplicateMarketing->only(LeadUtmTouch::UTM_FIELDS) + [
                                'lead_id' => $primary->id,
                                'origin' => 'backfill',
                                'is_first_touch' => true,
                            ]);
                            if ($duplicateMarketing->created_at) {
                                $touch->created_at = $duplicateMarketing->created_at;
                            }
                            $touch->save();
                        }
                    }
                }

                $setAside[] = [
                    'label' => 'First touch (UTM)',
                    'set_aside' => $pick === 'duplicate' ? $keptLabel : $otherLabel,
                    'kept' => $pick === 'duplicate' ? $otherLabel : $keptLabel,
                ];
            }

            foreach (self::MARKETING_FLAGS as $flag) {
                if ($this->marketingHasColumn($flag) && $duplicateMarketing->{$flag}) {
                    $primaryMarketing->{$flag} = true;
                }
            }

            if ($this->marketingHasColumn('last_webinar_date') && $duplicateMarketing->last_webinar_date
                && (! $primaryMarketing->last_webinar_date || $duplicateMarketing->last_webinar_date->gt($primaryMarketing->last_webinar_date))) {
                $primaryMarketing->last_webinar_date = $duplicateMarketing->last_webinar_date;
            }

            if ($this->marketingHasColumn('contact_score') && $duplicateMarketing->contact_score !== null) {
                $kept = $primaryMarketing->contact_score;
                $other = $duplicateMarketing->contact_score;

                if ($kept === null) {
                    $primaryMarketing->contact_score = $other;
                } elseif ($kept !== $other) {
                    $pick = $fieldPicks['marketing:contact_score'] ?? ($other > $kept ? 'duplicate' : 'primary');
                    $useDuplicate = $pick === 'duplicate';
                    $primaryMarketing->contact_score = $useDuplicate ? $other : $kept;
                    $setAside[] = [
                        'label' => LeadMergeFields::LABELS['contact_score'],
                        'set_aside' => (string) ($useDuplicate ? $kept : $other),
                        'kept' => (string) ($useDuplicate ? $other : $kept),
                    ];
                }
            }

            foreach (self::MARKETING_FILL_FIELDS as $field) {
                if (! $this->marketingHasColumn($field) || ! filled($duplicateMarketing->{$field})) {
                    continue;
                }

                $kept = $primaryMarketing->{$field};
                $other = $duplicateMarketing->{$field};

                if (! filled($kept)) {
                    $primaryMarketing->{$field} = $other;
                } elseif ($field === 'traffic_source_id' && (string) $kept !== (string) $other) {
                    $useDuplicate = ($fieldPicks['marketing:traffic_source_id'] ?? 'primary') === 'duplicate';
                    $primaryMarketing->{$field} = $useDuplicate ? $other : $kept;
                    $setAside[] = [
                        'label' => LeadMergeFields::LABELS['traffic_source_id'],
                        'set_aside' => (string) ($useDuplicate ? $kept : $other),
                        'kept' => (string) ($useDuplicate ? $other : $kept),
                    ];
                }
            }

            $primaryMarketing->save();
            $duplicateMarketing->delete();
        } elseif (!$primaryMarketing && $duplicateMarketing) {
            $duplicateMarketing->lead_id = $primary->id;
            $duplicateMarketing->save();
            $duplicateIsFirstTouch = $this->hasUtm($duplicateMarketing);
        }

        // Keep the duplicate's UTM history on the primary. Its touches stop
        // being "first" unless its marketing row (and so its first-touch
        // values) was carried over.
        if (Schema::hasTable('lead_utm_touches')) {
            $changes = ['lead_id' => $primary->id];
            if (!$duplicateIsFirstTouch) {
                $changes['is_first_touch'] = false;
            }

            LeadUtmTouch::query()->where('lead_id', $duplicate->id)->update($changes);
        }

        return $setAside;
    }

    private function hasUtm(LeadMarketing $marketing): bool
    {
        foreach (LeadUtmTouch::UTM_FIELDS as $field) {
            if (filled($marketing->{$field})) {
                return true;
            }
        }

        return false;
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
