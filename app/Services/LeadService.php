<?php

namespace App\Services;

use App\Models\CustomField;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\PipelineStage;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Models\User;
use App\Support\LeadSearchQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class LeadService
{
    /**
     * Every query param applyFilters() understands. Single source of truth for the
     * Leads index whitelist and for sanitising saved-view filter payloads.
     */
    public const FILTER_KEYS = [
        'search',
        'lead_type',
        'start_date',
        'end_date',
        'lead_source',
        'category_id',
        'lead_owner_id',
        'added_by_id',
        'lifecycle_status_id',
        'qualification_segment_key',
        'qualification_answer_values',
        'language',
        'language_id',
        'temperature',
        'preferred_contact_time',
        'gender',
        'age_range',
        'nationality',
        'country',
        'has_joined_the_facebook_group',
        'has_registered_for_the_webinar',
        'has_attended_the_webinar',
        'has_joined_the_whatsapp_group',
        'min_contact_score',
        'max_contact_score',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'utm_audience',
        'next_action',
    ];

    /** Urgency buckets the Next Action column can be filtered by. */
    public const NEXT_ACTION_BUCKETS = ['overdue', 'today', 'week', 'none'];

    /** Option-valued custom field types that can appear in the Leads filter modal. */
    public const OPTION_CUSTOM_FIELD_TYPES = [
        'select',
        'radio',
        'checkbox',
        'multiselect',
    ];

    /** URL / saved-view key prefix for custom field filters (`cf_{id}`). */
    public const CUSTOM_FIELD_FILTER_PREFIX = 'cf_';

    public function __construct(
        private readonly LeadCoreFieldsService $coreFieldsService,
    ) {}

    /**
     * Get paginated leads with optimized queries
     */
    public function getPaginatedLeads(Request $request, $dataTable = null): LengthAwarePaginator
    {
        $viewPermission = user()->permission('view_lead');

        // Q2: eager-load only relations the Leads Index actually consumes.
        // - leadOwner: lead owner column (image_url, name)
        // - addedBy: edit-from-Index modal reads lead.added_by.id
        // - leadSource / category: table columns
        // The lifecycle column uses the lead_lifecycle_status_id scalar + the
        // leadLifecycleStatuses page prop (not the lifecycleStatus relation).
        // Custom field values are fetched on edit open (M4/S3), not per row.
        $query = Lead::query()
            ->with([
                'leadOwner:id,name,email,image',
                'addedBy:id,name,email',
                'leadSource:id,type',
                'category:id,category_name',
                'categories:id,category_name',
            ])
            ->select([
                'leads.id', 'leads.company_id', 'leads.client_name', 'leads.client_email',
                'leads.company_name', 'leads.mobile', 'leads.created_at', 'leads.updated_at',
                'leads.lead_owner', 'leads.added_by', 'leads.source_id', 'leads.category_id', 'leads.client_id',
                'leads.lead_lifecycle_status_id',
                'leads.salutation', 'leads.gender', 'leads.temperature', 'leads.preferred_contact_time', 'leads.address', 'leads.city', 'leads.state',
                'leads.country', 'leads.postal_code', 'leads.website', 'leads.cell', 'leads.office',
                'leads.languages', 'leads.date_of_birth', 'leads.age', 'leads.age_range', 'leads.nationality', 'leads.occupation',
            ]);

        // Next action date as a select expression so the column can be sorted
        // and filtered server-side; the display payload is attached per page
        // below by attachNextActions().
        [$nextActionSql, $nextActionBindings] = $this->nextActionAtSql();
        $query->selectRaw("{$nextActionSql} as next_action_at", $nextActionBindings);

        // Apply permission-based filtering
        $this->applyPermissionScope($query, $viewPermission);

        // Apply filters
        $this->applyFilters($query, $request);

        // Apply sorting
        $this->applySorting($query, $request);

        $leads = $query->paginate($request->get('per_page', 15));

        // S3: do not call withCustomFields() / mergeOntoLead here — SaveLeadModal
        // fetches custom field values on edit open (M4). Keep enum scalar helpers
        // the Index / edit modal still read from the row.
        $leads->getCollection()->transform(function ($lead) {
            $lead->salutation_value = $lead->salutation instanceof \App\Enums\Salutation ? $lead->salutation->value : $lead->salutation;
            $lead->gender_value = $lead->gender instanceof \App\Enums\Gender ? $lead->gender->value : $lead->gender;

            return $lead;
        });

        $this->attachNextActions($leads->getCollection());

        return $leads;
    }

    /**
     * SQL for a lead's next action: the earliest open task due date or scheduled
     * meeting, whichever comes first, NULL when the lead has neither.
     *
     * Raw SQL rather than a relation because the Leads index sorts and filters
     * on it — eager-loading tasks + meetings to read one date per row would
     * pull every open item belonging to the page.
     *
     * @return array{0: string, 1: array<int, mixed>} [sql, bindings]
     */
    /**
     * Company's current UTC offset in minutes (east positive), matching
     * Carbon's own getOffset() sign convention.
     *
     * ponytail: derived from *today's* DST state, not the meeting's own
     * date — wrong by an hour for a meeting on the far side of a DST
     * boundary from today. Upgrade to MySQL CONVERT_TZ() if that turns out
     * to matter; it needs the timezone tables loaded, which isn't
     * guaranteed in every environment this runs in.
     */
    private function companyOffsetMinutes(): int
    {
        return (int) round(now()->setTimezone($this->companyTimezone())->getOffset() / 60);
    }

    private function companyTimezone(): string
    {
        // company() can return false (no session/user context — e.g. a
        // console/queue run), not just null, so ?? alone isn't safe here.
        $company = company();

        return is_object($company) ? ($company->timezone ?: 'UTC') : 'UTC';
    }

    /**
     * lead_follow_up.next_follow_up_date is stored as true UTC (see
     * DealController::followUpStore's ->setTimezone('UTC')); tasks.due_date
     * is stored as company wall-clock digits with no timezone label at all
     * (see Task::wallClockString's docblock — TaskController@store never
     * shifts it). Shifting the meeting column by the company's UTC offset
     * makes it comparable, as a naive string, to the task column and to
     * companyNow() below — matching the convention tasks already assume
     * everywhere else in the app, rather than making meetings "correct" and
     * tasks wrong.
     */
    private function shiftToCompanyWallClockSql(string $column, int $offsetMinutes): string
    {
        if ($offsetMinutes === 0) {
            return $column;
        }

        if (DB::connection()->getDriverName() === 'sqlite') {
            $sign = $offsetMinutes >= 0 ? '+' : '-';

            return "datetime({$column}, '{$sign}" . abs($offsetMinutes) . " minutes')";
        }

        return "DATE_ADD({$column}, INTERVAL {$offsetMinutes} MINUTE)";
    }

    /** "Now", rendered as the same naive company-wall-clock basis as tasks.due_date. */
    private function companyNow(): \Illuminate\Support\Carbon
    {
        return now()->setTimezone($this->companyTimezone());
    }

    private function nextActionAtSql(): array
    {
        // ponytail: sqlite has no LEAST (its MIN/2 is the equivalent), and both
        // return NULL if either argument is NULL — hence the sentinel round-trip.
        $least = DB::connection()->getDriverName() === 'sqlite' ? 'MIN' : 'LEAST';
        $bindings = [];

        $meetingColumn = $this->shiftToCompanyWallClockSql(
            'f.next_follow_up_date',
            $this->companyOffsetMinutes(),
        );

        $meeting = "(SELECT MIN({$meetingColumn}) FROM lead_follow_up f
            WHERE f.lead_id = leads.id AND f.status = 'scheduled'
              AND f.next_follow_up_date IS NOT NULL";

        // Mirrors LeadContactController@show: with 'added' the user only sees
        // meetings they created, so those are the only ones that can be "next".
        if (user()->permission('view_lead_follow_up') === 'added') {
            $meeting .= ' AND f.added_by = ?';
            $bindings[] = user()->id;
        }

        $meeting .= ')';

        $task = "(SELECT MIN(t.due_date) FROM taskables tb
            JOIN tasks t ON t.id = tb.task_id
            WHERE tb.taskable_id = leads.id AND tb.taskable_type = ?
              AND t.deleted_at IS NULL AND t.due_date IS NOT NULL";
        $bindings[] = (new Lead())->getMorphClass();

        if ($doneColumnId = $this->doneTaskColumnId()) {
            $task .= ' AND t.board_column_id <> ?';
            $bindings[] = $doneColumnId;
        }

        $task .= ')';

        $sql = "NULLIF({$least}(COALESCE({$meeting}, '9999-12-31'), COALESCE({$task}, '9999-12-31')), '9999-12-31')";

        return [$sql, $bindings];
    }

    /** Urgency bucket filter — same boundaries the table cell colours by. */
    private function applyNextActionFilter(Builder $query, mixed $bucket): void
    {
        [$sql, $bindings] = $this->nextActionAtSql();
        // Same naive company-wall-clock basis nextActionAtSql() now produces
        // for both tasks and meetings — real UTC now() would be off by the
        // company's offset against tasks.due_date, which carries no tz label.
        $now = $this->companyNow();

        match ($bucket) {
            'overdue' => $query->whereRaw("{$sql} < ?", [...$bindings, $now]),
            'today' => $query->whereRaw("{$sql} between ? and ?", [...$bindings, $now, $now->copy()->endOfDay()]),
            'week' => $query->whereRaw("{$sql} between ? and ?", [...$bindings, $now, $now->copy()->addDays(7)]),
            'none' => $query->whereRaw("{$sql} is null", $bindings),
            default => null,
        };
    }

    /**
     * Attach the next action payload (type/title/date) to each lead on the page.
     *
     * Two indexed queries for the whole page, keyed off the already-paginated
     * ids: nextActionAtSql() only yields a date, and the cell needs to say what
     * the action is. Predicates here must stay in step with that expression.
     */
    private function attachNextActions(EloquentCollection $leads): void
    {
        $leadIds = $leads->pluck('id')->all();

        if (empty($leadIds)) {
            return;
        }

        $meetingQuery = DealFollowUp::query()
            ->whereIn('lead_id', $leadIds)
            ->where('status', 'scheduled')
            ->whereNotNull('next_follow_up_date')
            ->with('meetingType:id,name')
            ->orderBy('next_follow_up_date');

        if (user()->permission('view_lead_follow_up') === 'added') {
            $meetingQuery->where('added_by', user()->id);
        }

        // ponytail: no per-lead LIMIT — one page carries tens of open items, so
        // take the earliest in PHP. ROW_NUMBER() if leads ever hold hundreds.
        $meetings = $meetingQuery
            ->get(['id', 'lead_id', 'next_follow_up_date', 'remark', 'meeting_type_id'])
            ->groupBy('lead_id');

        $doneColumnId = $this->doneTaskColumnId();

        $tasks = Task::query()
            ->without(['company', 'project', 'users'])
            ->join('taskables', 'taskables.task_id', '=', 'tasks.id')
            ->where('taskables.taskable_type', (new Lead())->getMorphClass())
            ->whereIn('taskables.taskable_id', $leadIds)
            ->whereNotNull('tasks.due_date')
            ->when($doneColumnId, fn ($q) => $q->where('tasks.board_column_id', '<>', $doneColumnId))
            ->orderBy('tasks.due_date')
            ->get(['tasks.id', 'tasks.heading', 'tasks.due_date', 'taskables.taskable_id as lead_id'])
            ->groupBy('lead_id');

        $leads->each(function ($lead) use ($meetings, $tasks) {
            $meeting = $meetings->get($lead->id)?->first();
            $task = $tasks->get($lead->id)?->first();

            $candidates = [];

            if ($meeting) {
                $candidates[] = [
                    'type' => 'meeting',
                    'id' => $meeting->id,
                    'title' => trim(strip_tags((string) $meeting->remark))
                        ?: ($meeting->meetingType?->name ?? 'Meeting'),
                    // next_follow_up_date is stored as true UTC (unlike
                    // tasks.due_date — see Task::wallClockString's docblock),
                    // so it needs an explicit conversion before formatting as
                    // a naive string. Without this the frontend, which treats
                    // due_at as already-company-local, displayed raw UTC.
                    'due_at' => $meeting->next_follow_up_date
                        ?->copy()
                        ->setTimezone($this->companyTimezone())
                        ->format('Y-m-d H:i:s'),
                    'meta' => $meeting->meetingType?->name,
                ];
            }

            if ($task) {
                $candidates[] = [
                    'type' => 'task',
                    'id' => $task->id,
                    'title' => $task->heading,
                    'due_at' => $task->due_date?->format('Y-m-d H:i:s'),
                    'meta' => null,
                ];
            }

            $lead->next_action = collect($candidates)->sortBy('due_at')->first();
        });
    }

    private ?int $doneTaskColumnId = null;

    /** Board column meaning "done"; null when the company has none. */
    private function doneTaskColumnId(): ?int
    {
        return $this->doneTaskColumnId ??= TaskboardColumn::completeColumn()?->id;
    }

    /**
     * Lead IDs matching the current index filters + view_lead scope.
     * Used by bulk "select all matching" so actions hit the filtered set, not one page.
     *
     * @return list<int>
     */
    public function getMatchingLeadIds(Request $request): array
    {
        $viewPermission = user()->permission('view_lead');

        $query = Lead::query()->select('leads.id');
        $this->applyPermissionScope($query, $viewPermission);
        $this->applyFilters($query, $request);

        return $query->pluck('leads.id')->map(fn ($id) => (int) $id)->values()->all();
    }

    /**
     * Count of leads (current filters + permission scope) whose next action
     * falls in the given urgency bucket. Toolbar summary pill — one indexed
     * COUNT, same predicate applyNextActionFilter() uses for the column itself.
     */
    public function countNextActionBucket(Request $request, string $bucket): int
    {
        $viewPermission = user()->permission('view_lead');

        $query = Lead::query()->select('leads.id');
        $this->applyPermissionScope($query, $viewPermission);
        $this->applyFilters($query, $request);
        $this->applyNextActionFilter($query, $bucket);

        return $query->count();
    }

    /**
     * Get dropdown leads (limited for performance)
     */
    public function getDropdownLeads(int $limit = 100): \Illuminate\Support\Collection
    {
        return Lead::select('id', 'client_name', 'salutation', 'lead_owner')
            ->where('company_id', company()->id)
            ->orderBy('client_name')
            ->limit($limit)
            ->get()
            ->map(function ($contact) {
                $salutation = $contact->salutation;
                if ($salutation instanceof \App\Enums\Salutation) {
                    $salutation = $salutation->label();
                }

                $salutationDisplay = $salutation ? $salutation.' ' : '';

                return [
                    'id' => $contact->id,
                    'client_name' => $contact->client_name,
                    'client_name_salutation' => $salutationDisplay.$contact->client_name,
                    'lead_owner' => $contact->lead_owner,
                ];
            });
    }

    /**
     * Get lead stages for the UI
     */
    public function getLeadStages(): \Illuminate\Support\Collection
    {
        return PipelineStage::select('id', 'name', 'lead_pipeline_id', 'label_color')
            ->get()
            ->map(function ($stage) {
                return [
                    'id' => $stage->id,
                    'name' => $stage->name,
                    'lead_pipeline_id' => $stage->lead_pipeline_id,
                    'label_color' => $stage->label_color,
                ];
            });
    }

    /**
     * Get lead custom fields and categories for forms
     */
    public function getLeadCustomFieldsData(): array
    {
        // Get custom fields
        $lead = new Lead;
        $getCustomFieldGroupsWithFields = $lead->getCustomFieldGroupsWithFields();
        $customFields = $getCustomFieldGroupsWithFields ? $getCustomFieldGroupsWithFields->fields : [];

        // Get custom field categories
        $leadCustomFieldGroup = CustomFieldGroup::where('model', Lead::CUSTOM_FIELD_MODEL)->first();
        $customFieldCategories = collect();
        if ($leadCustomFieldGroup) {
            $customFieldCategories = CustomFieldCategory::where('custom_field_group_id', $leadCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get();
        }

        return [
            'customFields' => $this->coreFieldsService
                ->filterPromotedFieldDefinitions($customFields)
                ->all(),
            'customFieldCategories' => $customFieldCategories,
        ];
    }

    /**
     * A Lead query already narrowed to what the current user may view.
     * Facet counts must use this so totals never leak leads the user can't see.
     */
    public function scopedQuery(): Builder
    {
        $query = Lead::query();
        $this->applyPermissionScope($query, user()->permission('view_lead'));

        return $query;
    }

    /**
     * Apply permission-based filtering
     */
    private function applyPermissionScope(Builder $query, string $viewPermission): void
    {
        $userId = user()->id;

        switch ($viewPermission) {
            case 'added':
                $query->where('added_by', $userId);
                break;
            case 'owned':
                $query->where('lead_owner', $userId);
                break;
            case 'both':
                $query->where(function ($q) use ($userId) {
                    $q->where('added_by', $userId)
                        ->orWhere('lead_owner', $userId);
                });
                break;
            case 'all':
            default:
                // No additional filtering needed
                break;
        }
    }

    /**
     * Apply request filters
     */
    private function applyFilters(Builder $query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $term = '%'.$search.'%';
                $q->where('client_name', 'like', $term)
                    ->orWhere('client_email', 'like', $term)
                    ->orWhere('company_name', 'like', $term)
                    ->orWhere('country', 'like', $term);
                LeadSearchQuery::applyMobileMatch($q, $search);
            });
        }

        if ($request->filled('lead_source')) {
            $query->whereIn('source_id', $this->toValueArray($request->get('lead_source')));
        }

        if ($request->filled('category_id')) {
            $categoryIds = $this->toValueArray($request->get('category_id'));
            $query->where(function ($q) use ($categoryIds) {
                $q->whereIn('category_id', $categoryIds)
                    ->orWhereHas('categories', function ($cq) use ($categoryIds) {
                        $cq->whereIn('lead_category.id', $categoryIds);
                    });
            });
        }

        if ($request->filled('lead_owner_id')) {
            $query->whereIn('lead_owner', $this->toValueArray($request->get('lead_owner_id')));
        }

        if ($request->filled('added_by_id')) {
            $query->whereIn('added_by', $this->toValueArray($request->get('added_by_id')));
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $query->whereBetween('created_at', [
                $request->get('start_date'),
                $request->get('end_date'),
            ]);
        }

        if ($request->filled('lifecycle_status_id')) {
            $query->whereIn('lead_lifecycle_status_id', $this->toValueArray($request->get('lifecycle_status_id')));
        }

        if ($request->filled('temperature')) {
            $query->whereIn('temperature', $this->toValueArray($request->get('temperature')));
        }

        if ($request->filled('preferred_contact_time')) {
            $query->whereIn('preferred_contact_time', $this->toValueArray($request->get('preferred_contact_time')));
        }

        if ($request->filled('gender')) {
            $query->whereIn('gender', $this->toValueArray($request->get('gender')));
        }

        if ($request->filled('age_range')) {
            $query->whereIn('age_range', $this->toValueArray($request->get('age_range')));
        }

        if ($request->filled('nationality')) {
            $query->whereIn('nationality', $this->toValueArray($request->get('nationality')));
        }

        if ($request->filled('country')) {
            $query->whereIn('country', $this->toValueArray($request->get('country')));
        }

        if ($request->filled('next_action')) {
            $this->applyNextActionFilter($query, $request->get('next_action'));
        }

        if ($this->coreFieldsService->useCoreFields() && $request->filled('language')) {
            $languageCodes = $this->toValueArray($request->get('language'));
            $query->where(function ($q) use ($languageCodes) {
                foreach ($languageCodes as $code) {
                    $q->orWhereJsonContains('languages', $code);
                }
            });
        }

        $this->applyMarketingFilters($query, $request);

        if ($request->filled('qualification_segment_key')) {
            $segmentKey = $request->get('qualification_segment_key');
            $answerValues = array_filter((array) $request->get('qualification_answer_values', []));

            $query->whereExists(function ($sub) use ($segmentKey, $answerValues) {
                $sub->select(DB::raw(1))
                    ->from('lead_qualification_answers as lqa')
                    ->join('lead_qualifications as lq', 'lq.id', '=', 'lqa.lead_qualification_id')
                    ->whereColumn('lq.lead_id', 'leads.id')
                    ->where('lqa.segment_key', $segmentKey)
                    ->whereRaw('lq.id = (
                        SELECT lq2.id FROM lead_qualifications lq2
                        WHERE lq2.lead_id = leads.id
                        ORDER BY lq2.started_at DESC, lq2.id DESC
                        LIMIT 1
                    )');

                foreach ($answerValues as $value) {
                    $sub->whereJsonContains('lqa.answer_values', $value);
                }
            });
        }

        $this->applyCustomFieldFilters($query, $request);
    }

    /**
     * Pull core FILTER_KEYS plus any `cf_{id}` custom-field params from a request.
     *
     * @return array<string, mixed>
     */
    public static function filtersFromRequest(Request $request): array
    {
        $filters = $request->only(self::FILTER_KEYS);

        foreach ($request->all() as $key => $value) {
            if (! is_string($key) || ! self::isCustomFieldFilterKey($key)) {
                continue;
            }
            if ($value === null || $value === '' || $value === []) {
                continue;
            }
            $filters[$key] = $value;
        }

        return $filters;
    }

    public static function isCustomFieldFilterKey(string $key): bool
    {
        return (bool) preg_match('/^'.preg_quote(self::CUSTOM_FIELD_FILTER_PREFIX, '/').'\d+$/', $key);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public static function sanitizeFilterPayload(array $filters): array
    {
        $allowed = array_flip(self::FILTER_KEYS);
        $cleaned = [];

        foreach ($filters as $key => $value) {
            if ($value === null || $value === '' || $value === []) {
                continue;
            }
            if (isset($allowed[$key]) || (is_string($key) && self::isCustomFieldFilterKey($key))) {
                $cleaned[$key] = $value;
            }
        }

        return $cleaned;
    }

    /**
     * Filter by option-valued lead custom fields (`cf_{id}=a,b` = match any).
     */
    private function applyCustomFieldFilters(Builder $query, Request $request): void
    {
        /** @var array<int, list<string>> $byFieldId */
        $byFieldId = [];

        foreach ($request->all() as $key => $raw) {
            if (! is_string($key) || ! self::isCustomFieldFilterKey($key)) {
                continue;
            }

            $fieldId = (int) substr($key, strlen(self::CUSTOM_FIELD_FILTER_PREFIX));
            $values = $this->toValueArray($raw);
            if ($fieldId < 1 || $values === []) {
                continue;
            }

            $byFieldId[$fieldId] = $values;
        }

        if ($byFieldId === []) {
            return;
        }

        $fields = CustomField::query()
            ->whereIn('id', array_keys($byFieldId))
            ->whereIn('type', self::OPTION_CUSTOM_FIELD_TYPES)
            ->whereHas('fieldGroup', function (Builder $groupQuery) {
                $groupQuery->where('model', Lead::CUSTOM_FIELD_MODEL);
            })
            ->get(['id', 'type', 'values'])
            ->keyBy('id');

        foreach ($byFieldId as $fieldId => $values) {
            $field = $fields->get($fieldId);
            if (! $field) {
                continue;
            }

            $matchValues = $this->expandCustomFieldMatchValues($field, $values);
            $isMultiStored = in_array($field->type, ['checkbox', 'multiselect'], true);

            $query->whereExists(function ($sub) use ($fieldId, $matchValues, $isMultiStored) {
                $sub->select(DB::raw(1))
                    ->from('custom_fields_data')
                    ->whereColumn('custom_fields_data.model_id', 'leads.id')
                    ->where('custom_fields_data.model', Lead::CUSTOM_FIELD_MODEL)
                    ->where('custom_fields_data.custom_field_id', $fieldId)
                    ->where(function ($valueQuery) use ($matchValues, $isMultiStored) {
                        foreach ($matchValues as $value) {
                            $valueQuery->orWhere(function ($or) use ($value, $isMultiStored) {
                                $or->where('custom_fields_data.value', $value);
                                if ($isMultiStored) {
                                    $or->orWhereJsonContains('custom_fields_data.value', $value);
                                }
                            });
                        }
                    });
            });
        }
    }

    /**
     * Match stored option labels and legacy 0-based indices.
     *
     * @param  list<string>  $values
     * @return list<string>
     */
    private function expandCustomFieldMatchValues(CustomField $field, array $values): array
    {
        $options = $field->values;
        if (is_string($options)) {
            $decoded = json_decode($options, true);
            $options = is_array($decoded) ? $decoded : [];
        }
        if (! is_array($options)) {
            $options = [];
        }
        $options = array_values(array_map('strval', $options));

        $expanded = [];
        foreach ($values as $value) {
            $value = (string) $value;
            $expanded[] = $value;

            $index = array_search($value, $options, true);
            if ($index !== false) {
                $expanded[] = (string) $index;
            }
        }

        return array_values(array_unique($expanded));
    }

    /**
     * Normalize a filter param into an array of non-empty values.
     * Multiselect filters arrive as a comma-joined string (see FilterContext.tsx);
     * a native array param (e.g. `key[]=a&key[]=b`) is also accepted as-is.
     *
     * @return array<int, string>
     */
    private function toValueArray(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter($value, fn ($v) => $v !== null && $v !== ''));
        }

        if ($value === null || $value === '') {
            return [];
        }

        return array_values(array_filter(
            array_map('trim', explode(',', (string) $value)),
            fn ($v) => $v !== ''
        ));
    }

    /**
     * Marketing engagement filters (lead_marketing relation): boolean flags,
     * contact score range, and free-text UTM values.
     */
    private function applyMarketingFilters(Builder $query, Request $request): void
    {
        $booleanFields = [
            'has_joined_the_facebook_group',
            'has_registered_for_the_webinar',
            'has_attended_the_webinar',
            'has_joined_the_whatsapp_group',
        ];

        foreach ($booleanFields as $field) {
            if (! $request->filled($field)) {
                continue;
            }

            $this->applyMarketingBooleanFilter($query, $field, $request->boolean($field));
        }

        if ($request->filled('min_contact_score') || $request->filled('max_contact_score')) {
            $query->whereHas('marketing', function ($q) use ($request) {
                if ($request->filled('min_contact_score')) {
                    $q->where('contact_score', '>=', (int) $request->get('min_contact_score'));
                }
                if ($request->filled('max_contact_score')) {
                    $q->where('contact_score', '<=', (int) $request->get('max_contact_score'));
                }
            });
        }

        $utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_audience'];

        foreach ($utmFields as $field) {
            if (! $request->filled($field)) {
                continue;
            }

            $values = $this->toValueArray($request->get($field));
            $query->whereHas('marketing', function ($q) use ($field, $values) {
                $q->whereIn($field, $values);
            });
        }
    }

    /**
     * "Yes" requires an explicit true on the marketing row.
     * "No" includes leads with no marketing row at all, not just an explicit false.
     */
    private function applyMarketingBooleanFilter(Builder $query, string $column, bool $wantsYes): void
    {
        if ($wantsYes) {
            $query->whereHas('marketing', function ($q) use ($column) {
                $q->where($column, true);
            });

            return;
        }

        $query->where(function ($q) use ($column) {
            $q->whereDoesntHave('marketing')
                ->orWhereHas('marketing', function ($mq) use ($column) {
                    $mq->where($column, false);
                });
        });
    }

    /**
     * Apply sorting
     */
    private function applySorting(Builder $query, Request $request): void
    {
        if ($request->filled('sort_by')) {
            $sortBy = $request->get('sort_by');
            $sortDirection = $request->get('sort_direction', 'asc');

            // Validate sort direction
            if (! in_array($sortDirection, ['asc', 'desc'])) {
                $sortDirection = 'asc';
            }

            // Leads with nothing scheduled sort last in both directions — an
            // empty cell is never the most urgent row on the page.
            if ($sortBy === 'next_action') {
                $query->orderByRaw("next_action_at is null, next_action_at {$sortDirection}");

                return;
            }

            // Map frontend sort fields to database columns
            $sortMapping = [
                'client_name' => 'leads.client_name',
                'category' => 'lead_category.category_name',
                'lead_owner' => 'lead_owner_user.name',
                'created_at' => 'leads.created_at',
                'updated_at' => 'leads.updated_at',
                'company_name' => 'leads.company_name',
                'client_email' => 'leads.client_email',
                'source_id' => 'lead_sources.sort_order',
            ];

            if (isset($sortMapping[$sortBy])) {
                if ($sortBy === 'lead_owner') {
                    $query->leftJoin('users as lead_owner_user', 'leads.lead_owner', '=', 'lead_owner_user.id')
                        ->orderBy($sortMapping[$sortBy], $sortDirection);
                } elseif ($sortBy === 'category') {
                    $query->leftJoin('lead_category', 'leads.category_id', '=', 'lead_category.id')
                        ->orderBy($sortMapping[$sortBy], $sortDirection);
                } elseif ($sortBy === 'source_id') {
                    $query->leftJoin('lead_sources', 'leads.source_id', '=', 'lead_sources.id')
                        ->orderBy($sortMapping[$sortBy], $sortDirection);
                } else {
                    $query->orderBy($sortMapping[$sortBy], $sortDirection);
                }
            } else {
                // Default fallback
                $query->orderBy('leads.created_at', 'desc');
            }
        } else {
            // Default sorting when no sort is specified
            $query->orderBy('leads.created_at', 'desc');
        }
    }

    /**
     * Force-delete leads inside a transaction (used by bulk delete).
     *
     * @param  list<int>  $rowIds
     */
    public function bulkForceDelete(array $rowIds): void
    {
        DB::transaction(function () use ($rowIds) {
            Lead::query()
                ->whereIn('id', $rowIds)
                ->orderBy('id')
                ->chunkById(500, function ($leads) {
                    foreach ($leads as $lead) {
                        if ($lead->forceDelete() === false) {
                            throw new \RuntimeException('Failed to delete lead '.$lead->id);
                        }
                    }
                });
        });
    }
}
