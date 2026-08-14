<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\User;
use App\Models\PipelineStage;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\CustomFieldCategory;
use App\Services\LeadCoreFieldsService;
use App\Support\LeadSearchQuery;
use Illuminate\Database\Eloquent\Builder;
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
    ];

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
    ) {
    }
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

        return $leads;
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
     * Get dropdown leads (limited for performance)
     */
    public function getDropdownLeads(int $limit = 100): \Illuminate\Support\Collection
    {
        return Lead::select('id', 'client_name', 'salutation', 'lead_owner')
            ->where('company_id', company()->id)
            ->orderBy('client_name')
            ->limit($limit)
            ->get()
            ->map(function($contact) {
                $salutation = $contact->salutation;
                if ($salutation instanceof \App\Enums\Salutation) {
                    $salutation = $salutation->label();
                }

                $salutationDisplay = $salutation ? $salutation . ' ' : '';
                return [
                    'id' => $contact->id,
                    'client_name' => $contact->client_name,
                    'client_name_salutation' => $salutationDisplay . $contact->client_name,
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
            ->map(function($stage) {
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
        $lead = new Lead();
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
                $query->where(function($q) use ($userId) {
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
                $term = '%' . $search . '%';
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
                $request->get('end_date')
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
            if (!$request->filled($field)) {
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
            if (!$request->filled($field)) {
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
            if (!in_array($sortDirection, ['asc', 'desc'])) {
                $sortDirection = 'asc';
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
}