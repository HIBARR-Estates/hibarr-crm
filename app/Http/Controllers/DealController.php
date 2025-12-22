<?php

namespace App\Http\Controllers;

use App\DataTables\DealNotesDataTable;
use App\DataTables\LeadFollowupDataTable;
use App\DataTables\LeadGDPRDataTable;
use App\DataTables\DealsDataTable;
use App\DataTables\ProposalDataTable;
use App\Enums\Salutation;
use App\Events\AutoFollowUpReminderEvent;
use App\Scopes\ActiveScope;
use App\Notifications\MeetingLinkGenerationFailed;
use ReflectionClass;
use Illuminate\Support\Facades\DB;
use App\Helper\Reply;
use App\Http\Requests\Admin\Employee\ImportProcessRequest;
use App\Http\Requests\Admin\Employee\ImportRequest;
use App\Http\Requests\CommonRequest;
use App\Http\Requests\FollowUp\StoreRequest as FollowUpStoreRequest;
use App\Http\Requests\Deal\PatchRequest;
use App\Http\Requests\Deal\StoreRequest;
use App\Http\Requests\Deal\UpdateRequest;
use App\Http\Requests\Deal\StageChangeRequest;
use App\Imports\DealImport;
use App\Jobs\ImportDealJob;
use App\Models\GdprSetting;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\LeadCustomForm;
use App\Models\DealFollowUp;
use App\Models\DealHistory;
use App\Models\DealNote;
use App\Models\Lead;
use App\Models\LeadPipeline;
use App\Models\LeadProduct;
use App\Models\LeadSource;
use App\Models\PipelineStage;
use App\Models\LeadStatus;
use App\Models\Product;
use App\Models\CustomFieldGroup;
use App\Models\CustomFieldCategory;
use App\Models\Proposal;
use App\Models\PurposeConsent;
use App\Models\PurposeConsentLead;
use App\Models\User;
use App\Models\Package;
use App\Models\CommunicationActivity;
use App\Traits\ImportExcel;
use App\Traits\DealAutomationTrait;
use App\Traits\DealFormDataTrait;
use Carbon\Carbon;
use Illuminate\Http\Request;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use App\Services\PermissionService;

class DealController extends AccountBaseController
{

    use ImportExcel;
    use DealAutomationTrait;
    use \App\Traits\DealFormDataTrait;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.deal';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array('leads', $this->user->modules));

            $this->viewLeadPermission = user()->permission('view_deals');
            $this->viewEmployeePermission = user()->permission('view_employees');
            $this->viewDealLeadPermission = user()->permission('view_lead');
            $this->viewLeadAgentPermission = user()->permission('view_lead_agents');
            $this->viewLeadCategoryPermission = user()->permission('view_lead_category');

