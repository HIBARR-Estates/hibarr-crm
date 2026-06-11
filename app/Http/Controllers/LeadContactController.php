<?php

namespace App\Http\Controllers;

use App\DataTables\DealsDataTable;
use App\DataTables\LeadContactDataTable;
use App\DataTables\LeadNotesDataTable;
use App\Enums\Salutation;
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
use App\Services\PermissionService;
use App\Services\LeadService;

class LeadContactController extends AccountBaseController
{

    use ImportExcel;
    use \App\Traits\DealFormDataTrait;
    use \App\Traits\LeadFormDataTrait;

    protected $leadService;

    public function __construct(LeadService $leadService)
    {
        parent::__construct();
        $this->leadService = $leadService;
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
        $leadContacts = $this->leadService->getDropdownLeads();
        $customFieldsData = $this->leadService->getLeadCustomFieldsData();

        return Inertia::render('Leads/Index', [
            'pageTitle' => 'Lead Contacts',
            'leadContacts' => $leadContacts,
            'stages' => $this->leadService->getLeadStages(),
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
            'customFields' => $customFieldsData['customFields'],
            'customFieldCategories' => $customFieldsData['customFieldCategories'],
            'leadLifecycleStatuses' => LeadLifecycleStatus::query()
                ->orderBy('sort_order')
                ->get(['id', 'key', 'label']),
        ]);
    }


