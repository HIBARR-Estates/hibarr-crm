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
use App\Models\LeadNote;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\Lead;
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

class LeadContactController extends AccountBaseController
{

    use ImportExcel;
    use \App\Traits\LeadFormDataTrait;
    use \App\Traits\DealFormDataTrait;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'modules.leadContact.leadContacts';
        $this->middleware(function ($request, $next) {
            if (!in_array('leads', $this->user->modules)) {
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
            if ($request->ajax() || $request->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        // Load necessary data for the view
        $this->leadContacts = Lead::allLeads();
        $formData = $this->getLeadFormData();
        
        // Assign trait data to class properties for backward compatibility if needed
        $this->categories = $formData['categories'];
        $this->sources = $formData['sources'];
        $this->employees = $formData['employees'];
        $this->leadPipelines = $formData['leadPipelines'];
        $this->leadStages = $formData['leadStages'];
        $this->products = $formData['products'];

        // Get the leads data from the DataTable query with relationships
        $leadsQuery = $dataTable->query(new Lead())
            ->with([
                'leadOwner:id,name,email',
                'addedBy:id,name,email',
                'leadSource:id,type',
                'category:id,category_name',
                'client:id,name,email'
            ]);
        
        // Apply filters from request
        if ($request->filled('search')) {
            $leadsQuery->where(function($query) use ($request) {
                $query->where('client_name', 'like', '%' . $request->search . '%')
                      ->orWhere('client_email', 'like', '%' . $request->search . '%')
                      ->orWhere('mobile', 'like', '%' . $request->search . '%');
            });
        }

        // Apply additional filters
        if ($request->filled('lead_source')) {
            $leadsQuery->where('leads.source_id', $request->lead_source);
        }

        if ($request->filled('lead_owner_id')) {
            $leadsQuery->where('leads.lead_owner', $request->lead_owner_id);
        }

        if ($request->filled('added_by_id')) {
            $leadsQuery->where('leads.added_by', $request->added_by_id);
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $leadsQuery->whereBetween('leads.created_at', [
                $request->start_date . ' 00:00:00',
                $request->end_date . ' 23:59:59'
            ]);
        }

        // Apply permission-based filtering
        $leadRules = [
            'added' => 'leads.added_by',
            'owned' => 'leads.lead_owner'
        ];
        PermissionService::applyScope($leadsQuery, user(), 'view_lead', $leadRules);
        
        // Apply sorting if specified
        if ($request->filled('sort_by')) {
            $sortBy = $request->sort_by;
            $sortDirection = $request->get('sort_direction', 'asc');
            
            // Validate sort direction
            if (!in_array($sortDirection, ['asc', 'desc'])) {
                $sortDirection = 'asc';
            }
            
            // Map frontend sort fields to database columns
            $sortMapping = [
                'client_name' => 'leads.client_name',
                'lead_owner' => 'lead_owner_user.name',
                'created_at' => 'leads.created_at',
                'updated_at' => 'leads.updated_at',
                'company_name' => 'leads.company_name',
            ];
            
            if (isset($sortMapping[$sortBy])) {
                $leadsQuery->orderBy($sortMapping[$sortBy], $sortDirection);
            } else {
                // Default fallback
                $leadsQuery->orderBy('leads.created_at', 'desc');
            }
        } else {
            // Default sorting when no sort is specified
            $leadsQuery->orderBy('leads.created_at', 'desc');
        }
        
        // Paginate the results
        $leads = $leadsQuery->paginate($request->get('per_page', 15));
        
        // Get all the data needed for create/edit modals
        // Data is already loaded via getLeadFormData()

        return Inertia::render('Leads/Index', array_merge([
            'pageTitle' => 'Lead Contacts',
            'leadContacts' => $this->leadContacts ? $this->leadContacts->map(function($contact) {
                return [
                    'id' => $contact->id,
                    'client_name' => $contact->client_name,
                    'client_name_salutation' => $contact->client_name_salutation,
                ];
            })->toArray() : [],
            'stages' => $this->leadStages ? $this->leadStages->map(function($stage) {
                return [
                    'id' => $stage->id,
                    'name' => $stage->name,
                    'lead_pipeline_id' => $stage->lead_pipeline_id,
                    'label_color' => $stage->label_color,
                ];
            })->toArray() : [],
            'permissions' => [
                'view_lead_category' => user()->permission('view_lead_category'),
                'view_lead_sources' => user()->permission('view_lead_sources'),
                'add_lead_sources' => user()->permission('add_lead_sources'),
                'add_lead_category' => user()->permission('add_lead_category'),
                'add_product' => user()->permission('add_product'),
                'add_lead_agent' => user()->permission('add_lead_agent'),
                'view_lead_agents' => user()->permission('view_lead_agents'),
                'add_deals' => user()->permission('add_deals'),
                'add_lead' => user()->permission('add_lead'),
            ],
            'filters' => $request->only([
                'search',
                'lead_type',
                'start_date',
                'end_date',
                'lead_source',
                'lead_owner_id',
                'added_by_id'
            ]),
            'leads' => [
                'data' => $leads->items(),
                'current_page' => $leads->currentPage(),
                'last_page' => $leads->lastPage(),
                'per_page' => $leads->perPage(),
                'total' => $leads->total(),
                'from' => $leads->firstItem(),
                'to' => $leads->lastItem(),
            ]
        ], $formData));
    }


    public function show($id, Request $request)
    {
        $this->leadContact = Lead::with([
            'leadOwner',
            'addedBy',
            'leadSource:id,type',
            'category:id,category_name',
            'client:id,name,email'
        ])->findOrFail($id)->withCustomFields();

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

        return Inertia::render('Leads/Show', array_merge([
            'lead' => $this->leadContact,
            'fields' => $formData['customFields'],
            'editLeadPermission' => $this->editLeadPermission,
            'deleteLeadPermission' => $this->deleteLeadPermission,
            'deals' => $deals,
            'notes' => $notes,
            'dealPermissions' => $dealPermissions,
            'notePermissions' => $notePermissions,
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
            $leadContact->mobile = $request->mobile;
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

            // return Reply::successWithData(__('messages.recordSaved'), ['html' => $html, 'add_more' => true]);

            return back()->with('success', __('messages.recordSaved'));
        }

        if ($redirectUrl == '') {
            $redirectUrl = route('lead-contact.index');
        }

        // return Reply::successWithData(__('messages.recordSaved'), ['redirectUrl' => $redirectUrl]);

        return back()->with('success', __('messages.recordSaved'));
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
            $leadContact->mobile = $request->mobile;
        }
        $leadContact->save();

        $clientCreated = $request->create_client == "on" ? '1' : '0';
        Deal::where('lead_id', $leadContact->id)->update(['create_client' => $clientCreated]);

        // To add custom fields data
        if ($request->custom_fields_data) {
            $leadContact->updateCustomFieldData($request->custom_fields_data);
        }

        // return Reply::successWithData(__('messages.updateSuccess'), ['redirectUrl' => route('lead-contact.index')]);

        return back()->with('success', __('messages.updateSuccess'));
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
                    $leadContact->mobile = $request->mobile;
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
            if ($request->has('custom_fields')) {
                $leadContact->updateCustomFieldData($request->custom_fields);
            }

            // Handle tags (if your system supports them)
            if ($request->has('tags')) {
                // Assuming you have a tags relationship
                // $leadContact->syncTags($request->tags);
            }

            // Commit transaction
            \DB::commit();

            // Return success response for API calls or redirect for web
            if ($request->expectsJson()) {
                return Reply::successWithData(__('messages.updateSuccess'), [
                    'lead' => $leadContact->fresh(),
                    'redirectUrl' => route('lead-contact.show', $leadContact->id)
                ]);
            }

            return back()->with('success', __('messages.updateSuccess'));

        } catch (\Exception $e) {
            // Rollback transaction on error
            \DB::rollback();
            
            // Log the error
            Log::error('Lead patch update failed: ' . $e->getMessage(), [
                'lead_id' => $id,
                'user_id' => user()->id,
                'request_data' => $request->all()
            ]);

            if ($request->expectsJson()) {
                return Reply::error('An error occurred while updating the lead contact: ' . $e->getMessage());
            }

            return back()->withErrors(['error' => 'An error occurred while updating the lead contact.']);
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
             if ($request->ajax() || $request->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        Lead::destroy($id);

        // return Reply::success(__('messages.deleteSuccess'));
        return back()->with('success', __('messages.deleteSuccess'));
    }

    public function applyQuickAction(Request $request)
    {
        Lead::whereIn('id', explode(',', $request->row_ids))->delete();

        // return Reply::success(__('messages.deleteSuccess'));
        return back()->with('success', __('messages.deleteSuccess'));
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
            if ($request->wantsJson() || $request->inertia()) {
                return response()->json(['error' => __('messages.abortAction')], 400);
            }
            return Reply::error(__('messages.abortAction'));
        }

        // For Inertia requests, return a simple success response
        if ($request->inertia() || $request->wantsJson()) {
            return response()->json([
                'status' => 'success',
                'message' => __('messages.importUploadSuccess')
            ]);
        }

        // For traditional Ajax requests
        $view = view('leads.ajax.import_progress', $this->data)->render();
        return Reply::successWithData(__('messages.importUploadSuccess'), ['view' => $view]);
    }

    public function importProcess(ImportProcessRequest $request)
    {
        $batch = $this->importJobProcess($request, LeadImport::class, ImportLeadJob::class);

        if ($request->inertia() || $request->wantsJson()) {
            return response()->json([
                'status' => 'success',
                'message' => __('messages.importProcessStart'),
                'batch' => $batch
            ]);
        }

        return Reply::successWithData(__('messages.importProcessStart'), ['batch' => $batch]);
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