            return $next($request);
        });
    }

    public function index(DealsDataTable $dataTable, Request $request)
    {
        $this->destroySession();
        // abort_403(!in_array($this->viewLeadPermission, ['all', 'added', 'both', 'owned']));

        $this->loadDataForView();

        // Get deals with pagination using relationships
        $dealsQuery = Deal::with([
            'leadAgent.user:id,name,email,image',
            'category:id,category_name',
            'contact:id,client_name,client_email,mobile,company_name',
            'pipeline:id,name',
            'leadStage:id,name,label_color,slug',
            'currency:id,currency_symbol,currency_code',
            'products:id,name',
            'tasks' => function($q) {
                $q->with(['deals', 'leads', 'properties']);
            }
        ])
        ->select(
            'deals.id',
            'deals.name',
            'deals.lead_id',
            'deals.lead_pipeline_id',
            'deals.agent_id',
            'deals.added_by',
            'deals.next_follow_up',
            'deals.value',
            'deals.pipeline_stage_id',
            'deals.created_at',
            'deals.close_date',
            'deals.updated_at',
            'deals.currency_id',
            'deals.category_id'
        );
        
        // Apply filters from request
        if ($request->filled('search')) {
            $searchTerm = $request->search;
            $dealsQuery->where(function($query) use ($searchTerm) {
                $query->where('deals.name', 'like', '%' . $searchTerm . '%')
                      ->orWhereHas('contact', function($q) use ($searchTerm) {
                          $q->where('client_name', 'like', '%' . $searchTerm . '%')
                            ->orWhere('client_email', 'like', '%' . $searchTerm . '%')
                            ->orWhere('company_name', 'like', '%' . $searchTerm . '%');
                      });
            });
        }

        if ($request->filled('lead_pipeline_id') && $request->lead_pipeline_id !== 'all') {
            $dealsQuery->where('deals.lead_pipeline_id', $request->lead_pipeline_id);
        }

        if ($request->filled('pipeline_stage_id') && $request->pipeline_stage_id !== 'all') {
            $dealsQuery->where('deals.pipeline_stage_id', $request->pipeline_stage_id);
        }

        if ($request->filled('category_id') && $request->category_id !== 'all') {
            $dealsQuery->where('deals.category_id', $request->category_id);
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $dealsQuery->whereBetween('deals.created_at', [
                $request->start_date . ' 00:00:00',
                $request->end_date . ' 23:59:59'
            ]);
        }

        if ($request->agent_status == 'unassigned') {
            $dealsQuery->whereNull('deals.agent_id');
        } elseif ($request->filled('agent_id') && $request->agent_id != 'all') {
            $dealsQuery->whereHas('leadAgent', function ($q) use ($request) {
                $q->where('user_id', $request->agent_id);
            });
        } elseif ($request->agent_status == 'active') {
            $dealsQuery->whereHas('leadAgent.user', function ($q) {
                $q->where('status', 'active');
            });
        } elseif ($request->agent_status == 'inactive') {
            $dealsQuery->whereHas('leadAgent.user', function ($q) {
                $q->where('status', '!=', 'active');
            });
        }

        // Apply permission-based filtering
        $dealRules = [
            'added' => 'deals.added_by',
            'owned' => function($q, $user) {
                $q->where(function($query) use ($user) {
                    $query->whereHas('leadAgent', function($q) use ($user) {
                        $q->where('user_id', $user->id);
                    })->orWhereHas('dealWatchers', function($q) use ($user) {
                        $q->where('users.id', $user->id);
                    });
                });
            }
        ];
        PermissionService::applyScope($dealsQuery, user(), 'view_deals', $dealRules);
        
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
                'name' => 'deals.name',
                'value' => 'deals.value',
                'next_follow_up_date' => 'deals.next_follow_up',
                'created_at' => 'deals.created_at',
                'updated_at' => 'deals.updated_at',
            ];
            
            if (isset($sortMapping[$sortBy])) {
                $dealsQuery->orderBy($sortMapping[$sortBy], $sortDirection);
            } else {
                // Default fallback
                $dealsQuery->orderBy('deals.created_at', 'desc');
            }
        } else {
            // Default sorting when no sort is specified
            $dealsQuery->orderBy('deals.created_at', 'desc');
        }
        
        $paginatedDeals = $dealsQuery->paginate($request->get('per_page', 15));

        // Load additional data needed for the forms
        $formData = $this->getDealFormData();

        // Transform deals to include custom fields data
        $dealsWithCustomFields = $paginatedDeals->getCollection()->map(function ($deal) {
            // Load custom fields for each deal
            $dealWithFields = $deal->withCustomFields();
            $customFieldsData = $dealWithFields->getCustomFieldsData();
            
            // Convert to array and add custom fields data
            $dealArray = $deal->toArray();
            $dealArray['custom_fields_data'] = $customFieldsData;
            
            return $dealArray;
        });

        return Inertia::render('Deals/Index', array_merge([
            'pageTitle' => 'Deals',
            'deals' => [
                'data' => $dealsWithCustomFields,
                'current_page' => $paginatedDeals->currentPage(),
                'per_page' => $paginatedDeals->perPage(),
                'total' => $paginatedDeals->total(),
                'last_page' => $paginatedDeals->lastPage(),
                'from' => $paginatedDeals->firstItem(),
                'to' => $paginatedDeals->lastItem(),
            ],
            'pipelines' => $this->pipelines,
            'defaultPipeline' => $this->defaultPipeline,
            'filters' => $request->only([
                'lead_pipeline_id',
                'pipeline_stage_id',
                'category_id',
                'search',
                'start_date',
                'end_date',
            ]),
        ], $formData));
    }

    protected function loadDataForView()
    {
        $this->loadPipelineData();
        $this->loadDealData();
        $this->loadLeadAgents();
        $this->loadDealWatcher();
        $this->loadDealLeads();
        $this->loadPackages();
    }

    protected function loadPipelineData()
    {
        $this->pipelines = LeadPipeline::all();
        $defaultPipeline = LeadPipeline::where('default', 1)->first();
        $this->defaultPipeline = $defaultPipeline;
        $this->stages = PipelineStage::where('lead_pipeline_id', optional($defaultPipeline)->id)->get();
        $this->categories = LeadCategory::all();
        $this->sources = LeadSource::all();
    }

    protected function loadDealData()
    {
        $this->totalDeals = Deal::all();
        $this->totalClientConverted = $this->totalDeals->whereNotNull('client_id')->count();
        $this->totalLeads = $this->totalDeals->count();
        $this->pendingLeadFollowUps = DealFollowUp::whereDate('next_follow_up_date', '<=', now()->format('Y-m-d'))
            ->join('deals', 'deals.id', 'lead_follow_up.deal_id')
            ->where('deals.next_follow_up', 'yes')
            ->groupBy('lead_follow_up.deal_id')
            ->count();
        $this->dealAgents = LeadAgent::with('user')
            ->whereHas('user', function ($q) {
                $q->where('status', 'active');
            })->where('status', 'enabled')->groupBy('user_id')->get();
    }

    protected function loadLeadAgents()
    {
        $this->leadAgents = LeadAgent::with('user')
            ->whereHas('user', function ($q) {
                $q->where('status', 'active');
            })->groupBy('user_id')->get();

        $this->nonActiveLeadAgents = LeadAgent::with('user')
            ->whereHas('user', function ($q) {
                $q->where('status', '!=', 'active');
            })->groupBy('user_id')->get();
    }

    protected function loadDealWatcher()
    {
        $this->dealWatcher = User::allEmployees(null);

        if (in_array($this->viewEmployeePermission, ['added', 'owned', 'both'])) {
            $this->dealWatcher = $this->dealWatcher->where(function ($query) {
                $query->when($this->viewEmployeePermission == 'added', function ($q) {
                    $q->where('employee_details.added_by', user()->id);
                })->when($this->viewEmployeePermission == 'owned', function ($q) {
                    $q->where('employee_details.user_id', user()->id);
                })->when($this->viewEmployeePermission == 'both', function ($q) {
                    $q->where('employee_details.user_id', user()->id)
                        ->orWhere('employee_details.added_by', user()->id);
                });
            });
        }
    }

    protected function loadDealLeads()
    {
        $this->dealLeads = Lead::select(['id', 'client_name'])->get();
    }

    protected function loadPackages()
    {
        $this->packages = Package::all();
    }

    public function show($id)
    {
        $deal = Deal::with([
            'leadAgent.user',
            'contact',
            'category',
            'pipeline.stages',
            'leadStage',
            'currency',
            'products:id,name',
            'package:id,name',
            'communicationActivities',
            'hibarrFields',
            'dealWatchers' => function ($query) {
                $query->withoutGlobalScope(ActiveScope::class)
                      ->select('users.id', 'users.name', 'users.image', 'users.email', 'users.status')
                      ->with('employeeDetail.designation:id,name')
                      ->where('users.status', '!=', 'deactive')
                      ->orderBy('users.name');
            }
        ])->findOrFail($id);
        $this->loadDataForView();

        
        // Load custom fields data
        $deal = $deal->withCustomFields();
        
        // Get custom fields data explicitly
        $customFieldsData = $deal->getCustomFieldsData();

        $getCustomFieldGroupsWithFields = $deal->getCustomFieldGroupsWithFields();
        $this->fields = $getCustomFieldGroupsWithFields ? $getCustomFieldGroupsWithFields->fields : [];

        $dealRules = [
            'added' => 'added_by',
            'owned' => function($user, $deal) {
                // Check if user is the assigned agent
                $isAgent = $deal->leadAgent && $deal->leadAgent->user_id == $user->id;
                
                // Check if user is a watcher (check DB directly to avoid eager loading filter issues)
                $isWatcher = $deal->dealWatchers()->where('user_id', $user->id)->exists();
                
                return $isAgent || $isWatcher;
            }
        ];

        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, $dealRules);

        if (!$access['canAccess']) {
            if (request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $productNames = $deal->products->pluck('name')->toArray();
        $customFieldCategories = $this->getDealCustomFieldCategories();
        
        $getCustomFieldGroupsWithFields = $deal->getCustomFieldGroupsWithFields();
        $fields = null;
        if ($getCustomFieldGroupsWithFields) {
            $fields = $getCustomFieldGroupsWithFields->fields;
        }

        // Get notes data
        $notes = DealNote::with('addedBy')
            ->where('deal_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        $viewNotesPermission = user()->permission('view_deal_note');
        
        if ($viewNotesPermission == 'none') {
            $notes = collect();
        } elseif ($viewNotesPermission == 'added') {
            $notes = $notes->where('added_by', user()->id);
        } elseif ($viewNotesPermission == 'owned') {
            $notes = $notes->where('added_by', '!=', user()->id);
        }

        // Always load these collections regardless of tab
        $histories = DealHistory::where('deal_id', $id)->orderBy('created_at', 'desc')->get();
        
        $activities = CommunicationActivity::where('deal_id', $id)
            ->with(['deal', 'lead'])
            ->orderBy('timestamp', 'desc')
            ->get();
        
        $consents = PurposeConsent::with(['lead' => function ($query) use ($id) {
            $query->where('lead_id', $id)
                ->orderByDesc('created_at');
        }])->get();

        $gdprSetting = GdprSetting::first();

        // Get follow-ups data
        $dealFollowUps = DealFollowUp::with(['addedBy:id,name,image', 'meetingType', 'meetingSummary'])
            ->where('deal_id', $id)
            ->orderBy('next_follow_up_date', 'desc')
            ->get();

        // if (user()->permission('view_lead_follow_up') == 'added') {
        //     $dealFollowUps = $dealFollowUps->where('added_by', user()->id);
        // }

        // Get meeting types for follow-up forms
        $meetingTypes = \App\Models\MeetingType::where('company_id', company()->id)
            ->select('id', 'name', 'color')
            ->get();

        // Get files data
        $files = $deal->files()->orderBy('created_at', 'desc')->get();
        
        $viewFilesPermission = user()->permission('view_lead_files');
        if ($viewFilesPermission == 'added') {
            $files = $files->where('added_by', user()->id);
        }

        // Get proposals data
        $proposals = [];
        if (in_array(user()->permission('view_lead_proposals'), ['all', 'added'])) {
            $proposals = Proposal::with(['addedBy:id,name,image', 'currency:id,currency_symbol,currency_code', 'signature'])
                ->where('deal_id', $id)
                ->orderBy('created_at', 'desc')
                ->get();

            if (user()->permission('view_lead_proposals') == 'added') {
                $proposals = $proposals->where('added_by', user()->id);
            }
        }
        $proposals = $proposals ?: collect();

        // Permission checks
        $permissions = [
            'view_deal_note' => user()->permission('view_deal_note'),
            'add_deal_note' => user()->permission('add_deal_note'),
            'edit_deal_note' => user()->permission('edit_deal_note'),
            'delete_deal_note' => user()->permission('delete_deal_note'),
            'view_lead_follow_up' => user()->permission('view_lead_follow_up'),
            'add_lead_follow_up' => user()->permission('add_lead_follow_up'),
            'edit_lead_follow_up' => user()->permission('edit_lead_follow_up'),
            'delete_lead_follow_up' => user()->permission('delete_lead_follow_up'),
            'view_lead_proposals' => user()->permission('view_lead_proposals'),
            'add_lead_proposals' => user()->permission('add_lead_proposals'),
            'edit_lead_proposals' => user()->permission('edit_lead_proposals'),
            'delete_lead_proposals' => user()->permission('delete_lead_proposals'),
            'add_invoices' => user()->permission('add_invoices'),
            'view_lead_files' => user()->permission('view_lead_files'),
            'add_lead_files' => user()->permission('add_lead_files'),
            'delete_deals' => user()->permission('delete_deals'),
        ];

        // Prepare deal with custom fields data
        $dealWithCustomFields = $deal->toArray();
        $dealWithCustomFields['custom_fields_data'] = $customFieldsData;
        
        $formData = $this->getDealFormData();

        // Get tasks
        $tasks = $deal->tasks()
            ->with(['users', 'category', 'boardColumn', 'labels', 'deals', 'leads', 'properties'])
            ->orderBy('id', 'desc')
            ->get();

        // Get task metadata for modal
        $taskCategories = \App\Models\TaskCategory::all();
        $taskLabels = \App\Models\TaskLabelList::all();
        $taskBoardColumns = \App\Models\TaskboardColumn::orderBy('priority')->get();
        $employees = User::allEmployees();
        $projects = \App\Models\Project::all();

        return Inertia::render('Deals/Show', array_merge([
            'deal' => $dealWithCustomFields,
            'productNames' => $productNames,
            'fields' => $formData['customFields'], // Map customFields to fields as well
            'notes' => $notes,
            'dealFollowUps' => $dealFollowUps,
            'meetingTypes' => $meetingTypes,
            'files' => $files,
            'proposals' => $proposals,
            'histories' => $histories,
            'activities' => $activities,
            'consents' => $consents,
            'gdprSetting' => $gdprSetting,
            'permissions' => $permissions,
            'pageTitle' => $deal->name,
            'tasks' => $tasks,
            'taskCategories' => $taskCategories,
            'taskLabels' => $taskLabels,
            'taskBoardColumns' => $taskBoardColumns,
            'employees' => $employees,
            'projects' => $projects,
        ], $formData));
    }

    private function prepareNotesTab(int $dealId): void
    {
        $this->notes = DealNote::where('deal_id', $dealId)->orderBy('created_at', 'desc')->get();
        $viewNotesPermission = user()->permission('view_deal_note');
        abort_403(!($viewNotesPermission == 'all' || $viewNotesPermission == 'added' || $viewNotesPermission == 'both' || $viewNotesPermission == 'owned'));

        if (user()->permission('view_deal_note') == 'added') {
            $this->notes = $this->notes->where('added_by', user()->id);
        } elseif (user()->permission('view_deal_note') == 'owned') {
            $this->notes = $this->notes->where('added_by', '!=', user()->id);
        }

        $this->tab = 'leads.ajax.notes';
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        $this->addPermission = user()->permission('add_deals');
        abort_403(!in_array($this->addPermission, ['all', 'added']));

        $this->employees = User::allEmployees(null, true);

        $defaultStatus = LeadStatus::where('default', '1')->first();
        $this->columnId = ((request('column_id') != '') ? request('column_id') : $defaultStatus->id);
        $this->leadAgents = LeadAgent::with('user')->whereHas('user', function ($q) {
            $q->where('status', 'active');
        })->get();

        $this->stage = (request()->has('column_id') && !is_null(request()->column_id)) ? PipelineStage::find(request()->column_id) : null;
        $this->contactID = (request()->has('contact_id') && !is_null(request()->contact_id)) ? request()->contact_id : null;

        $this->leadAgentArray = $this->leadAgents->pluck('user_id')->toArray();

        if ((in_array(user()->id, $this->leadAgentArray))) {
            $this->myAgentId = $this->leadAgents->filter(function ($value, $key) {
                return $value->user_id == user()->id;
            })->first()->id;
        }

        $deal = new Deal();
        $getCustomFieldGroupsWithFields = $deal->getCustomFieldGroupsWithFields();

        if ($getCustomFieldGroupsWithFields) {
            $this->fields = $getCustomFieldGroupsWithFields->fields;
        }

        $this->leadContacts = Lead::allLeads();
        $this->products = Product::all();
        $this->sources = LeadSource::all();
        $this->stages = PipelineStage::all();
        $this->categories = LeadCategory::query();

        if ($this->viewLeadCategoryPermission == 'added') {
            $this->categories->where('added_by', user()->id);
        } elseif ($this->viewLeadCategoryPermission == 'both') {
            $this->categories->where(function ($query) {
                $query->where('added_by', user()->id);
            });
        }

        $this->categories = $this->categories->get();

        $this->leadPipelines = LeadPipeline::orderBy('default', 'DESC')->get();
        $this->leadStages = PipelineStage::all();
        $this->countries = countries();

        $this->pageTitle = __('modules.deal.createTitle');
        $this->salutations = Salutation::cases();

        $this->customFieldCategories = $this->getDealCustomFieldCategories();

        $this->view = 'leads.ajax.create';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        // For Inertia requests, return structured data
        if (request()->header('X-Inertia')) {
            return Inertia::render('Deals/Create', $this->data);
        }

        return view('leads.create', $this->data);
    }

    /**
     * @param StoreRequest $request
     * @return array|void
     * @throws RelatedResourceNotFoundException
     */
    public function store(StoreRequest $request)
    {
        $this->addPermission = user()->permission('add_deals');
        abort_403(!in_array($this->addPermission, ['all', 'added']));

        $agentId = null;
        if (!is_null($request->agent_id)) {
            // $leadAgent = LeadAgent::where('user_id', $request->agent_id)->where('lead_category_id', $request->category_id)->first();
            $leadAgent = LeadAgent::find($request->agent_id);
            $agentId = isset($leadAgent) ? $leadAgent->id : null;
        }
        $deal = new Deal();
        $deal->name = $request->name;
        $deal->lead_id = $request->lead_contact;
        $deal->next_follow_up = 'yes';
        $deal->category_id = $request->category_id;
        $deal->lead_pipeline_id = $request->pipeline;
        $deal->pipeline_stage_id = $request->stage_id;
        $deal->agent_id = $agentId;
        $deal->package_id = $request->package_id;
        $deal->close_date = $request->close_date ? $this->safeCompanyToYmd($request->close_date) : null;
        $deal->value = ($request->value) ?: 0;
        $deal->currency_id = $this->company->currency_id;
        // TODO: THis should be uncommented after testing, and Eisntein sync to resolve issues
        // $deal->strategy_accepted = $request->has('strategy_accepted') ? 1 : 0;
        // $deal->downpayment_confirmed = $request->has('downpayment_confirmed') ? 1 : 0;
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

        // To add custom fields data
        if ($request->custom_fields_data) {
            $deal->updateCustomFieldData($request->custom_fields_data);
        }

        // TODO: THis should be uncommented after testing, and Eisntein sync to resolve issues
        // $this->triggerDealCreationAutomation($request);

        // Log search
        $this->logSearchEntry($deal->id, $deal->name, 'deals.show', 'deal');

        $redirectUrl = urldecode($request->redirect_url);

        if ($request->add_more === 'true') {
            Log::info('Deal saved with add_more=true, deal ID: ' . $deal->id);
            // Return fresh form HTML for add more functionality
            $html = $this->create();
            // return Reply::successWithData(__('messages.recordSaved'), ['html' => $html, 'add_more' => true]);
            return back()->with([
                'status' => 'success',
                'message' => __('messages.dealSaved')
            ]);
        }


        if ($redirectUrl == '') {
            $redirectUrl = route('deals.index');
        }

        return Reply::successWithData(__('messages.dealSaved'), ['redirectUrl' => $redirectUrl, 'deal' => $deal]);
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param int $id
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        $this->deal = Deal::with([
            'currency', 
            'leadAgent', 
            'leadAgent.user', 
            'products', 
            'leadStage', 
            'dealWatchers' => function ($query) {
                $query->withoutGlobalScope(ActiveScope::class)
                      ->select('users.id', 'users.name', 'users.image', 'users.email', 'users.status')
                      ->with('employeeDetail.designation:id,name')
                      ->orderBy('users.name');
            }
        ])->findOrFail($id)->withCustomFields();

        $this->productIds = $this->deal->products->pluck('id')->toArray();

        $this->employees = User::allEmployees(null, false);

        $dealRules = [
            'added' => 'added_by',
            'owned' => function($user, $deal) {
                // Check if user is the assigned agent
                $isAgent = $deal->leadAgent && $deal->leadAgent->user_id == $user->id;
                
                // Check if user is a watcher (check DB directly to avoid eager loading filter issues)
                $isWatcher = $deal->dealWatchers()->where('user_id', $user->id)->exists();
                
                return $isAgent || $isWatcher;
            }
        ];

        $access = PermissionService::checkAccess(user(), 'edit_deals', $this->deal, $dealRules);

        if (!$access['canAccess']) {
            if (request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $this->tab = (!is_null(request('tab'))) ? request('tab') : null;
        // Filter out active employees
        $activeEmployees = $this->employees->filter(function ($employee) {
            return $employee->status !== 'deactive';
        });

        // Get the selected employees who are deal watchers
        $selectedEmployees = $this->deal->dealWatchers->pluck('id')->toArray();
        
        // Include any deactivated employees who are watchers
        $deactivatedWatchers = $this->deal->dealWatchers->where('status', 'deactive');
        if ($deactivatedWatchers->isNotEmpty()) {
            $this->employees = $activeEmployees->merge($deactivatedWatchers);
        } else {
            $this->employees = $activeEmployees;
        }

        $this->leadAgents = LeadAgent::with('user')->whereHas('user', function ($q) {
            $q->where('status', 'active');
        })->get();

        $getCustomFieldGroupsWithFields = $this->deal->getCustomFieldGroupsWithFields();

        if ($getCustomFieldGroupsWithFields) {
            $this->fields = $getCustomFieldGroupsWithFields->fields;
        }

        $this->categories = LeadCategory::query();

        if ($this->viewLeadCategoryPermission == 'added') {
            $this->categories->where('added_by', user()->id);
        } elseif ($this->viewLeadCategoryPermission == 'both') {
            $this->categories->where(function ($query) {
                $query->where('added_by', user()->id);
            });
        }

        $this->categories = $this->categories->get();
        $this->leadContacts = Lead::all();
        $this->products = Product::all();
        $this->leadPipelines = LeadPipeline::all();

        $this->stages = PipelineStage::all();

        $this->pageTitle = __('modules.deal.updateDeal');
        $this->salutations = Salutation::cases();

        $this->customFieldCategories = $this->getDealCustomFieldCategories();

        $this->view = 'leads.ajax.edit';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('leads.create', $this->data);
    }

    /**
     * @param UpdateRequest $request
     * @param int $id
     * @return array|void
     * @throws RelatedResourceNotFoundException
     */
    public function update(UpdateRequest $request, $id)
    {
        $deal = Deal::with('leadAgent', 'leadAgent.user')->findOrFail($id);
        $dealRules = [
            'added' => 'added_by',
            'owned' => function($user, $deal) {
                // Check if user is the assigned agent
                $isAgent = $deal->leadAgent && $deal->leadAgent->user_id == $user->id;
                
                // Check if user is a watcher (check DB directly to avoid eager loading filter issues)
                $isWatcher = $deal->dealWatchers()->where('user_id', $user->id)->exists();
                
                return $isAgent || $isWatcher;
            }
        ];

        $access = PermissionService::checkAccess(user(), 'edit_deals', $deal, $dealRules);

        if (!$access['canAccess']) {
            if (request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        if (!is_null($request->agent_id)) {
            // $leadAgent = LeadAgent::where('user_id', $request->agent_id)->where('lead_category_id', $request->category_id)->first();
            // ensures that the check is done direclty on the LeadAgent model
            $leadAgent = LeadAgent::find($request->agent_id);
            $deal->agent_id = $leadAgent ? $leadAgent->id : null;
        } else {
            // ensures that the agent_id is set to null if no agent is provided
            $deal->agent_id = $request->agent_id;
        }

        $deal->name = $request->name;
        $deal->next_follow_up = $request->next_follow_up;
        $deal->lead_pipeline_id = $request->pipeline;
        $deal->pipeline_stage_id = $request->stage_id;
        $deal->package_id = $request->package_id;
        $deal->close_date = $request->close_date ? $this->safeCompanyToYmd($request->close_date) : null;
        $deal->value = ($request->value) ?: 0;
        $deal->currency_id = $this->company->currency_id;
        $deal->category_id = $request->category_id;
        // TODO: Einstein sync issue - comment these two lines for now
        // $deal->strategy_accepted = $request->has('strategy_accepted') ? 1 : 0;
        // $deal->downpayment_confirmed = $request->has('downpayment_confirmed') ? 1 : 0;
        
        // Debug logging
        Log::info('Deal update - strategy_accepted: ' . ($deal->strategy_accepted ? 'true' : 'false'));
        Log::info('Deal update - downpayment_confirmed: ' . ($deal->downpayment_confirmed ? 'true' : 'false'));
        
        $deal->save();

        // Handle deal watchers
        if ($request->deal_watcher && is_array($request->deal_watcher)) {
            $deal->dealWatchers()->sync($request->deal_watcher);
        }

        $deal->products()->sync($request->product_id);

        // To add custom fields data
        if ($request->custom_fields_data) {
            $deal->updateCustomFieldData($request->custom_fields_data);
        }
        $redirectTo = (!is_null(request('tab')) && request('tab') == 'overview') ? route('deals.show', [$deal->id]) : route('deals.index');


        // TODO: THis should be uncommented after testing, and Eisntein sync to resolve issues
        // $this->triggerDealUpdateAutomation($request, $deal);

        return Reply::successWithData(__('messages.dealUpdateSuccess'), ['redirectUrl' => $redirectTo]);
    }

    /**
     * Patch (partial update) a deal record.
     * Allows updating any subset of deal fields.
     */
    public function patch(PatchRequest $request, $id)
    {
        $deal = Deal::with('contact')->findOrFail($id);
        
        // Check permissions
        $leadAgentId = ($deal->leadAgent != null) ? $deal->leadAgent->user->id : 0;
        $editPermission = user()->permission('edit_deals');
        
        abort_403(!(
            $editPermission == 'all'
            || ($editPermission == 'added' && $deal->added_by == user()->id)
            || ($editPermission == 'owned' && $leadAgentId == user()->id)
            || ($editPermission == 'both' && ($deal->added_by == user()->id || $leadAgentId == user()->id))
        ));

        // Get validated data
        $validatedData = $request->validated();
        
        // Start database transaction
        DB::beginTransaction();
        
        try {
            // 1. Update Deal Fields
            $dealFields = [
                'deal_name' => 'name',
                'value' => 'value',
                'currency_id' => 'currency_id',
                'pipeline_stage_id' => 'pipeline_stage_id',
                'lead_pipeline_id' => 'lead_pipeline_id',
                'close_date' => 'close_date',
                'probability' => 'probability',
                'note' => 'note',
                'agent_id' => 'agent_id', //can be null
                'lead_id' => 'lead_id',
                'category_id' => 'category_id',
                'source_id' => 'source_id',
                'status' => 'status',
                'priority' => 'priority',
            ];

            $dealUpdates = [];
            foreach ($dealFields as $requestKey => $dbColumn) {
                if (array_key_exists($requestKey, $validatedData)) {
                    $dealUpdates[$dbColumn] = $validatedData[$requestKey];
                }
            }

            // Handle dates
            if (isset($dealUpdates['close_date'])) {
                $dealUpdates['close_date'] = Carbon::parse($dealUpdates['close_date'])->format('Y-m-d');
            }

            // Handle next_follow_up
            if ($request->has('next_follow_up_date') || $request->has('next_follow_up_time')) {
                $date = $request->next_follow_up_date ?? ($deal->next_follow_up ? Carbon::parse($deal->next_follow_up)->format('Y-m-d') : now()->format('Y-m-d'));
                $time = $request->next_follow_up_time ?? ($deal->next_follow_up ? Carbon::parse($deal->next_follow_up)->format('H:i') : '00:00');
                $dealUpdates['next_follow_up'] = Carbon::parse("$date $time")->format('Y-m-d H:i:s');
            }

            if (!empty($dealUpdates)) {
                $deal->update($dealUpdates);
            }

            // 2. Update Lead (Contact) Fields
            if ($deal->lead_id) {
                $lead = $deal->contact;
                if ($lead) {
                    $leadFields = [
                        'client_name' => 'client_name',
                        'client_email' => 'client_email',
                        'mobile' => 'mobile',
                        'company_name' => 'company_name',
                        'website' => 'website',
                        'address' => 'address',
                        'city' => 'city',
                        'state' => 'state',
                        'postal_code' => 'postal_code',
                    ];

                    $leadUpdates = [];
                    foreach ($leadFields as $requestKey => $dbColumn) {
                        if (array_key_exists($requestKey, $validatedData)) {
                            $leadUpdates[$dbColumn] = $validatedData[$requestKey];
                        }
                    }

                    // Handle Country ID -> Name conversion
                    if (array_key_exists('country_id', $validatedData)) {
                        $country = DB::table('countries')->where('id', $validatedData['country_id'])->first();
                        if ($country) {
                            $leadUpdates['country'] = $country->name;
                        }
                    }

                    if (!empty($leadUpdates)) {
                        $lead->update($leadUpdates);
                    }
                }
            }
            
            // 3. Handle Products
            if (array_key_exists('products', $validatedData) && is_array($validatedData['products'])) {
                $deal->products()->sync($validatedData['products']);
            }
            
            // 4. Handle Custom Fields
            if (array_key_exists('custom_fields', $validatedData) && is_array($validatedData['custom_fields'])) {
                $deal->updateCustomFieldData($validatedData['custom_fields']);
            }
            
            // Handle tags if provided
            if (array_key_exists('tags', $validatedData)) {
                // This assumes you have a tags relationship and tagging system
                // You might need to implement this based on your tagging system
                // $deal->syncTags($validatedData['tags']);
            }
            
            // Log the update in deal history
            $this->logDealHistory($deal, 'Deal updated via quick fix', $dealUpdates);
            
            DB::commit();
            
            // Return JSON response for AJAX requests (like QuickFixModal)
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json([
                    'success' => true,
                    'message' => __('messages.dealUpdateSuccess'),
                    'data' => $deal->fresh()->load(['leadAgent.user', 'contact', 'pipeline', 'leadStage', 'category', 'products'])
                ]);
            }
            
            return back()->with([
                'status' => 'success',
                'message' => __('messages.dealUpdateSuccess')
            ]);
            
        } catch (\Exception $e) {
            DB::rollback();
            
            if ($request->wantsJson() || $request->ajax()) {
                return response()->json([
                    'success' => false,
                    'message' => 'An error occurred while updating the deal.',
                    'error' => $e->getMessage()
                ], 500);
            }
            
            return back()->with([
                'status' => 'error',
                'message' => __('messages.errorOccurred')
            ]);
        }
    }
    
    /**
     * Log deal history for tracking changes
     */
    private function logDealHistory($deal, $action, $changes = [])
    {
        try {
            DealHistory::create([
                'deal_id' => $deal->id,
                'user_id' => user()->id,
                'action' => $action,
                'details' => json_encode([
                    'changed_fields' => array_keys($changes),
                    'timestamp' => now(),
                    'user_name' => user()->name
                ])
            ]);
        } catch (\Exception $e) {
            // Log the error but don't fail the main operation
            Log::warning('Failed to log deal history: ' . $e->getMessage());
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
        $deal = Deal::with('leadAgent', 'leadAgent.user')->findOrFail($id);
        $dealRules = [
            'added' => 'added_by',
            'owned' => function($user, $deal) {
                // Check if user is the assigned agent
                $isAgent = $deal->leadAgent && $deal->leadAgent->user_id == $user->id;
                
                // Check if user is a watcher (check DB directly to avoid eager loading filter issues)
                $isWatcher = $deal->dealWatchers()->where('user_id', $user->id)->exists();
                
                return $isAgent || $isWatcher;
            }
        ];

        $access = PermissionService::checkAccess(user(), 'delete_deals', $deal, $dealRules);

        if (!$access['canAccess']) {
            if (request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $model = new ReflectionClass('App\Models\Deal');

        DB::table('custom_fields_data')
            ->where('model', $model->getName())
            ->where('model_id', $id)
            ->delete();

        Deal::destroy($id);

        // return Reply::success(__('messages.deleteSuccess'));
        return to_route('deals.index')->with([
            'status' => 'success',
            'message' => __('messages.deleteSuccess')
        ]);
    }

    /**
     * @param CommonRequest $request
     * @return array
     */
    public function changeStatus(CommonRequest $request)
    {
        $deal = Deal::findOrFail($request->leadID);
        $this->editPermission = user()->permission('edit_deals');
        $this->changeLeadStatusPermission = user()->permission('change_deal_stages');

        abort_403(!(($this->editPermission == 'all' || ($this->editPermission == 'added' && $deal->added_by == user()->id)) || $this->changeLeadStatusPermission == 'all'));

        $deal->status_id = $request->statusID;
        $deal->save();

        $this->triggerDealUpdateAutomation($request, $deal);

        return Reply::success(__('messages.recordSaved'));
    }

    public function applyQuickAction(Request $request)
    {
        switch ($request->action_type) {
            case 'delete':
                $this->deleteRecords($request);

                // return Reply::success(__('messages.deleteSuccess'));
                return back()->with([
                    'status' => 'success',
                    'message' => __('messages.deleteSuccess')
                ]); 
            case 'change-status':
                $this->changeBulkStatus($request);

                // return Reply::success(__('messages.updateSuccess'));
                return back()->with([
                    'status' => 'success',
                    'message' => __('messages.updateSuccess')
                ]);

            case 'change-deal-agents':
                $this->changeAgentStatus($request);

                // return Reply::success(__('messages.updateSuccess'));
                return back()->with([
                    'status' => 'success',
                    'message' => __('messages.updateSuccess')
                ]);

            default:
                // return Reply::error(__('messages.selectAction'));
                return back()->with([
                    'status' => 'error',
                    'message' => __('messages.selectAction')
                ]);
        }
    }

    protected function deleteRecords($request)
    {
        abort_403(user()->permission('delete_deals') != 'all');

        $model = new ReflectionClass('App\Models\Deal');

        DB::table('custom_fields_data')
            ->where('model', $model->getName())
            ->whereIn('model_id', explode(',', $request->row_ids))
            ->delete();

        Deal::whereIn('id', explode(',', $request->row_ids))->delete();
    }

    protected function changeBulkStatus($request)
    {
        $canEditDeals = user()->permission('edit_deals') == 'all';
        $canChangeStages = user()->permission('change_deal_stages') == 'all';

        abort_403(!($canEditDeals || $canChangeStages));

        $rowIds = explode(',', $request->row_ids);
        $newStatus = $request->status;

        $stage = PipelineStage::find($newStatus);

        if ($stage->slug === 'win' || $stage->slug === 'lost') {
            Deal::whereIn('id', $rowIds)->whereNull('close_date')->update(['close_date' => now()->format('Y-m-d')]);
        }

        Deal::whereIn('id', $rowIds)->update(['pipeline_stage_id' => $newStatus]);
    }

    protected function changeAgentStatus($request)
    {
        abort_403(user()->permission('edit_deals') != 'all');
        $agent = LeadAgent::find($request->agent);
        $agentsWithSameUser = LeadAgent::where('user_id', $agent->user_id)->get();
        $rowIds = explode(',', $request->row_ids);

        $leads = Deal::with('leadAgent', 'category')->whereIn('id', $rowIds)->get();

        foreach ($leads as $deal) {
            // Find an agent from the list with matching category
            $matchingAgent = $agentsWithSameUser->firstWhere('lead_category_id', $deal->category_id);

            if ($matchingAgent) {
                // Assign the matching agent to the deal
                $deal->agent_id = $matchingAgent->id;
                $deal->save();
            }
        }
    }

    /**
     *
     * @param int $leadID
     * @return void
     */
    public function followUpCreate($dealID)
    {
        $this->addPermission = user()->permission('add_lead_follow_up');

        abort_403(!in_array($this->addPermission, ['all', 'added']));

        $this->dealID = $dealID;
        $this->deal = Deal::findOrFail($dealID);

        return view('leads.followup.create', $this->data);
    }

    public function leadFollowup()
    {
        $tab = request('tab');
        $this->activeTab = $tab ?: 'overview';
        $this->view = 'leads.ajax.follow-up';
        $dataTable = new LeadFollowupDataTable();

        return $dataTable->render('leads.show', $this->data);
    }

    /**
     * @param FollowUpStoreRequest $request
     * @return array|void
     * @throws RelatedResourceNotFoundException
     */
    public function followUpStore(FollowUpStoreRequest $request)
    {
        $this->deal = Deal::findOrFail($request->deal_id);

        $this->addPermission = user()->permission('add_lead_follow_up');

        abort_403(!in_array($this->addPermission, ['all', 'added']));

        if ($this->deal->next_follow_up != 'yes') {
            return Reply::error(__('messages.leadFollowUpRestricted'));
        }

        // Parse the date and time sent from frontend (DD-MM-YYYY and HH:mm:ss format)
        $next_follow_up_date = Carbon::createFromFormat(
            'd-m-Y H:i:s',
            $request->next_follow_up_date . ' ' . $request->start_time
        );

        // Prepare reminders data - combine defaults with custom reminders
        $defaultReminders = DealFollowUp::DEFAULT_REMINDERS;
        $customReminders = $request->reminders ?? [];
        $allReminders = array_merge($defaultReminders, $customReminders);

        // Create follow-up first, then try meeting generation
        $followUp = new DealFollowUp();
        $followUp->deal_id = $request->deal_id;
        $followUp->meeting_type_id = $request->meeting_type_id;
        $followUp->location = $request->location ?? 'office';
        $followUp->meeting_link = $request->meeting_link;
        $followUp->next_follow_up_date = $next_follow_up_date->format('Y-m-d H:i:s');
        $followUp->remark = $request->remark;
        
        // Set traditional reminder fields for backward compatibility (use first custom reminder or defaults)
        $firstCustomReminder = count($customReminders) > 0 ? $customReminders[0] : $defaultReminders[0];
        $followUp->send_reminder = 'yes'; // Always yes since reminders are mandatory now
        $followUp->remind_time = $firstCustomReminder['time'];
        $followUp->remind_type = $firstCustomReminder['type'];
        
        // Set the new reminders JSON field with custom reminders only
        $followUp->setCustomReminders($customReminders);
        $followUp->status = 'scheduled';

        $followUp->save();

        // Load the deal relationship for automation
        $followUp->load('deal');

        // Try to trigger follow-up automation - if this fails, continue anyway
        try {
            $this->triggerFollowUpAutomation($followUp);
            Log::info("Follow-up automation triggered successfully", [
                'follow_up_id' => $followUp->id,
                'deal_id' => $followUp->deal_id,
            ]);
        } catch (\Exception $e) {
            Log::error("Follow-up automation failed during creation - continuing without meeting link", [
                'follow_up_id' => $followUp->id,
                'deal_id' => $followUp->deal_id,
                'error' => $e->getMessage(),
            ]);
            
            // Send notification to responsible agent
            $this->notifyAgentOfMeetingLinkFailure($followUp, $e->getMessage());
            
            // Continue without throwing exception - follow-up is already saved
        }

        event(new AutoFollowUpReminderEvent($followUp, true));

        return Reply::success(__('messages.recordSaved'));
    }

    public function editFollow($id)
    {
        $this->follow = DealFollowUp::findOrFail($id);
        $this->editPermission = user()->permission('edit_lead_follow_up');
        abort_403(!($this->editPermission == 'all' || ($this->editPermission == 'added' && $this->follow->added_by == user()->id)));

        return view('leads.followup.edit', $this->data);
    }

    public function updateFollow(FollowUpStoreRequest $request)
    {
        $this->deal = Deal::findOrFail($request->deal_id);

        $followUp = DealFollowUp::findOrFail($request->id);
        $this->editPermission = user()->permission('edit_lead_follow_up');

        abort_403(!($this->editPermission == 'all' || ($this->editPermission == 'added' && $followUp->added_by == user()->id)));

        if ($this->deal->next_follow_up != 'yes') {
            return Reply::error(__('messages.leadFollowUpRestricted'));
        }

        // Prepare reminders data - combine defaults with custom reminders
        $defaultReminders = DealFollowUp::DEFAULT_REMINDERS;
        $customReminders = $request->reminders ?? [];

        // Update follow-up first, then try meeting generation
        $followUp->deal_id = $request->deal_id;
        $followUp->meeting_type_id = $request->meeting_type_id;
        $followUp->location = $request->location ?? 'office';
        $followUp->meeting_link = $request->meeting_link;

        // Parse the date and time sent from frontend (DD-MM-YYYY and HH:mm:ss format)
        $followUp->next_follow_up_date = Carbon::createFromFormat('d-m-Y H:i:s', $request->next_follow_up_date . ' ' . $request->start_time)->format('Y-m-d H:i:s');

        $followUp->remark = $request->remark;
        $followUp->status = $request->status ?? 'scheduled';
        
        // Set traditional reminder fields for backward compatibility (use first custom reminder or defaults)
        $firstCustomReminder = count($customReminders) > 0 ? $customReminders[0] : $defaultReminders[0];
        $followUp->remind_time = $firstCustomReminder['time'];
        $followUp->remind_type = $firstCustomReminder['type'];
        
        // Set the new reminders JSON field with custom reminders only
        $followUp->setCustomReminders($customReminders);

        $followUp->save();

        // Load the deal relationship for automation
        $followUp->load('deal');

        // Try to trigger follow-up automation for update - if this fails, continue anyway
        try {
            $this->triggerFollowUpAutomation($followUp);
            Log::info("Follow-up automation triggered successfully during update", [
                'follow_up_id' => $followUp->id,
                'deal_id' => $followUp->deal_id,
            ]);
        } catch (\Exception $e) {
            Log::error("Follow-up automation failed during update - continuing without meeting link", [
                'follow_up_id' => $followUp->id,
                'deal_id' => $followUp->deal_id,
                'error' => $e->getMessage(),
            ]);
            
            // Send notification to responsible agent
            $this->notifyAgentOfMeetingLinkFailure($followUp, $e->getMessage());
            
            // Continue without throwing exception - follow-up is already updated
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    public function deleteFollow($id)
    {
        $followUp = DealFollowUp::findOrFail($id);
        $this->deletePermission = user()->permission('delete_lead_follow_up');
        abort_403(!($this->deletePermission == 'all' || ($this->deletePermission == 'added' && $followUp->added_by == user()->id)));

        DealFollowUp::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }

    /**
     * Apply quick actions to multiple follow-ups
     *
     * @param Request $request
     * @return array
     */
    public function applyFollowUpQuickAction(Request $request)
    {
        switch ($request->action_type) {
            case 'delete':
                $this->deleteFollowUpRecords($request);

                return back()->with([
                    'status' => 'success',
                    'message' => __('messages.deleteSuccess')
                ]);

            case 'change-status':
                $this->changeBulkFollowUpStatus($request);

                return back()->with([
                    'status' => 'success',
                    'message' => __('messages.updateSuccess')
                ]);

            default:
                return back()->with([
                    'status' => 'error',
                    'message' => __('messages.selectAction')
                ]);
        }
    }

    /**
     * Delete multiple follow-up records
     *
     * @param Request $request
     * @return void
     */
    protected function deleteFollowUpRecords($request)
    {
        $this->deletePermission = user()->permission('delete_lead_follow_up');
        
        $followUpIds = explode(',', $request->row_ids);
        
        // Check permissions for each follow-up
        if ($this->deletePermission == 'added') {
            $followUps = DealFollowUp::whereIn('id', $followUpIds)
                ->where('added_by', user()->id)
                ->get();
                
            if ($followUps->count() !== count($followUpIds)) {
                abort_403(__('messages.permissionDenied'));
            }
        } elseif ($this->deletePermission != 'all') {
            abort_403(__('messages.permissionDenied'));
        }

        DealFollowUp::whereIn('id', $followUpIds)->delete();
    }

    /**
     * Change status of multiple follow-ups
     *
     * @param Request $request
     * @return void
     */
    protected function changeBulkFollowUpStatus($request)
    {
        $this->editPermission = user()->permission('edit_lead_follow_up');
        
        $followUpIds = explode(',', $request->row_ids);
        $newStatus = $request->status;

        // Validate status
        $validStatuses = ['pending', 'completed', 'cancelled'];
        if (!in_array($newStatus, $validStatuses)) {
            abort(422, __('Invalid status provided'));
        }
        
        // Check permissions for each follow-up
        if ($this->editPermission == 'added') {
            $followUps = DealFollowUp::whereIn('id', $followUpIds)
                ->where('added_by', user()->id)
                ->get();
                
            if ($followUps->count() !== count($followUpIds)) {
                abort_403(__('messages.permissionDenied'));
            }
        } elseif ($this->editPermission != 'all') {
            abort_403(__('messages.permissionDenied'));
        }

        // Update the status
        DealFollowUp::whereIn('id', $followUpIds)->update([
            'status' => $newStatus,
            'updated_at' => now()
        ]);

        // If status is completed, update completion date
        if ($newStatus === 'completed') {
            DealFollowUp::whereIn('id', $followUpIds)->update([
                'completed_at' => now()
            ]);
        }
    }

    public function proposals()
    {
        $viewPermission = user()->permission('view_lead_proposals');

        abort_403(!in_array($viewPermission, ['all', 'added']));

        $tab = request('tab');
        $this->activeTab = $tab ?: 'overview';
        $this->view = 'leads.ajax.proposal';
        $dataTable = new ProposalDataTable(true);

        return $dataTable->render('leads.show', $this->data);
    }

    public function gdpr()
    {
        $dataTable = new LeadGDPRDataTable();
        $tab = request('tab');
        $this->activeTab = $tab ?: 'gdpr';
        $this->view = 'leads.ajax.gdpr';

        return $dataTable->render('leads.show', $this->data);
    }

    public function consent(Request $request)
    {
        $leadId = $request->leadId;
        $this->consentId = $request->consentId;
        $this->leadId = $leadId;

        $this->consent = PurposeConsent::with(['lead' => function ($query) use ($leadId) {
            $query->where('lead_id', $leadId)->orderByDesc('created_at');
        }])
            ->where('id', $request->consentId)
            ->first();


        return view('leads.gdpr.consent-form', $this->data);
    }

    public function saveLeadConsent(Request $request, $id)
    {
        $deal = Deal::findOrFail($id);
        $consent = PurposeConsent::findOrFail($request->consent_id);

        if ($request->consent_description && $request->consent_description != '') {
            $consent->description = trim_editor($request->consent_description);
            $consent->save();
        }

        // Saving Consent Data
        $newConsentLead = new PurposeConsentLead();
        $newConsentLead->deal_id = $deal->id;
        $newConsentLead->purpose_consent_id = $consent->id;
        $newConsentLead->status = trim($request->status);
        $newConsentLead->ip = $request->ip();
        $newConsentLead->updated_by_id = $this->user->id;
        $newConsentLead->additional_description = $request->additional_description;
        $newConsentLead->save();

        return $request->status == 'agree' ? Reply::success(__('messages.consentOptIn')) : Reply::success(__('messages.consentOptOut'));
    }

    public function importLead()
    {
        $this->pageTitle = __('app.importExcel') . ' ' . __('app.menu.deal');

        $this->addPermission = user()->permission('add_deals');
        abort_403(!in_array($this->addPermission, ['all', 'added']));

        // Get all pipelines for the dropdown
        $this->pipelines = \App\Models\LeadPipeline::where('company_id', company()->id)
            ->orderBy('id')
            ->get();

        $this->view = 'deals.ajax.import';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('leads.create', $this->data);
    }

    public function importStore(ImportRequest $request)
    {
        $this->applyImportResourceLimits();
        $rvalue = $this->importFileProcess($request, DealImport::class);

        if ($rvalue == 'abort') {
            return Reply::error(__('messages.abortAction'));
        }
        $view = view('deals.ajax.import_progress', $this->data)->render();

        return Reply::successWithData(__('messages.importUploadSuccess'), ['view' => $view]);
    }

    public function importProcess(ImportProcessRequest $request)
    {
        $this->applyImportResourceLimits();
        $batch = $this->importJobProcess($request, DealImport::class, ImportDealJob::class);

        return Reply::successWithData(__('messages.importProcessStart'), ['batch' => $batch]);
    }

    /**
     * Download sample import template with custom fields
     */
    public function downloadSampleImport()
    {
        $this->applyImportResourceLimits();
        $this->addPermission = user()->permission('add_deals');
        abort_403(!in_array($this->addPermission, ['all', 'added']));

        $export = new \App\Exports\DealSampleExport(company()->id);
        $filename = 'deal-sample-import-' . now()->format('Y-m-d') . '.xlsx';
        
        return \Maatwebsite\Excel\Facades\Excel::download($export, $filename);
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

        if (session()->has('is_deal')) {
            session()->forget('is_deal');
        }
    }

    public function notes()
    {
        $dataTable = new DealNotesDataTable();
        $viewPermission = user()->permission('view_deal_note');

        abort_403(!($viewPermission == 'all' || $viewPermission == 'added' || $viewPermission == 'both' || $viewPermission == 'owned'));

        $tab = request('tab');
        $this->activeTab = $tab ?: 'profile';

        $this->view = 'leads.ajax.notes';

        return $dataTable->render('leads.show', $this->data);
    }

    public function changeFollowUpStatus(Request $request)
    {
        $id = $request->id;
        $status = $request->status;
        $leadFollowUp = DealFollowUp::find($id);

        if (!is_null($leadFollowUp)) {
            $leadFollowUp->status = $status;
            $leadFollowUp->save();
        }


        $this->triggerDealUpdateAutomation($request, $leadFollowUp->deal);
        return Reply::success(__('messages.leadStatusChangeSuccess'));
    }

    // Get Satges
    public function getStages($id)
    {
        $stages = PipelineStage::where('lead_pipeline_id', $id)->orderBy('priority')->get();

        return Reply::dataOnly(['status' => 'success', 'data' => $stages]);
    }

    // Get Deals
    public function getDeals($id)
    {
        $deals = Deal::allLeads($id);

        return Reply::dataOnly(['status' => 'success', 'data' => $deals]);
    }

    /**
     * @param CommonRequest $request
     * @return array
     */
    public function changeStage(CommonRequest $request)
    {
        $deal = Deal::findOrFail($request->leadID);
        $currentStageSlug = PipelineStage::findOrFail($request->statusID);

        // if the current stage is 'win' or 'lost', do not update
        if (in_array($currentStageSlug->slug, ['win', 'lost'])) {
            return Reply::dataOnly(['status' => 'success']);
        }

        $this->editPermission = user()->permission('edit_deals');
        $this->changeLeadStatusPermission = user()->permission('change_deal_stages');

        abort_403(!(($this->editPermission == 'all' || ($this->editPermission == 'added' && $deal->added_by == user()->id)) || $this->changeLeadStatusPermission == 'all'));

        $deal->pipeline_stage_id = $request->statusID;
        $deal->save();

        $this->triggerDealUpdateAutomation($request, $deal);

        return Reply::successWithData(__('messages.updateSuccess'), ['status' => 'success']);
    }

    public function getAgents($id)
    {
        $currentUser = user()->id;
        $leadCategory = LeadCategory::with(['enabledAgents' => function ($query) use ($currentUser) {

            if ($this->viewLeadAgentPermission == 'added') {
                $query->where('added_by', $currentUser);
            } elseif ($this->viewLeadAgentPermission == 'owned') {
                $query->where('user_id', $currentUser);
            } elseif ($this->viewLeadAgentPermission == 'both') {
                $query->where(function ($query) use ($currentUser) {
                    $query->where('added_by', $currentUser)
                        ->orWhere('user_id', $currentUser);
                });
            }
        }])->where('id', $id)->first();

        $deal = Deal::where('id', request()->dealId)->first();
        $groupData = [];
        $userData = [];

        if (isset($leadCategory) && count($leadCategory->enabledAgents) > 0) {

            $activeAgents = $leadCategory->enabledAgents->filter(function ($agent) {
                return $agent->user->status !== 'deactive';
            });

            $selectedAgent = null;
            $data = [];

            if (!is_null($deal)) {
                $selectedAgent = $leadCategory->enabledAgents->firstWhere('id', $deal->agent_id);

                if ($selectedAgent && $selectedAgent->user->status === 'deactive') {
                    $activeAgents->push($selectedAgent);
                }
            }

            foreach ($activeAgents as $agent) {
                $selected = !is_null($deal) && $agent->id == $deal->agent_id;

                $data[] = view('components.user-option', [
                    'user' => $agent->user,
                    'agent' => false,
                    'pill' => false,
                    'selected' => $selected,
                ])->render();
            }

            $groupData = $userData;
        } else {
            $data = '<option value="">--</option>';
        }

        return Reply::dataOnly(['data' => $data, 'groupData' => $groupData]);
    }

    public function stageChange(Request $request)
    {
        $deal = Deal::findOrFail($request->leadID);
        $pipelineStageId = $request->statusID;

        $pipelineStage = PipelineStage::findOrFail($request->statusID);

        $pipelineStageName = $pipelineStage->name;

        return view('leads.stage-change', ['deal' => $deal, 'pipelineStageId' => $pipelineStageId, 'pipelineStageName' => $pipelineStageName]);
    }

    public function saveStageChange(StageChangeRequest $request)
    {
        $deal = Deal::findOrFail($request->dealId);

        $deal->pipeline_stage_id = $request->pipelineStageId;
        $deal->close_date = $request->close_date ? $this->safeCompanyToYmd($request->close_date) : null;
        $deal->update();

        if (!empty($request->description)) {
            $dealNote = new DealNote();
            $dealNote->title = $request->title;
            $dealNote->deal_id = $request->dealId;
            $dealNote->details = $request->description;
            $dealNote->save();
        };

        $this->triggerDealUpdateAutomation($request, $deal);

        return Reply::success(__('messages.updateSuccess'));
    }
    /**
     * Get custom field categories for the lead module.
     *
     * @return \Illuminate\Support\Collection
     */
    private function getDealCustomFieldCategories()
    {
        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        if ($dealCustomFieldGroup) {
            return CustomFieldCategory::where('custom_field_group_id', $dealCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->get();
        }
        return collect();
    }


    /**
     * Safely convert company date format to Y-m-d format
     * Returns null if date is invalid or empty
     */
    private function safeCompanyToYmd($date)
    {
        try {
            if (empty($date)) {
                return null;
            }
            
            // Try multiple date formats to handle different input formats
            $possibleFormats = [
                company()->date_format, // Company's configured format
                'd-m-Y',               // Default format that might be sent from frontend
                'Y-m-d',               // ISO format
                'm-d-Y',               // US format
                'd/m/Y',               // Alternative format
                'm/d/Y',               // Alternative US format
            ];
            
            foreach ($possibleFormats as $format) {
                try {
                    $parsedDate = \Carbon\Carbon::createFromFormat($format, $date);
                    if ($parsedDate && $parsedDate->format($format) === $date) {
                        return $parsedDate->format('Y-m-d');
                    }
                } catch (\Exception $e) {
                    // Continue to next format
                    continue;
                }
            }
            
            // If none of the above formats work, log the error
            Log::error('Date conversion error: Unable to parse date in any expected format - Date: ' . $date . ' - Company format: ' . company()->date_format);
            return null;
            
        } catch (\Exception $e) {
            Log::error('Date conversion error: ' . $e->getMessage() . ' - Date: ' . $date);
            return null;
        }
    }

    /** 
     * Generate Meeting Link
     */
    public function generateMeetingLink(Request $request)
    {
        Log::info('Generate Meeting Link invoked', [
            'followup_id' => $request->followup_id,
            'user_id' => auth()->id(),
            'timestamp' => now(),
        ]);

        $this->editPermission = user()->permission('edit_lead_follow_up');
        abort_403(!($this->editPermission == 'all' || ($this->editPermission == 'added' && $request->added_by == user()->id)));

        $followUpId = $request->followup_id;
        $followUp = DealFollowUp::find($followUpId);

        Log::info('Follow-up found', [
            'followup_id' => $followUpId,
            'followup_exists' => $followUp ? true : false,
            'followup_location' => $followUp ? $followUp->location : null
        ]);

        if (!$followUp) {
            Log::error('Follow-up not found', ['followupId' => $followUpId]);
            return Reply::error('Follow-up not found');
        }

        try {
            Log::info('Calling triggerFollowUpAutomation', [
                'followup_id' => $followUp->id,
                'deal_id' => $followUp->deal_id,
                'location' => $followUp->location
            ]);

            $meetingResponse = $this->triggerFollowUpAutomation($followUp);
            
            Log::info('triggerFollowUpAutomation response', [
                'response' => $meetingResponse
            ]);

            $meetingLink = $meetingResponse['meeting_link'] ?? null;
            return Reply::successWithData('Meeting link generated successfully', ['meeting_link' => $meetingLink]);
        } catch (\Exception $e) {
            Log::error('Error in generateMeetingLink', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Send notification to responsible agent
            $this->notifyAgentOfMeetingLinkFailure($followUp, $e->getMessage());
            
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Notify agent when meeting link generation fails
     */
    private function notifyAgentOfMeetingLinkFailure(DealFollowUp $followUp, string $errorMessage)
    {
        try {
            // Get the responsible agent
            $agent = null;
            
            if ($followUp->deal && $followUp->deal->agent_id) {
                $leadAgent = \App\Models\LeadAgent::find($followUp->deal->agent_id);
                if ($leadAgent) {
                    $agent = \App\Models\User::find($leadAgent->user_id);
                }
            }
            
            // If no agent found, try to get the deal watcher
            if (!$agent && $followUp->deal && $followUp->deal->deal_watcher) {
                $agent = \App\Models\User::find($followUp->deal->deal_watcher);
            }
            
            // If still no agent, get the user who created the follow-up
            if (!$agent) {
                $agent = \App\Models\User::find($followUp->added_by);
            }
            
            if ($agent) {
                $agent->notify(new MeetingLinkGenerationFailed($followUp, $agent, $errorMessage));
                
                Log::info("Meeting link generation failure notification sent to agent", [
                    'follow_up_id' => $followUp->id,
                    'deal_id' => $followUp->deal_id,
                    'agent_id' => $agent->id,
                    'agent_email' => $agent->email,
                ]);
            } else {
                Log::warning("No agent found to notify about meeting link generation failure", [
                    'follow_up_id' => $followUp->id,
                    'deal_id' => $followUp->deal_id,
                ]);
            }
        } catch (\Exception $e) {
            Log::error("Failed to send meeting link generation failure notification", [
                'follow_up_id' => $followUp->id,
                'deal_id' => $followUp->deal_id,
                'error' => $e->getMessage(),
            ]);

        }
    }


}