    public function show($id, Request $request)
    {
        $this->leadContact = Lead::with([
            'leadOwner',
            'addedBy',
            'leadSource:id,type',
            'category:id,category_name',
            'client:id,name,email',
            'marketing',
            'lifecycleStatus:id,key,label,label_color,sort_order',
            'activeQualification.answers',
            'activeQualification.agent:id,name,image',
        ])->findOrFail($id)->withCustomFields();

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

        $formData = $this->getLeadFormData();
        $dealFormData = $this->getDealFormData();

        // Prepare Deal specific data with namespaced custom fields to avoid collision with Lead custom fields
        $dealFormData['dealCustomFields'] = $dealFormData['customFields'];
        $dealFormData['dealCustomFieldCategories'] = $dealFormData['customFieldCategories'];
        
        // Remove colliding keys that we want to preserve from LeadFormData (or that are duplicates)
        // We keep Lead's custom fields as 'customFields' for the main Lead view
        unset($dealFormData['customFields']);
        unset($dealFormData['customFieldCategories']);
        
        // Assign trait data to class properties for backward compatibility if needed
        $this->categories = $formData['categories'];
        $this->sources = $formData['sources'];
        $this->employees = $formData['employees'];
        $this->customFieldCategories = $formData['customFieldCategories'];
        $this->fields = $formData['customFields'];

        $this->editLeadPermission = user()->permission('edit_lead');
        $this->deleteLeadPermission = user()->permission('delete_lead');

        $tab = request('tab');

        switch ($tab) {
            case 'deal':
                return $this->deals();
            case 'notes':
                return $this->notes();
            case 'marketing':
                // Load marketing data for the lead contact
                $this->leadContact = $this->leadContact->load('marketing');
                $this->view = 'lead-contact.ajax.marketing';
                break;
            default:
                $this->view = 'lead-contact.ajax.profile';
                break;
        }

        // if (request()->ajax()) {
        //     return $this->returnAjax($this->view);
        // }

        $this->activeTab = $tab ?: 'profile';

        // Get deals associated with this lead
        $deals = Deal::where('lead_id', $id)
            ->with([
                'leadAgent.user',
                'leadStage:id,name',
                'pipeline:id,name'
            ])
            ->get();

        // Transform deals to include custom fields data
        $deals = $deals->map(function ($deal) {
            // Load custom fields for each deal
            $dealWithFields = $deal->withCustomFields();
            $customFieldsData = $dealWithFields->getCustomFieldsData();
            
            // Convert to array and add custom fields data
            $dealArray = $deal->toArray();
            $dealArray['custom_fields_data'] = $customFieldsData;
            
            return $dealArray;
        });

        // Get notes associated with this lead
        $notes = LeadNote::where('lead_id', $id)
            ->with('addedBy')
            ->orderBy('created_at', 'desc')
            ->get();

        // Get deal and note permissions
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

        // Get tasks
        $tasks = $this->leadContact->tasks()
            ->with(['users', 'category', 'boardColumn', 'labels'])
            ->orderBy('id', 'desc')
            ->get();

        // Get task metadata for modal
        $taskCategories = \App\Models\TaskCategory::all();
        $taskLabels = \App\Models\TaskLabelList::all();
        $taskBoardColumns = \App\Models\TaskboardColumn::orderBy('priority')->get();
        $projects = \App\Models\Project::all();

        // Get task permissions
        $taskPermissions = [
            'add_tasks' => user()->permission('add_tasks'),
            'edit_tasks' => user()->permission('edit_tasks'),
            'delete_tasks' => user()->permission('delete_tasks'),
            'view_tasks' => user()->permission('view_tasks'),
        ];
        $deal = new Deal();
        $getCustomFieldGroupsWithFields = $deal->getCustomFieldGroupsWithFields();
        $fields = $getCustomFieldGroupsWithFields ? $getCustomFieldGroupsWithFields->fields : [];

        $leadFollowUpsQuery = DealFollowUp::with(['addedBy:id,name,image', 'meetingType', 'meetingSummary', 'deal:id,name'])
            ->where('lead_id', $id)
            ->orderBy('next_follow_up_date', 'desc');

        if (user()->permission('view_lead_follow_up') === 'added') {
            $leadFollowUpsQuery->where('added_by', user()->id);
        }

        $leadFollowUps = $leadFollowUpsQuery->get();

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

        return Inertia::render('Leads/Show', array_merge([
            'lead' => $this->leadContact,
            'fields' => $formData['customFields'],
            'editLeadPermission' => $this->editLeadPermission,
            'deleteLeadPermission' => $this->deleteLeadPermission,
            'deals' => $deals,
            'notes' => $notes,
            'dealPermissions' => $dealPermissions,
            'notePermissions' => $notePermissions,
            'tasks' => $tasks,
            'taskCategories' => $taskCategories,
            'taskLabels' => $taskLabels,
            'taskBoardColumns' => $taskBoardColumns,
            'projects' => $projects,
            'taskPermissions' => $taskPermissions,
            'dealCustomFields' => $fields,
            'leadFollowUps' => $leadFollowUps,
            'meetingTypes' => $meetingTypes,
            'followUpPermissions' => $followUpPermissions,
            'qualificationPermissions' => $qualificationPermissions,
        ], $formData, $dealFormData));
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
        $leadContact->salutation = $request->salutation;
        $leadContact->gender = $request->gender;
        $leadContact->client_name = $request->client_name;
        $leadContact->client_email = $request->client_email;
        $leadContact->note = trim_editor($request->note);
        $leadContact->source_id = $request->source_id;
        $leadContact->client_id = $existingUser?->id;
        $leadContact->lead_owner = $request->lead_owner;
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

        if ($request->has('create_deal') && $request->create_deal == 'on') {
            Session::put('create_deal_with_lead', true);
            Session::put('deal_name', $request->name);
        }
        Log::info("Create Lead Contact, b4 save");

        $leadContact->save();

        if ($request->has('create_deal') && $request->create_deal == 'on') {
            $this->storeDeal($request, $leadContact);
        }

        // To add custom fields data
        if ($request->custom_fields_data) {
            $leadContact->updateCustomFieldData($request->custom_fields_data);
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
        $this->leadContact = Lead::with('leadSource', 'category')->findOrFail($id)->withCustomFields();
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

        $leadContact->salutation = $request->salutation;
        if ($request->has('gender')) {
            $leadContact->gender = $request->gender;
        }
        $leadContact->client_name = $request->client_name;
        $leadContact->client_email = $request->client_email;
        $leadContact->note = trim_editor($request->note);
        $leadContact->source_id = $request->source_id;
        $leadContact->lead_owner = $request->lead_owner;
        $leadContact->category_id = $request->category_id;
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
        $leadContact->save();

        $clientCreated = $request->create_client == "on" ? '1' : '0';
        Deal::where('lead_id', $leadContact->id)->update(['create_client' => $clientCreated]);

        // To add custom fields data
        if ($request->custom_fields_data) {
            $leadContact->updateCustomFieldData($request->custom_fields_data);
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
                $leadContact->salutation = $request->salutation;
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
            
            // Handle categorization
            if ($request->has('category_id')) {
                $leadContact->category_id = $request->category_id;
            }
            if ($request->has('source_id')) {
                $leadContact->source_id = $request->source_id;
            }
            if ($request->has('status_id')) {
                $leadContact->status_id = $request->status_id;
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

            // Save the lead contact
            $leadContact->save();

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
                    $leadContact->updateCustomFieldData($customFieldsData);
                }
            }

            // Handle tags (if your system supports them)
            if ($request->has('tags')) {
                // Assuming you have a tags relationship
                // $leadContact->syncTags($request->tags);
            }

            // Commit transaction
            \DB::commit();

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
                    'company_name', 'website', 'address', 'city', 'state', 'country',
                    'postal_code', 'gender', 'note', 'lead_owner', 'category_id',
                    'source_id', 'agent_id', 'value', 'currency_id', 'salutation'
                ];
                
                foreach ($allowedFields as $field) {
                    if ($request->has($field)) {
                        $responseData[$field] = $leadContact->getAttribute($field);
                    }
                }
                
                // Load and include relationship data when relationship IDs are updated
                // This ensures the frontend can immediately display the updated relationship info
                if ($request->has('category_id')) {
                    $leadContact->load('category');
                    $responseData['category'] = $leadContact->category;
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
                
                // If custom fields were updated (including file uploads), include the updated custom_fields_data
                if ($request->has('custom_fields') || $request->hasFile('custom_fields')) {
                    $leadContact->withCustomFields();
                    $responseData['custom_fields_data'] = $leadContact->custom_fields_data;
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
                $leadContact->delete();
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
                $categoryId = $request->category_id;
                
                // Validate category exists if provided
                if ($categoryId) {
                    $category = LeadCategory::find($categoryId);
                    if (!$category) {
                        return Reply::error(__('messages.categoryNotFound'));
                    }
                }
                
                Lead::whereIn('id', $rowIds)->update(['category_id' => $categoryId]);
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
                Lead::whereIn('id', $rowIds)->delete();
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
        $agentId = null;

        if (!is_null($request->agent_id)) {
            $leadAgent = LeadAgent::where('user_id', $request->agent_id)->where('lead_category_id', $request->category_id)->first();
            $agentId = isset($leadAgent) ? $leadAgent->id : null;
        }

        $deal = new Deal();
        $deal->name = $request->name;
        $deal->lead_id = $leadContact->id;
        $deal->next_follow_up = 'yes';
        $deal->category_id = $request->category_id;
        $deal->save();

        // Handle deal watchers
        if ($request->deal_watcher && is_array($request->deal_watcher)) {
            $deal->dealWatchers()->sync($request->deal_watcher);
        }
        $deal->lead_pipeline_id = $request->pipeline;
        $deal->pipeline_stage_id = $request->stage_id;
        $deal->create_client = $request->create_client == "on" ? '1' : '0';
        $deal->agent_id = $agentId;
        $deal->close_date = companyToYmd($request->close_date);
        $deal->value = ($request->value) ?: 0;
        $deal->currency_id = $this->company->currency_id;
        $deal->save();

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

