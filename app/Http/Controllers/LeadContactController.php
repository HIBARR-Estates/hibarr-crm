<?php

namespace App\Http\Controllers;

use App\DataTables\DealsDataTable;
use App\DataTables\LeadContactDataTable;
use App\DataTables\LeadNotesDataTable;
use App\Enums\Salutation;
use App\Helper\Files;
use App\Helper\Reply;
use App\Http\Requests\Admin\Employee\ImportProcessRequest;
use App\Http\Requests\Admin\Employee\ImportRequest;
use App\Http\Requests\Lead\StoreRequest;
use App\Http\Requests\Lead\UpdateRequest;
use App\Http\Requests\Lead\PatchRequest;
use App\Imports\LeadImport;
use App\Jobs\ImportLeadJob;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\LeadNote;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use Illuminate\Support\Facades\DB;
use App\Models\Lead;
use App\Models\LeadLifecycleStatus;
use App\Models\LeadCustomForm;
use App\Models\LeadPipeline;
use App\Models\LeadProduct;
use App\Models\LeadSource;
use App\Models\PipelineStage;
use App\Models\LeadStatus;
use App\Models\Product;
use App\Models\User;
use App\Models\CustomFieldGroup;
use App\Models\CustomFieldCategory;
use App\Models\ClientCategory;
use App\Models\LanguageSetting;
use App\Traits\ImportExcel;
use App\Traits\LeadFormDataTrait;
use App\Traits\DealFormDataTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;
use App\Services\LeadCoreFieldsService;
use App\Services\LeadQualificationService;
use App\Services\PermissionService;
use App\Services\DealAgentAssignmentService;
use App\Services\LeadService;
class LeadContactController extends AccountBaseController
{

    use ImportExcel;
    use \App\Traits\DealFormDataTrait;
    use \App\Traits\LeadFormDataTrait;

    protected $leadService;

    protected LeadCoreFieldsService $coreFieldsService;

    public function __construct(LeadService $leadService, LeadCoreFieldsService $coreFieldsService)
    {
        parent::__construct();
        $this->leadService = $leadService;
        $this->coreFieldsService = $coreFieldsService;
        $this->pageTitle = 'modules.leadContact.leadContacts';
        $this->middleware(function ($request, $next) {
            if (!in_array('leads', user_modules())) {
                if ($request->ajax() || $request->header('X-Inertia')) {
                    return redirect()->back()->with('error', __('messages.permissionDenied'));
                }
                abort(403);
            }

            return $next($request);
        });
    }



    public function index(LeadContactDataTable $dataTable, Request $request)
    {
        $this->destroySession();
        $this->viewLeadPermission = $viewPermission = user()->permission('view_lead');

        if (!in_array($viewPermission, ['all', 'added', 'owned', 'both'])) {
          
            return redirect()->back()->with('error', __('messages.permissionDenied'));
            
        }

        // Use LeadService for optimized data fetching
        $leads = $this->leadService->getPaginatedLeads($request, $dataTable);

        // S2: Index no longer ships leadContacts / stages / custom field definitions.
        // SaveLeadModal (M2) and ChangeToClient fetch defs via form-data API.
        // Keep leadLifecycleStatuses for the inline status cell.
        return Inertia::render('Leads/Index', [
            'pageTitle' => 'Lead Contacts',
            'filters' => $request->only([
                'search',
                'lead_type',
                'start_date',
                'end_date',
                'lead_source',
                'lead_owner_id',
                'added_by_id',
                'lifecycle_status_id',
                'qualification_segment_key',
                'qualification_answer_values',
                'language',
            ]),
            'leads' => [
                'data' => $leads->items(),
                'current_page' => $leads->currentPage(),
                'last_page' => $leads->lastPage(),
                'per_page' => $leads->perPage(),
                'total' => $leads->total(),
                'from' => $leads->firstItem(),
                'to' => $leads->lastItem(),
            ],
            'leadLifecycleStatuses' => LeadLifecycleStatus::query()
                ->orderBy('sort_order')
                ->get(['id', 'key', 'label', 'label_color']),
        ]);
    }


    public function show($id, Request $request)
    {
        // Shell vs deferred prop matrix: docs/inertia-react-performance-checklist.md (Task C1).
        // Deferred keys use Inertia::defer (Task C2).

        $this->leadContact = Lead::with([
            'leadOwner',
            'addedBy',
            'leadSource:id,type',
            'category:id,category_name',
            'categories:id,category_name',
            'client:id,name,email',
            'currency:id,currency_name,currency_symbol,currency_code',
            'marketing',
            'lifecycleStatus:id,key,label,label_color,sort_order',
            'activeQualification.answers',
            'activeQualification.agent:id,name,image',
            'leadFlightItineraries',
        ])->findOrFail($id)->withCustomFields();

        $this->coreFieldsService->mergeOntoLead($this->leadContact);

        // Ensure enum values are available for frontend
        $this->leadContact->salutation_value = $this->leadContact->salutation instanceof \App\Enums\Salutation ? $this->leadContact->salutation->value : $this->leadContact->salutation;
        $this->leadContact->gender_value = $this->leadContact->gender instanceof \App\Enums\Gender ? $this->leadContact->gender->value : $this->leadContact->gender;

        $leadRules = [
            'added' => 'added_by',
            'owned' => 'lead_owner'
        ];
        
        $access = PermissionService::checkAccess(user(), 'view_lead', $this->leadContact, $leadRules);
        
        \Log::info("Checking Lead Contact Access for user ID: " . user()->id . " on Lead ID: " . $id);
        if (!$access['canAccess']) {
            \Log::info("Lead Contact Access Denied for user ID: " . user()->id);
             if ($request->ajax() || $request->header('X-Inertia')) {
                \Log::info("Lead Contact Access Denied for user ID: " . user()->id);
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            \Log::info("Lead Contact Access Denied for user ID: " . user()->id);
            abort(403);
        }
        \Log::info("Lead Contact Access Granted for user ID: " . user()->id);
        $this->pageTitle = $this->leadContact->client_name_salutation;

        $this->leadFormFields = LeadCustomForm::with('customField')->where('status', 'active')->where('custom_fields_id', '!=', 'null')->get();
        $this->leadId = $id;

        // C1 shell form metadata only — deferred form keys load via Inertia::defer below.
        $formData = $this->getLeadShowShellFormData();

        $this->categories = $formData['categories'];
        $this->sources = $formData['sources'];
        $this->employees = $formData['employees'];
        $this->customFieldCategories = $formData['customFieldCategories'];
        $this->fields = $formData['customFields'];

        $this->editLeadPermission = user()->permission('edit_lead');
        $this->deleteLeadPermission = user()->permission('delete_lead');

        $tab = request('tab');

        // This route always renders the Inertia SPA page below — a plain
        // browser reload/re-entered URL is indistinguishable from a "genuine
        // legacy" request (neither sends the X-Inertia header), so a check
        // like `if (!$isInertiaRequest)` here would incorrectly divert every
        // reload of a deep-linked `?tab=notes`/`?tab=deal` URL to the old
        // Blade/DataTable partial instead of the SPA. Nothing in the current
        // frontend calls notes()/deals() directly (all links/visits go
        // through Inertia), so this never needs to branch away from the
        // Inertia response.
        switch ($tab) {
            case 'marketing':
                // Load marketing data for the lead contact
                $this->leadContact = $this->leadContact->load('marketing');
                $this->view = 'lead-contact.ajax.marketing';
                break;
            default:
                $this->view = 'lead-contact.ajax.profile';
                break;
        }

        $this->activeTab = $tab ?: 'profile';

        // Shell: deals for header/summary + schedule-meeting picker + itinerary tab
        $deals = Deal::where('lead_id', $id)
            ->with([
                'leadAgent.user',
                'leadStage:id,name,label_color',
                'pipeline:id,name',
                'category:id,category_name',
                'currency',
                'leadFlightItineraries',
            ])
            ->get()
            ->map(function ($deal) {
                $dealWithFields = $deal->withCustomFields();
                $customFieldsData = $dealWithFields->getCustomFieldsData();
                $dealArray = $deal->toArray();
                $dealArray['custom_fields_data'] = $customFieldsData;

                return $dealArray;
            });

        $dealPermissions = [
            'add_deals' => user()->permission('add_deals'),
            'view_deals' => user()->permission('view_deals'),
            'edit_deals' => user()->permission('edit_deals'),
            'delete_deals' => user()->permission('delete_deals'),
        ];

        $notePermissions = [
            'add_lead_note' => user()->permission('add_lead_note'),
            'view_lead_note' => user()->permission('view_lead_note'),
            'edit_lead_note' => user()->permission('edit_lead_note'),
            'delete_lead_note' => user()->permission('delete_lead_note'),
        ];

        $taskPermissions = [
            'add_tasks' => user()->permission('add_tasks'),
            'edit_tasks' => user()->permission('edit_tasks'),
            'delete_tasks' => user()->permission('delete_tasks'),
            'view_tasks' => user()->permission('view_tasks'),
        ];

        $meetingTypes = \App\Models\MeetingType::where('company_id', company()->id)
            ->select('id', 'name', 'color')
            ->get();

        $followUpPermissions = [
            'view_lead_follow_up' => user()->permission('view_lead_follow_up'),
            'add_lead_follow_up' => user()->permission('add_lead_follow_up'),
            'edit_lead_follow_up' => user()->permission('edit_lead_follow_up'),
            'delete_lead_follow_up' => user()->permission('delete_lead_follow_up'),
        ];

        $qualificationPermissions = [
            'view_lead' => user()->permission('view_lead'),
            'edit_lead' => user()->permission('edit_lead'),
        ];

        $leadId = (int) $id;
        $leadContact = $this->leadContact;

        return Inertia::render('Leads/Show', array_merge($formData, [
            'lead' => $leadContact,
            'fields' => $formData['customFields'],
            'editLeadPermission' => $this->editLeadPermission,
            'deleteLeadPermission' => $this->deleteLeadPermission,
            'deals' => $deals,
            'dealPermissions' => $dealPermissions,
            'notePermissions' => $notePermissions,
            'taskPermissions' => $taskPermissions,
            // Legacy TasksTab reads `permissions`
            'permissions' => $taskPermissions,
            'meetingTypes' => $meetingTypes,
            'followUpPermissions' => $followUpPermissions,
            'qualificationPermissions' => $qualificationPermissions,
            // Small lookup table; needed for the lifecycle banner's reactivate action.
            'leadLifecycleStatuses' => LeadLifecycleStatus::query()
                ->orderBy('sort_order')
                ->get(['id', 'key', 'label', 'label_color']),
            'leadAiSummary' => \App\Support\FeatureFlags::enabled('crm.lead-ai-summary')
                ? app(\App\Services\EntitySummary\LeadSummaryService::class)->getCached($leadContact)
                : null,

            // Synchronous so the qualification workspace paints without an extra
            // round-trip — `activeQualification.answers` is already eager-loaded above.
            'leadQualification' => \App\Support\FeatureFlags::enabled('crm.lead-qualification-tab')
                ? app(LeadQualificationService::class)->resolveWorkspaceForLead($leadContact)
                : null,

            // ---- C1 deferred (queries run only when Inertia resolves these) ----
            // Each key carries a named group. Inertia resolves one group per request,
            // so a slow or throwing closure can no longer stall every other tab —
            // the same failure documented in DealController::show().
            'notes' => Inertia::defer(fn () => LeadNote::where('lead_id', $leadId)
                ->with('addedBy')
                ->orderBy('created_at', 'desc')
                ->get(), 'workspace'),
            'tasks' => Inertia::defer(fn () => $leadContact->tasks()
                ->with(['users', 'category', 'boardColumn', 'labels', 'deals', 'leads', 'properties'])
                ->orderBy('id', 'desc')
                ->get(), 'workspace'),
            'leadFollowUps' => Inertia::defer(function () use ($leadId) {
                $leadFollowUpsQuery = DealFollowUp::with([
                    'addedBy:id,name,image',
                    'meetingType',
                    'meetingSummary',
                    'deal:id,name',
                ])
                    ->where('lead_id', $leadId)
                    ->orderBy('next_follow_up_date', 'desc');

                if (user()->permission('view_lead_follow_up') === 'added') {
                    $leadFollowUpsQuery->where('added_by', user()->id);
                }

                $leadFollowUps = $leadFollowUpsQuery->get();

                $allParticipantIds = $leadFollowUps->flatMap(fn ($f) => $f->participants ?? [])->unique()->values();
                $participantUsersMap = $allParticipantIds->isEmpty()
                    ? collect()
                    : User::whereIn('id', $allParticipantIds)->get(['id', 'name', 'image'])->keyBy('id');

                $leadFollowUps->each(function ($f) use ($participantUsersMap) {
                    $f->participant_users = collect($f->participants ?? [])
                        ->map(fn ($pid) => $participantUsersMap->get($pid))
                        ->filter()
                        ->map(fn ($u) => [
                            'id' => $u->id,
                            'name' => $u->name,
                            'image' => $u->image ? $u->image_url : null,
                        ])
                        ->values()
                        ->toArray();
                });

                return $leadFollowUps;
            }, 'workspace'),
            'taskCategories' => Inertia::defer(fn () => \App\Models\TaskCategory::all(), 'taskMeta'),
            'taskLabels' => Inertia::defer(fn () => \App\Models\TaskLabelList::all(), 'taskMeta'),
            'taskBoardColumns' => Inertia::defer(fn () => \App\Models\TaskboardColumn::orderBy('priority')->get(), 'taskMeta'),
            'projects' => Inertia::defer(fn () => \App\Models\Project::all(), 'taskMeta'),
            'leadPipelines' => Inertia::defer(fn () => LeadPipeline::orderBy('default', 'DESC')->get(), 'dealMeta'),
            'leadStages' => Inertia::defer(fn () => PipelineStage::all(), 'dealMeta'),
            'stages' => Inertia::defer(fn () => PipelineStage::all(), 'dealMeta'),
            'leadAgents' => Inertia::defer(fn () => LeadAgent::with('user')->whereHas('user', function ($q) {
                $q->where('status', 'active');
            })->get(), 'formMeta'),
            'nonActiveLeadAgents' => Inertia::defer(fn () => LeadAgent::with('user')->whereHas('user', function ($q) {
                $q->where('status', '!=', 'active');
            })->get(), 'formMeta'),
            'leadContacts' => Inertia::defer(fn () => Lead::allLeads(), 'formMeta'),
            'products' => Inertia::defer(fn () => Product::all(), 'dealMeta'),
            // packagePipeline lets Create Deal filter packages by selected pipeline.
            'packages' => Inertia::defer(
                fn () => \App\Models\Package::with('packagePipeline')->get(),
                'dealMeta',
            ),
            'dealCustomFields' => Inertia::defer(function () {
                $deal = new Deal();
                $groups = $deal->getCustomFieldGroupsWithFields();

                return $groups ? $groups->fields : [];
            }, 'dealMeta'),
            'dealCustomFieldCategories' => Inertia::defer(function () {
                $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
                if (!$dealCustomFieldGroup) {
                    return collect();
                }

                return CustomFieldCategory::where('custom_field_group_id', $dealCustomFieldGroup->id)
                    ->where('company_id', company()->id)
                    ->orderBy(DB::raw('`order`'), 'asc')
                    ->orderBy('id', 'asc')
                    ->get();
            }, 'dealMeta'),
            'pipelineCustomFieldCategoryIdsByPipeline' => Inertia::defer(function () {
                return LeadPipeline::query()
                    ->with('customFieldCategories:id')
                    ->get()
                    ->mapWithKeys(function (LeadPipeline $pipeline) {
                        return [
                            (string) $pipeline->id => $pipeline->customFieldCategories->pluck('id')->values()->all(),
                        ];
                    })
                    ->toArray();
            }, 'dealMeta'),
        ]));
    }

    public function notes()
    {
        $dataTable = new LeadNotesDataTable();
        $viewPermission = user()->permission('view_deals');

        if (!($viewPermission == 'all' || $viewPermission == 'added' || $viewPermission == 'both')) {
             if (request()->ajax() || request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $tab = request('tab');
        $this->activeTab = $tab ?: 'profile';

        $this->view = 'lead-contact.ajax.notes';

        return $dataTable->render('lead-contact.show', $this->data);
    }

    public function deals()
    {
        $viewPermission = user()->permission('view_deals');

        if (!in_array($viewPermission, ['all', 'added', 'both', 'owned'])) {
             if (request()->ajax() || request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $tab = request('tab');
        $this->pipelines = LeadPipeline::all();

        $defaultPipeline = $this->pipelines->filter(function ($value, $key) {
            return $value->default == 1;
        })->first();

        $this->stages = PipelineStage::where('lead_pipeline_id', $defaultPipeline->id)->get();

        $this->activeTab = $tab ?: 'profile';
        $this->view = 'lead-contact.ajax.deal';
        $dataTable = new DealsDataTable();

        return $dataTable->render('lead-contact.show', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create(Request $request)
    {
        $this->pageTitle = __('modules.leadContact.createTitle');

        $this->addPermission = user()->permission('add_lead');
        
        if (!in_array($this->addPermission, ['all', 'added'])) {
             if ($request->ajax() || request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $formData = $this->getLeadFormData();
        $this->employees = $formData['employees'];
        $this->leadAgents = $formData['leadAgents'];
        $this->fields = $formData['customFields'];

        $defaultStatus = LeadStatus::where('default', '1')->first();
        $this->columnId = request('column_id') ?: $defaultStatus->id;

        $this->leadAgentArray = $this->leadAgents->pluck('user_id')->toArray();

        if ((in_array(user()->id, $this->leadAgentArray))) {
            $this->myAgentId = $this->leadAgents->filter(function ($value, $key) {
                return $value->user_id == user()->id;
            })->first()->id;
        }

        $this->sources = $formData['sources'];
        $this->categories = $formData['categories'];
        $this->countries = $formData['countries'];
        $this->customFieldCategories = $formData['customFieldCategories'];
        $this->leadPipelines = $formData['leadPipelines'];
        $this->leadStages = $formData['leadStages'];
        $this->products = $formData['products'];

        // Check if it's an Inertia request
        if ($request->inertia()) {
            return Inertia::render('Leads/Create', array_merge([
                'pageTitle' => $this->pageTitle,
                'fields' => $this->fields ?? [],
            ], $formData));
        }

        $this->view = 'lead-contact.ajax.create';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('lead-contact.create', $this->data);
    }

    /**
     * @param StoreRequest $request
     * @return array|void
     * @throws \Froiden\RestAPI\Exceptions\RelatedResourceNotFoundException
     */
    public function store(StoreRequest $request)
    {
        Log::info("Create Lead Contact, begins ....");
        $this->addPermission = user()->permission('add_lead');


        if (!in_array($this->addPermission, ['all', 'added'])) {
             if ($request->ajax() || request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $existingUser = User::select('id')
            ->whereHas('roles', function ($q) {
                $q->where('name', 'client');
            })->where('company_id', company()->id)
            ->where('email', $request->client_email)
            ->whereNotNull('email')
            ->first();

        $leadContact = new Lead();
        $leadContact->company_id = company()->id;
        $leadContact->salutation = $request->salutation ?: null;
        $leadContact->gender = $request->gender;
        $leadContact->client_name = $request->client_name;
        $leadContact->client_email = $request->client_email;
        $leadContact->note = trim_editor($request->note);
        $leadContact->source_id = $request->source_id;
        $leadContact->lead_lifecycle_status_id = $request->lead_lifecycle_status_id;
        $leadContact->client_id = $existingUser?->id;
        $leadContact->lead_owner = $request->lead_owner ?: user()?->id;
        $leadContact->company_name = $request->company_name;
        $leadContact->website = $request->website;
        $leadContact->address = $request->address;
        $leadContact->cell = $request->cell;
        $leadContact->office = $request->office;
        $leadContact->city = $request->city;
        $leadContact->state = $request->state;
        $leadContact->country = $request->country;
        $leadContact->postal_code = $request->postal_code;
        // Handle mobile field with country code
        if ($request->has('country_phonecode_mobile') && !empty($request->country_phonecode_mobile) && !empty($request->mobile)) {
            // Store phone with country code and country identifier for accurate reloading
            $countryIdentifier = $request->input('country_identifier_mobile');
            $phoneData = [
                'phone' => '+' . $request->country_phonecode_mobile . ' ' . $request->mobile,
                'country_code' => $request->country_phonecode_mobile,
                'country_identifier' => $countryIdentifier
            ];
            $leadContact->mobile = json_encode($phoneData);
        } else {
            $leadContact->mobile = is_array($request->mobile) ? json_encode($request->mobile) : $request->mobile;
        }

        if ($request->boolean('create_deal')) {
            Session::put('create_deal_with_lead', true);
            Session::put('deal_name', $request->name);
        }
        Log::info("Create Lead Contact, b4 save");

        $this->coreFieldsService->write($leadContact, $request->only([
            'languages', 'date_of_birth', 'age', 'age_range', 'nationality', 'occupation',
        ]));
        if ($request->has('remind_at')) {
            $leadContact->remind_at = $request->filled('remind_at') ? $request->remind_at : null;
        }
        if ($request->has('reminders')) {
            $leadContact->reminders = $request->input('reminders');
        }
        $leadContact->save();

        // When create_deal is on, scalar category_id is the *deal* category field
        // (shared form name) and must not be written onto the lead.
        $categoryIds = $this->normalizeCategoryIdsFromRequest(
            $request,
            ignoreScalarCategoryId: $request->boolean('create_deal')
        );
        if ($categoryIds !== null) {
            $leadContact->syncCategories($categoryIds);
        }

        app(\App\Services\Reminders\LeadReminderSync::class)->syncFromLead($leadContact->fresh());

        if ($request->boolean('create_deal')) {
            $this->storeDeal($request, $leadContact);
        }

        // To add custom fields data
        if ($request->custom_fields_data) {
            $filtered = $this->coreFieldsService->filterCustomFieldsFromPayload(
                ['custom_fields_data' => $request->custom_fields_data],
                (int) company()->id
            );
            $leadContact->updateCustomFieldData($filtered['custom_fields_data'] ?? []);
        }

        // Log search
        $this->logSearchEntry($leadContact->id, $leadContact->client_name, 'lead-contact.show', 'lead');

        if ($leadContact->client_email) {
            $this->logSearchEntry($leadContact->id, $leadContact->client_name, 'lead-contact.show', 'lead');
        }

        $redirectUrl = urldecode($request->redirect_url);

        if ($request->add_more == 'true') {
            $html = $this->create();

            return Reply::successWithData(__('messages.leadSaved'), ['html' => $html, 'add_more' => true]);
        }

        if ($redirectUrl == '') {
            $redirectUrl = route('lead-contact.index');
        }

        return Reply::successWithData(__('messages.leadSaved'), ['redirectUrl' => $redirectUrl]);
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param int $id
     * @return \Illuminate\Http\Response
     */
    public function edit($id, Request $request)
    {
        $this->leadContact = Lead::with('leadSource', 'category', 'categories')->findOrFail($id)->withCustomFields();
        $this->deal = Deal::where('lead_id', $id)->first();

        $leadRules = [
            'added' => 'added_by',
            'owned' => 'lead_owner'
        ];
        
        $access = PermissionService::checkAccess(user(), 'edit_lead', $this->leadContact, $leadRules);
        
        if (!$access['canAccess']) {
             if ($request->ajax() || $request->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $formData = $this->getLeadFormData();
        $this->leadAgents = $formData['leadAgents'];
        $this->fields = $formData['customFields'];
        $this->sources = $formData['sources'];
        $this->categories = $formData['categories'];
        $this->countries = $formData['countries'];
        $this->customFieldCategories = $formData['customFieldCategories'];

        // Handle employees specifically for edit to include inactive owner
        $allEmployees = User::allEmployees();
        $activeEmployees = $allEmployees->filter(function ($employee) {
            return $employee->status !== 'deactive';
        });

        $selectedEmployee = $allEmployees->firstWhere('id', $this->leadContact->lead_owner);

        if ($selectedEmployee && $selectedEmployee->status === 'deactive') {
            $this->employees = $activeEmployees->push($selectedEmployee);
        } else {
            $this->employees = $activeEmployees;
        }
        
        // Update formData with the correct employees list
        $formData['employees'] = $this->employees;

        $this->pageTitle = __('modules.leadContact.updateTitle');

        // Check if it's an Inertia request
        if ($request->inertia()) {
            return Inertia::render('Leads/Create', array_merge([
                'pageTitle' => $this->pageTitle,
                'lead' => $this->leadContact,
                'isEditing' => true,
                'fields' => $this->fields ?? [],
            ], $formData));
        }

        if (request()->ajax()) {
            $html = view('lead-contact.ajax.edit', $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'lead-contact.ajax.edit';

        return view('lead-contact.create', $this->data);
    }

    /**
     * @param UpdateRequest $request
     * @return array|void
     * @throws \Froiden\RestAPI\Exceptions\RelatedResourceNotFoundException
     */
    public function update(UpdateRequest $request, $id)
    {
        $leadContact = Lead::findOrFail($id);
        
        $leadRules = [
            'added' => 'added_by',
            'owned' => 'lead_owner'
        ];
        
        $access = PermissionService::checkAccess(user(), 'edit_lead', $leadContact, $leadRules);
        
        if (!$access['canAccess']) {
             if ($request->ajax() || request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $leadContact->salutation = $request->salutation ?: null;
        if ($request->has('gender')) {
            $leadContact->gender = $request->gender;
        }
        $leadContact->client_name = $request->client_name;
        $leadContact->client_email = $request->client_email;
        $leadContact->note = trim_editor($request->note);
        $leadContact->source_id = $request->source_id;
        $leadContact->lead_owner = $request->lead_owner;
        if ($request->has('lead_lifecycle_status_id')) {
            $leadContact->lead_lifecycle_status_id = $request->lead_lifecycle_status_id;
        }
        $leadContact->company_name = $request->company_name;
        $leadContact->website = $request->website;
        $leadContact->address = $request->address;
        $leadContact->cell = $request->cell;
        $leadContact->office = $request->office;
        $leadContact->city = $request->city;
        $leadContact->state = $request->state;
        $leadContact->country = $request->country;
        $leadContact->postal_code = $request->postal_code;
        // Handle mobile field with country code
        if ($request->has('country_phonecode_mobile') && !empty($request->country_phonecode_mobile) && !empty($request->mobile)) {
            // Store phone with country code and country identifier for accurate reloading
            $countryIdentifier = $request->input('country_identifier_mobile');
            $phoneData = [
                'phone' => '+' . $request->country_phonecode_mobile . ' ' . $request->mobile,
                'country_code' => $request->country_phonecode_mobile,
                'country_identifier' => $countryIdentifier
            ];
            $leadContact->mobile = json_encode($phoneData);
        } else {
            $leadContact->mobile = is_array($request->mobile) ? json_encode($request->mobile) : $request->mobile;
        }
        $this->coreFieldsService->write($leadContact, $request->only([
            'languages', 'date_of_birth', 'age', 'age_range', 'nationality', 'occupation',
        ]));
        if ($request->has('remind_at')) {
            $leadContact->remind_at = $request->filled('remind_at') ? $request->remind_at : null;
        }
        if ($request->has('reminders')) {
            $leadContact->reminders = $request->input('reminders');
        }
        $leadContact->save();

        $categoryIds = $this->normalizeCategoryIdsFromRequest($request);
        if ($categoryIds !== null) {
            $leadContact->syncCategories($categoryIds);
        }

        app(\App\Services\Reminders\LeadReminderSync::class)->syncFromLead($leadContact->fresh());

        $clientCreated = $request->create_client == "on" ? '1' : '0';
        Deal::where('lead_id', $leadContact->id)->update(['create_client' => $clientCreated]);

        // To add custom fields data
        if ($request->custom_fields_data) {
            $filtered = $this->coreFieldsService->filterCustomFieldsFromPayload(
                ['custom_fields_data' => $request->custom_fields_data],
                (int) company()->id
            );
            $leadContact->updateCustomFieldData($filtered['custom_fields_data'] ?? []);
        }

        return Reply::successWithData(__('messages.leadUpdateSuccess'), ['redirectUrl' => route('lead-contact.index')]);
    }

    /**
     * Partially update the specified lead contact.
     * Allows for quick updates with optional fields.
     *
     * @param PatchRequest $request
     * @param int $id
     * @return \Illuminate\Http\Response
     */
    public function patch(PatchRequest $request, $id)
    {
        $leadContact = Lead::findOrFail($id);
        
        $leadRules = [
            'added' => 'added_by',
            'owned' => 'lead_owner'
        ];
        
        $access = PermissionService::checkAccess(user(), 'edit_lead', $leadContact, $leadRules);
        
        if (!$access['canAccess']) {
           
             if ($request->ajax() || $request->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
           
            abort(403);
        }
    

        try {
            // Start database transaction
            \DB::beginTransaction();

            // Update only the fields that are present in the request
            $fieldsToUpdate = $request->validated();
            
            // Handle basic contact information
            if ($request->has('salutation')) {
                $leadContact->salutation = $request->salutation ?: null;
            }
            if ($request->has('gender')) {
                $leadContact->gender = $request->gender;
            }
            if ($request->has('client_name')) {
                $leadContact->client_name = $request->client_name;
            }
            if ($request->has('client_email')) {
                $leadContact->client_email = $request->client_email;
            }
            if ($request->has('company_name')) {
                $leadContact->company_name = $request->company_name;
            }
            if ($request->has('website')) {
                $leadContact->website = $request->website;
            }
            
            // Handle address information
            if ($request->has('address')) {
                $leadContact->address = $request->address;
            }
            if ($request->has('city')) {
                $leadContact->city = $request->city;
            }
            if ($request->has('state')) {
                $leadContact->state = $request->state;
            }
            if ($request->has('country')) {
                $leadContact->country = $request->country;
            }
            if ($request->has('postal_code')) {
                $leadContact->postal_code = $request->postal_code;
            }
            
            // Handle phone numbers
            if ($request->has('cell')) {
                $leadContact->cell = $request->cell;
            }
            if ($request->has('office')) {
                $leadContact->office = $request->office;
            }
            if ($request->has('client_whatsapp')) {
                $leadContact->client_whatsapp = $request->client_whatsapp;
            }
            if ($request->has('client_telegram')) {
                $leadContact->client_telegram = $request->client_telegram;
            }
            if ($request->has('client_instagram')) {
                $leadContact->client_instagram = $request->client_instagram;
            }
            
            // Handle mobile with special formatting if needed
            if ($request->has('mobile')) {
                if ($request->has('country_phonecode_mobile') && !empty($request->country_phonecode_mobile) && !empty($request->mobile)) {
                    $countryIdentifier = $request->input('country_identifier_mobile');
                    $phoneData = [
                        'phone' => '+' . $request->country_phonecode_mobile . ' ' . $request->mobile,
                        'country_code' => $request->country_phonecode_mobile,
                        'country_identifier' => $countryIdentifier
                    ];
                    $leadContact->mobile = json_encode($phoneData);
                } else {
                    $leadContact->mobile = is_array($request->mobile) ? json_encode($request->mobile) : $request->mobile;
                }
            }
            
            // Handle lead-specific information
            if ($request->has('note')) {
                $leadContact->note = trim_editor($request->note);
            }
            if ($request->has('value')) {
                $leadContact->value = $request->value;
            }
            if ($request->has('currency_id')) {
                $leadContact->currency_id = $request->currency_id;
            }
            if ($request->has('next_follow_up')) {
                $leadContact->next_follow_up = $request->next_follow_up;
            }
            
            // Handle assignment fields
            if ($request->has('agent_id')) {
                $leadContact->agent_id = $request->agent_id;
            }
            if ($request->has('lead_owner')) {
                $leadContact->lead_owner = $request->lead_owner;
            }
            if ($request->has('added_by')) {
                $leadContact->added_by = $request->added_by;
            }
            
            // Handle categorization (multi via category_ids; category_id still accepted)
            $categoryIds = $this->normalizeCategoryIdsFromRequest($request);
            if ($categoryIds !== null) {
                // Defer pivot sync until after save so the lead has an id and
                // the scalar category_id is written in the same sync call.
                $leadContact->category_id = $categoryIds[0] ?? null;
            }
            if ($request->has('source_id')) {
                $leadContact->source_id = $request->source_id;
            }
            if ($request->has('status_id')) {
                $leadContact->status_id = $request->status_id;
            }
            if ($request->has('lead_lifecycle_status_id')) {
                $leadContact->lead_lifecycle_status_id = $request->lead_lifecycle_status_id;
            }

            // Marketing engagement flags live on the related lead_marketing row, not on leads itself.
            if ($request->has('has_joined_the_whatsapp_group')) {
                $leadContact->marketing()->updateOrCreate(
                    ['lead_id' => $leadContact->id],
                    ['has_joined_the_whatsapp_group' => $request->boolean('has_joined_the_whatsapp_group')]
                );
            }

            // Handle other fields
            if ($request->has('column_priority')) {
                $leadContact->column_priority = $request->column_priority;
            }
            if ($request->has('total_value')) {
                $leadContact->total_value = $request->total_value;
            }
            if ($request->has('client_id')) {
                $leadContact->client_id = $request->client_id;
            }
            if ($request->has('hash')) {
                $leadContact->hash = $request->hash;
            }

            $this->coreFieldsService->write($leadContact, $request->only([
                'languages', 'date_of_birth', 'age', 'age_range', 'nationality', 'occupation',
            ]));

            // Save the lead contact
            $leadContact->save();

            if ($categoryIds !== null) {
                $leadContact->syncCategories($categoryIds);
            }

            // Handle products relationship
            if ($request->has('products')) {
                // Remove existing products
                LeadProduct::where('lead_id', $leadContact->id)->delete();
                
                // Add new products
                foreach ($request->products as $productId) {
                    LeadProduct::create([
                        'lead_id' => $leadContact->id,
                        'product_id' => $productId
                    ]);
                }
            }

            // Handle custom fields
            if ($request->has('custom_fields') || $request->hasFile('custom_fields') || isset($request->allFiles()['custom_fields'])) {
                // Get custom field data - files may be in input or allFiles
                $allInput = $request->all();
                $allFiles = $request->allFiles();
                
                // Start with input data (for non-file fields)
                $customFieldsData = [];
                
                // Check if custom_fields contains files (UploadedFile objects)
                if (isset($allInput['custom_fields']) && is_array($allInput['custom_fields'])) {
                    foreach ($allInput['custom_fields'] as $fieldKey => $fieldValue) {
                        if (is_array($fieldValue)) {
                            // Check if it's an array of UploadedFile objects
                            $uploadedFiles = [];
                            foreach ($fieldValue as $item) {
                                if ($item instanceof \Illuminate\Http\UploadedFile) {
                                    $uploadedFiles[] = $item;
                                }
                            }
                            if (!empty($uploadedFiles)) {
                                $customFieldsData[$fieldKey] = $uploadedFiles;
                            } else {
                                // Regular array value
                                $customFieldsData[$fieldKey] = $fieldValue;
                            }
                        } elseif ($fieldValue instanceof \Illuminate\Http\UploadedFile) {
                            // Single file
                            $customFieldsData[$fieldKey] = $fieldValue;
                        } else {
                            // Regular value
                            $customFieldsData[$fieldKey] = $fieldValue;
                        }
                    }
                }
                
                // Also check allFiles for any files that might be there
                if (isset($allFiles['custom_fields']) && is_array($allFiles['custom_fields'])) {
                    foreach ($allFiles['custom_fields'] as $fieldKey => $fileOrFiles) {
                        if (!isset($customFieldsData[$fieldKey])) {
                            if (is_array($fileOrFiles)) {
                                $uploadedFiles = [];
                                foreach ($fileOrFiles as $file) {
                                    if ($file instanceof \Illuminate\Http\UploadedFile) {
                                        $uploadedFiles[] = $file;
                                    }
                                }
                                if (!empty($uploadedFiles)) {
                                    $customFieldsData[$fieldKey] = $uploadedFiles;
                                }
                            } elseif ($fileOrFiles instanceof \Illuminate\Http\UploadedFile) {
                                $customFieldsData[$fieldKey] = $fileOrFiles;
                            }
                        }
                    }
                }
                
                if (!empty($customFieldsData)) {
                    $filtered = $this->coreFieldsService->filterCustomFieldsFromPayload(
                        ['custom_fields' => $customFieldsData],
                        (int) company()->id
                    );
                    $leadContact->updateCustomFieldData($filtered['custom_fields'] ?? []);
                }
            }

            // Handle tags (if your system supports them)
            if ($request->has('tags')) {
                // Assuming you have a tags relationship
                // $leadContact->syncTags($request->tags);
            }

            // Commit transaction
            \DB::commit();

            $leadContact->refresh();
            $this->coreFieldsService->mergeOntoLead($leadContact);

            // Return success response for API calls or redirect for web
            if ($request->ajax() || $request->wantsJson() || $request->header('X-Inertia') || $request->header('X-Requested-With')) {
                // Return only the ID and updated fields to avoid any serialization issues
                // Frontend will merge these into existing state
                $responseData = [
                    'id' => $leadContact->id,
                ];
                
                // Add only the fields that were in the request
                $allowedFields = [
                    'client_name', 'client_email', 'mobile', 'office', 'cell',
                    'client_whatsapp', 'client_telegram', 'client_instagram',
                    'company_name', 'website', 'address', 'city', 'state', 'country',
                    'postal_code', 'gender', 'note', 'lead_owner', 'category_id',
                    'category_ids',
                    'source_id', 'agent_id', 'value', 'currency_id', 'salutation',
                    'languages', 'date_of_birth', 'age', 'age_range', 'nationality', 'occupation',
                    'lead_lifecycle_status_id',
                ];
                
                foreach ($allowedFields as $field) {
                    if ($field === 'category_ids') {
                        continue;
                    }
                    if ($request->has($field)) {
                        if (in_array($field, ['languages', 'date_of_birth', 'age', 'age_range', 'nationality', 'occupation'], true)) {
                            $responseData[$field] = $this->coreFieldsService->read($leadContact)[$field] ?? null;
                        } else {
                            $responseData[$field] = $leadContact->getAttribute($field);
                        }
                    }
                }
                
                // Load and include relationship data when relationship IDs are updated
                // This ensures the frontend can immediately display the updated relationship info
                if ($categoryIds !== null || $request->has('category_id') || $request->has('category_ids')) {
                    $leadContact->load(['category:id,category_name', 'categories:id,category_name']);
                    $responseData['category_id'] = $leadContact->category_id;
                    $responseData['category'] = $leadContact->category;
                    $responseData['categories'] = $leadContact->categories;
                    $responseData['category_ids'] = $leadContact->categories->pluck('id')->values()->all();
                }
                
                if ($request->has('source_id')) {
                    $leadContact->load('leadSource');
                    $responseData['leadSource'] = $leadContact->leadSource;
                    $responseData['lead_source'] = $leadContact->leadSource; // Include both naming conventions
                }
                
                if ($request->has('lead_owner')) {
                    $leadContact->load('leadOwner');
                    $responseData['lead_owner'] = $leadContact->leadOwner;
                }

                if ($request->has('lead_lifecycle_status_id')) {
                    $leadContact->load('lifecycleStatus');
                    $responseData['lifecycleStatus'] = $leadContact->lifecycleStatus;
                    $responseData['lead_lifecycle_status'] = $leadContact->lifecycleStatus;
                }

                if ($request->has('has_joined_the_whatsapp_group')) {
                    $leadContact->load('marketing');
                    $responseData['marketing'] = $leadContact->marketing;
                }

                // If custom fields were updated (including file uploads), include the updated custom_fields_data
                if (
                    $request->has('custom_fields')
                    || $request->hasFile('custom_fields')
                    || isset($request->allFiles()['custom_fields'])
                ) {
                    $leadContact->withCustomFields();
                    $responseData['custom_fields_data'] = $leadContact->custom_fields_data;
                }

                // Always refresh the computed display name so the frontend doesn't revert to the
                // stale salutation+name combo it had before the edit.
                if ($request->has('client_name') || $request->has('salutation')) {
                    $responseData['client_name_salutation'] = $leadContact->client_name_salutation;
                    $responseData['salutation_value'] = $leadContact->salutation instanceof \App\Enums\Salutation
                        ? $leadContact->salutation->value
                        : $leadContact->salutation;
                    $responseData['salutation'] = $responseData['salutation_value'];
                }

                return response()->json([
                    'status' => 'success',
                    'data' => [
                        'lead' => $responseData,
                    ],
                ]);
            }
            
            return Reply::successWithData(__('messages.leadUpdateSuccess'), [
                'lead' => $leadContact->fresh(),
                'redirectUrl' => route('lead-contact.show', $leadContact->id)
            ]);
           

            

        } catch (\Exception $e) {
            // Rollback transaction on error
            \DB::rollback();
            
            // Log the error
            Log::error('Lead patch update failed: ' . $e->getMessage(), [
                'lead_id' => $id,
                'user_id' => user()->id,
                'request_data' => $request->all()
            ]);

           
            return Reply::error('An error occurred while updating the lead contact: ' . $e->getMessage());
            

            
        }
    }

    /**
     * Upload / replace the lead contact avatar image.
     */
    public function uploadImage(Request $request, $id)
    {
        $leadContact = Lead::findOrFail($id);

        $access = PermissionService::checkAccess(user(), 'edit_lead', $leadContact, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);

        if (!$access['canAccess']) {
            if ($request->ajax() || $request->wantsJson()) {
                return response()->json([
                    'status' => 'fail',
                    'message' => __('messages.permissionDenied'),
                ], 403);
            }

            abort(403);
        }

        $request->validate([
            'image' => 'required|image|mimes:jpg,jpeg,png,gif,webp|max:5120',
        ]);

        try {
            if (!empty($leadContact->image)) {
                Files::deleteFile($leadContact->image, 'lead-avatar');
            }

            $leadContact->image = Files::uploadLocalOrS3(
                $request->file('image'),
                'lead-avatar',
                300,
            );
            $leadContact->save();

            return response()->json([
                'status' => 'success',
                'message' => __('messages.updateSuccess') ?: 'Lead photo updated',
                'data' => [
                    'lead' => [
                        'id' => $leadContact->id,
                        'image' => $leadContact->image,
                        'image_url' => $leadContact->image_url,
                    ],
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Lead image upload failed: ' . $e->getMessage(), [
                'lead_id' => $id,
                'user_id' => user()->id,
            ]);

            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to update lead photo',
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param int $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        $leadContact = Lead::findOrFail($id);
        
        $leadRules = [
            'added' => 'added_by',
            'owned' => 'lead_owner'
        ];
        
        $access = PermissionService::checkAccess(user(), 'delete_lead', $leadContact, $leadRules);
        
        if (!$access['canAccess']) {
             if (request()->ajax() || request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        try {
            DB::transaction(function () use ($leadContact) {
                $leadContact->forceDelete();
            });
        } catch (\Illuminate\Database\QueryException $e) {
            Log::error('Failed to delete lead contact: ' . $e->getMessage());
            return Reply::error(__('messages.deleteFailed') ?: 'Failed to delete contact. Please try again.');
        }

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function applyQuickAction(Request $request)
    {
        $rowIds = explode(',', $request->row_ids);
        $actionType = $request->action_type ?? 'delete';

        switch ($actionType) {
            case 'change_category':
                $categoryIds = $this->normalizeCategoryIdsFromRequest($request);
                // Legacy bulk payloads send category_id (possibly null to clear).
                if ($categoryIds === null) {
                    return Reply::error(__('messages.categoryNotFound'));
                }

                if ($categoryIds !== []) {
                    $found = LeadCategory::whereIn('id', $categoryIds)->count();
                    if ($found !== count($categoryIds)) {
                        return Reply::error(__('messages.categoryNotFound'));
                    }
                }

                $leads = Lead::whereIn('id', $rowIds)->get();
                foreach ($leads as $lead) {
                    $lead->syncCategories($categoryIds);
                }
                return Reply::success(__('messages.updateSuccess'));

            case 'change_source':
                $sourceId = $request->source_id;
                
                if ($sourceId) {
                    $source = LeadSource::find($sourceId);
                    if (!$source) {
                        return Reply::error(__('messages.sourceNotFound'));
                    }
                }
                
                Lead::whereIn('id', $rowIds)->update(['source_id' => $sourceId]);
                return Reply::success(__('messages.updateSuccess'));

            case 'change_owner':
                $leadOwner = $request->lead_owner;
                
                if ($leadOwner) {
                    $owner = User::find($leadOwner);
                    if (!$owner) {
                        return Reply::error(__('messages.userNotFound'));
                    }
                }
                
                Lead::whereIn('id', $rowIds)->update(['lead_owner' => $leadOwner]);
                return Reply::success(__('messages.updateSuccess'));

            case 'delete':
            default:
                Lead::whereIn('id', $rowIds)->forceDelete();
                return Reply::success(__('messages.deleteSuccess'));
        }
    }

    public function importLead()
    {
        $this->pageTitle = __('app.importExcel') . ' ' . __('app.menu.lead');

        $this->addPermission = user()->permission('add_lead');
        
        if (!in_array($this->addPermission, ['all', 'added'])) {
            if (request()->ajax() || request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        if (request()->ajax()) {
            $html = view('leads.ajax.import', $this->data)->render();

            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'leads.ajax.import';

        return view('leads.create', $this->data);
    }

    public function importStore(ImportRequest $request)
    {
        $rvalue = $this->importFileProcess($request, LeadImport::class);

        if ($rvalue == 'abort') {
            if ($request->inertia()) {
                return redirect()->back()->with('error', __('messages.abortAction'));
            }
            if ($request->wantsJson()) {
                return response()->json(['error' => __('messages.abortAction')], 422);
            }
            return Reply::error(__('messages.abortAction'));
        }

        if ($request->inertia()) {
            return $this->completeInertiaLeadImportAfterUpload();
        }

        if ($request->wantsJson()) {
            return response()->json([
                'status' => 'success',
                'message' => __('messages.importUploadSuccess'),
            ]);
        }

        // For traditional Ajax requests
        $view = view('leads.ajax.import_progress', $this->data)->render();
        return Reply::successWithData(__('messages.importUploadSuccess'), ['view' => $view]);
    }

    public function importProcess(ImportProcessRequest $request)
    {
        $batch = $this->importJobProcess($request, LeadImport::class, ImportLeadJob::class);

        if ($request->inertia()) {
            return redirect()->back()->with('success', __('messages.importProcessStart'));
        }

        if ($request->wantsJson()) {
            return response()->json([
                'status' => 'success',
                'message' => __('messages.importProcessStart'),
                'batch' => $batch,
            ]);
        }

        return Reply::successWithData(__('messages.importProcessStart'), ['batch' => $batch]);
    }

    /**
     * Traditional import shows a column-mapping step; Inertia posts only the file.
     * Auto-map columns (same rules as the Blade matcher) then queue ImportLeadJob rows.
     */
    private function completeInertiaLeadImportAfterUpload()
    {
        $columnsMapping = $this->buildAutoLeadImportColumnMap();
        $mappedValues = array_filter($columnsMapping, fn ($v) => $v !== null && $v !== '');

        if ($mappedValues === [] || ! in_array('name', $mappedValues, true)) {
            return redirect()->back()->with(
                'error',
                __('messages.requiredColumnsUnmatched', ['columns' => __('modules.lead.clientName')])
            );
        }

        $processRequest = Request::create('/', 'POST', [
            'file' => $this->file,
            'has_heading' => $this->hasHeading,
            'columns' => $columnsMapping,
        ]);

        try {
            $this->importJobProcess($processRequest, LeadImport::class, ImportLeadJob::class);
            $queueName = $this->importClassName ?? 'LeadImport';
            $this->runImportQueueUntilEmpty($queueName, $this->importBatches);

            $batchStatus = $this->assessImportBatches($this->importBatches);

            if ($batchStatus === 'failed') {
                return redirect()->back()->with('error', __('messages.importError'));
            }

            if ($batchStatus === 'pending') {
                return redirect()->back()->with('message', __('messages.importStarted'));
            }
        } catch (\Throwable $e) {
            Log::error('Lead Inertia import failed after upload', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()->with('error', __('messages.somethingWentWrong'));
        }

        return redirect()->back()->with('success', __('messages.importProcessStart'));
    }

    /**
     * @return array<int, string|null> spreadsheet column index => LeadImport field id
     */
    private function buildAutoLeadImportColumnMap(): array
    {
        $fields = LeadImport::fields();
        $sampleRow = $this->importSample[0] ?? [];
        $columns = [];

        $fieldIndexByPosition = 0;

        foreach (array_keys($sampleRow) as $idx) {
            // With headings, never use position-based fall-through: extra data columns or
            // missing heading cells must stay unmapped (null) to avoid shifted field values.
            if ($this->hasHeading) {
                if (! empty($this->heading) && isset($this->heading[$idx])) {
                    $header = mb_strtolower(trim(strip_tags((string) $this->heading[$idx])));
                    $matchedId = null;
                    if ($header !== '') {
                        foreach ($fields as $field) {
                            $id = (string) $field['id'];
                            $label = is_string($field['name']) ? mb_strtolower(trim(strip_tags($field['name']))) : '';
                            if ($header === mb_strtolower($id) || ($label !== '' && $header === $label)) {
                                $matchedId = $field['id'];
                                break;
                            }
                        }
                    }
                    $columns[$idx] = $matchedId;
                } else {
                    $columns[$idx] = null;
                }

                continue;
            }

            if ($fieldIndexByPosition < count($fields)) {
                $columns[$idx] = $fields[$fieldIndexByPosition]['id'];
                $fieldIndexByPosition++;
            } else {
                $columns[$idx] = null;
            }
        }

        return $columns;
    }

    public function destroySession()
    {

        if (session()->has('is_imported')) {
            session()->forget('is_imported');
        }

        if (session()->has('leads')) {
            session()->forget('leads');
        }

        if (session()->has('leads_count')) {
            session()->forget('leads_count');
        }

        if (session()->has('total_leads')) {
            session()->forget('total_leads');
        }

        if (session()->has('create_deal_with_lead')) {
            session()->forget('create_deal_with_lead');
        }

        if (session()->has('deal_name')) {
            session()->forget('deal_name');
        }

        if (session()->has('duplicate_leads')) {
            session()->forget('duplicate_leads');
        }
    }

    public function storeDeal($request, $leadContact)
    {
        $this->addPermission = user()->permission('add_deals');
        
        if (!in_array($this->addPermission, ['all', 'added'])) {
            if (request()->ajax() || request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }
        $explicitAgentId = null;
        if ($request->filled('agent_id')) {
            // Prefer lead_agents.id; fall back to legacy user_id (+ category) lookup.
            $leadAgent = LeadAgent::find($request->agent_id);
            if (!$leadAgent) {
                $leadAgent = LeadAgent::where('user_id', $request->agent_id)
                    ->when($request->category_id, fn ($q) => $q->where('lead_category_id', $request->category_id))
                    ->first();
            }
            $explicitAgentId = $leadAgent?->id;
        }

        $agentId = app(DealAgentAssignmentService::class)->resolveAgentId(
            $explicitAgentId,
            $leadContact->lead_owner ? (int) $leadContact->lead_owner : null,
            user()?->id,
            $request->filled('category_id') ? (int) $request->category_id : null
        );

        $deal = new Deal();
        $deal->name = $request->name;
        $deal->lead_id = $leadContact->id;
        $deal->next_follow_up = 'yes';
        $deal->category_id = $request->category_id;
        $deal->lead_pipeline_id = $request->pipeline;
        $deal->pipeline_stage_id = $request->stage_id;
        $deal->create_client = $request->boolean('create_client') ? '1' : '0';
        $deal->agent_id = $agentId;
        $deal->close_date = null;
        if ($request->filled('close_date')) {
            try {
                $deal->close_date = companyToYmd($request->close_date);
            } catch (\Throwable $e) {
                // Accept ISO dates from the React form when company format differs.
                try {
                    $deal->close_date = \Carbon\Carbon::parse($request->close_date)->format('Y-m-d');
                } catch (\Throwable $ignored) {
                    $deal->close_date = null;
                }
            }
        }
        $deal->value = ($request->value) ?: 0;
        $deal->currency_id = $this->company->currency_id;
        $deal->save();

        // Handle deal watchers
        if ($request->deal_watcher && is_array($request->deal_watcher)) {
            $deal->dealWatchers()->sync($request->deal_watcher);
        }

        if (!is_null($request->product_id)) {

            $products = $request->product_id;

            foreach ($products as $product) {
                $leadProduct = new LeadProduct();
                $leadProduct->deal_id = $deal->id;
                $leadProduct->product_id = $product;
                $leadProduct->save();
            }
        }
    }

    /**
     * JSON: lead custom field values for edit-from-Index
     * (docs/leads-deals-index-performance-checklist.md Task M4).
     *
     * S3 must not land before this fetch path is verified.
     */
    public function getCustomFields($id)
    {
        $lead = Lead::findOrFail($id);

        return response()->json([
            'status' => 'success',
            'custom_fields_data' => $lead->getCustomFieldsData(),
        ]);
    }

    /**
     * Resolve category id list from a request.
     * Prefers `category_ids[]`; falls back to single `category_id` unless
     * $ignoreScalarCategoryId is true (create-deal forms reuse category_id
     * for the *deal* category and must not stamp it on the lead).
     * Returns null when neither applicable field is present.
     *
     * @return array<int>|null
     */
    private function normalizeCategoryIdsFromRequest(Request $request, bool $ignoreScalarCategoryId = false): ?array
    {
        if ($request->has('category_ids')) {
            $raw = $request->input('category_ids', []);
            if (! is_array($raw)) {
                $raw = $raw === null || $raw === '' ? [] : [$raw];
            }

            return array_values(array_unique(array_filter(
                array_map(static fn ($id) => $id === null || $id === '' ? null : (int) $id, $raw),
                static fn ($id) => $id !== null && $id > 0
            )));
        }

        if (! $ignoreScalarCategoryId && $request->has('category_id')) {
            $id = $request->input('category_id');

            return $id === null || $id === '' ? [] : [(int) $id];
        }

        return null;
    }

    /**
     * Get custom field categories for the lead module.
     *
     * @return \Illuminate\Support\Collection
     */
    private function getLeadCustomFieldCategories()
    {
        $leadCustomFieldGroup = CustomFieldGroup::where('model', Lead::CUSTOM_FIELD_MODEL)->first();
        if ($leadCustomFieldGroup) {
            return CustomFieldCategory::where('custom_field_group_id', $leadCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get();
        }
        return collect();
    }

    /**
     * Download sample import file for leads
     */
    public function downloadSampleImport()
    {
        $sampleFilePath = public_path('sample-import/lead-contact-sample.xlsx');
        
        if (!file_exists($sampleFilePath)) {
            return response()->json(['error' => 'Sample file not found'], 404);
        }

        return response()->download($sampleFilePath, 'lead-contact-sample.xlsx');
    }
}

