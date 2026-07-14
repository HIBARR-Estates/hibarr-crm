<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use App\Helper\Reply;
use App\Models\LeadAgent;
use App\Models\LeadSource;
use App\Models\LeadCategory;
use App\Models\LeadPipeline;
use Illuminate\Http\Request;
use App\Models\PipelineStage;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use App\Models\UserLeadboardSetting;
use App\Helper\Common;
use App\Traits\DealAutomationTrait;
use App\Traits\DealFormDataTrait;
use Inertia\Inertia;
use App\Services\PermissionService;

class LeadBoardController extends AccountBaseController
{
    use DealAutomationTrait;
    use DealFormDataTrait;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.deal';
        $this->middleware(function ($request, $next) {

            $hasLeadsModule = in_array('leads', user_modules());
            if(!$hasLeadsModule){
                if($request->ajax() || $request->header('X-Inertia')) {
                    return redirect()->back()->with('error', __('messages.permissionDenied'));
                } else {
                    abort_403(!$hasLeadsModule);
                }
            }
            
            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        $this->viewLeadPermission = $viewPermission = user()->permission('view_deals');
        $this->viewLeadAgentPermission = user()->permission('view_lead_agents');
        $this->viewEmployeePermission = user()->permission('view_employees');
        $this->viewDealLeadPermission = user()->permission('view_lead');
        $this->products = Product::all();
        
        // if (!in_array($viewPermission, ['all', 'added', 'both', 'owned'])) {
        //     if (request()->header('X-Inertia')) {
        //         return redirect()->back()->with('error', __('messages.permissionDenied'));
        //     }
        //     abort_403();
        // }

        $this->categories = LeadCategory::get();
        $this->sources = LeadSource::get();
        $this->pipelines = LeadPipeline::has('stages')->get();

        $this->dealWatcher = User::allEmployees(null, 'active');

        $this->dealLeads = Lead::select('id', 'client_name')->get();

        $this->defaultPipeline = $this->pipelines->filter(function ($value, $key) {
            return $value->default == 1;
        })->first();

        $this->stages = PipelineStage::all();
        $this->startDate = now()->subDays(15)->format($this->company->date_format);
        $this->endDate = now()->addDays(15)->format($this->company->date_format);
        $this->leadAgents = LeadAgent::with('user')->whereHas('user', function ($q) {
            $q->where('status', 'active');
        })->groupBy('user_id');

        $this->nonActiveLeadAgents = LeadAgent::with('user')->whereHas('user', function ($q) {
            $q->where('status', '!=', 'active');
        })->groupBy('user_id')->get();

        if ($this->viewLeadAgentPermission != 'all') {
            $this->leadAgents = $this->leadAgents->where('user_id', user()->id);
        }

        $this->leadAgents = $this->leadAgents->get();
        $this->myAgentId = LeadAgent::where('user_id', user()->id)->pluck('id')->toArray();

        $this->viewStageFilter = false;

        // if (request()->ajax()) {
            $this->pipelineId = ($request->lead_pipeline_id) ? $request->lead_pipeline_id : $this->defaultPipeline->id;

            $startDate = ($request->start_date && $request->start_date != 'null' && $request->start_date != '') ? companyToDateString($request->start_date) : null;
            $endDate = ($request->end_date && $request->end_date != 'null' && $request->end_date != '') ? companyToDateString($request->end_date) : null;

            $this->boardEdit = (request()->has('boardEdit') && request('boardEdit') == 'false') ? false : true;
            $this->boardDelete = (request()->has('boardDelete') && request('boardDelete') == 'false') ? false : true;

            $boardColumns = PipelineStage::withCount(['deals as deals_count' => function ($q) use ($startDate, $endDate, $request) {

                $this->dateFilter($q, $startDate, $endDate, $request);
                $q->leftJoin('leads as lead1', 'lead1.id', 'deals.lead_id');

                if ($request->product != 'all' && $request->product != '') {
                    $q->leftJoin('lead_products', 'lead_products.deal_id', '=', 'deals.id')
                        ->where('lead_products.product_id', $request->product);
                }

                if ($this->pipelineId != 'all' && $this->pipelineId != '') {
                    $q->where('deals.lead_pipeline_id', $this->pipelineId);
                }

                if ($request->deal_watcher_id !== null && $request->deal_watcher_id != 'all' && $request->deal_watcher_id != '') {
                    $q = $q->whereExists(function ($query) use ($request) {
                        $query->select(DB::raw(1))
                              ->from('deal_watchers')
                              ->whereColumn('deal_watchers.deal_id', 'deals.id')
                              ->where('deal_watchers.user_id', $request->deal_watcher_id);
                    });
                }

                if ($request->lead_agent_id !== null && $request->lead_agent_id != 'null' && $request->lead_agent_id != '' && $request->lead_agent_id != 'all') {
                    $q = $q->where('deals.lead_id', $request->lead_agent_id);
                }

                if ($request->category_id !== null && $request->category_id != 'null' && $request->category_id != '' && $request->category_id != 'all') {
                    $q = $q->where('deals.category_id', $request->category_id);
                }

                if ($request->search != '') {
                    $q->leftJoin('leads', 'leads.id', 'deals.lead_id');
                    $q->where(function ($query) {
                        $safeTerm = Common::safeString(request('search'));
                        $query->where('leads.client_name', 'like', '%' . $safeTerm . '%')
                            ->orWhere('leads.client_name', 'like', '%' . $safeTerm . '%')
                            ->orWhere('leads.client_email', 'like', '%' . $safeTerm . '%')
                            ->orWhere('leads.company_name', 'like', '%' . $safeTerm . '%')
                            ->orWhere('leads.mobile', 'like', '%' . $safeTerm . '%');
                    });
                }

                // Apply permission-based filtering
                $dealRules = [
                    'added' => 'deals.added_by',
                    'owned' => function($q, $user) {
                        $q->where(function($query) use ($user) {
                            $myAgentId = \App\Models\LeadAgent::where('user_id', $user->id)->pluck('id')->toArray();
                            
                            if (!empty($myAgentId)) {
                                $query->whereIn('agent_id', $myAgentId);
                            }
                            
                            $query->orWhereExists(function ($subQuery) use ($user) {
                                $subQuery->select(DB::raw(1))
                                        ->from('deal_watchers')
                                        ->whereColumn('deal_watchers.deal_id', 'deals.id')
                                        ->where('deal_watchers.user_id', $user->id);
                            });
                        });
                    }
                ];

                if ($request->agent_id != 'all' && $request->agent_id != 'undefined' && $request->agent_id != '') {
                    $q->whereHas('leadAgent', function ($q) use ($request) {
                        $q->where('user_id', $request->agent_id);
                    });
                }

                PermissionService::applyScope($q, user(), 'view_deals', $dealRules);

                $q->select(DB::raw('count(distinct deals.id)'));
            }])
                ->with(['deals' => function ($q) use ($startDate, $endDate, $request) {
                    $q->with(['contact','leadAgent', 'leadAgent.user', 'currency', 'dealWatchers'])
                        ->leftJoin('leads', 'leads.id', 'deals.lead_id')
                        ->groupBy('deals.id');

                    if ($request->agent_id != 'all' && $request->agent_id != '' && $request->agent_id != 'undefined') {
                        $q->whereHas('leadAgent', function ($q) use ($request) {
                            $q->where('user_id', $request->agent_id);
                        });
                    }

                    // Apply permission-based filtering
                    $dealRules = [
                        'added' => 'deals.added_by',
                        'owned' => function($q, $user) {
                            $q->where(function($query) use ($user) {
                                $myAgentId = \App\Models\LeadAgent::where('user_id', $user->id)->pluck('id')->toArray();
                                
                                if (!empty($myAgentId)) {
                                    $query->whereIn('agent_id', $myAgentId);
                                }
                                
                                $query->orWhereExists(function ($subQuery) use ($user) {
                                    $subQuery->select(DB::raw(1))
                                            ->from('deal_watchers')
                                            ->whereColumn('deal_watchers.deal_id', 'deals.id')
                                            ->where('deal_watchers.user_id', $user->id);
                                });
                            });
                        }
                    ];
                    PermissionService::applyScope($q, user(), 'view_deals', $dealRules);

                    $this->dateFilter($q, $startDate, $endDate, $request);

                    if ($request->filled('min_value_range') && $request->min_value_range != 'undefined') {
                        $q->where('deals.value', '>=', $request->min_value_range);
                    }
                    if ($request->filled('max_value_range') && $request->max_value_range != 'undefined') {
                        $q->where('deals.value', '<=', $request->max_value_range);
                    }

                    if ($request->product != 'all' && $request->product != '') {
                        $q->leftJoin('lead_products', 'lead_products.deal_id', '=', 'deals.id')
                            ->where('lead_products.product_id', $request->product);
                    }

                    if ($this->pipelineId != 'all' && $this->pipelineId != '' && $this->pipelineId != null) {
                        $q->where('deals.lead_pipeline_id', $this->pipelineId);
                    }

                    if ($request->deal_watcher_id !== null && $request->deal_watcher_id != 'all' && $request->deal_watcher_id != '') {
                        $q = $q->whereExists(function ($query) use ($request) {
                            $query->select(DB::raw(1))
                                  ->from('deal_watchers')
                                  ->whereColumn('deal_watchers.deal_id', 'deals.id')
                                  ->where('deal_watchers.user_id', $request->deal_watcher_id);
                        });
                    }

                    if ($request->lead_agent_id !== null && $request->lead_agent_id != 'null' && $request->lead_agent_id != '' && $request->lead_agent_id != 'all') {
                        $q = $q->where('deals.lead_id', $request->lead_agent_id);
                    }

                    if ($request->category_id !== null && $request->category_id != 'null' && $request->category_id != '' && $request->category_id != 'all') {
                        $q = $q->where('deals.category_id', $request->category_id);
                    }

                    if ($request->search != '') {
                        $q->where(function ($query) {
                            $safeTerm = Common::safeString(request('search'));
                            $query->where('leads.client_name', 'like', '%' . $safeTerm . '%')
                                ->orWhere('leads.client_name', 'like', '%' . $safeTerm . '%')
                                ->orWhere('leads.client_email', 'like', '%' . $safeTerm . '%')
                                ->orWhere('leads.company_name', 'like', '%' . $safeTerm . '%')
                                ->orWhere('leads.mobile', 'like', '%' . $safeTerm . '%');
                        });
                    }
                }])->where(function ($query) use ($request) {
                    if ($request->status_id != 'all' && $request->status_id != '' && $request->status_id != 'undefined') {
                        $query->where('id', $request->status_id);
                    }
                });

            if ($this->pipelineId != 'all' && $this->pipelineId != '') {
                $boardColumns->where('lead_pipeline_id', $this->pipelineId);
            }

            $boardColumns = $boardColumns->with('userSetting')->orderBy('priority', 'asc')->get();

            $result = array();

            foreach ($boardColumns as $key => $boardColumn) {
                $result['boardColumns'][] = $boardColumn;

                $leads = Deal::select('deals.*', DB::raw("(select next_follow_up_date from lead_follow_up where deal_id = deals.id and deals.next_follow_up  = 'yes' ORDER BY next_follow_up_date desc limit 1) as next_follow_up_date"))
                    ->leftJoin('leads', 'leads.id', 'deals.lead_id')
                    ->with('leadAgent', 'leadAgent.user')
                    ->where('deals.pipeline_stage_id', $boardColumn->id)
                    ->orderBy('deals.column_priority', 'asc')
                    ->groupBy('deals.id');


                $this->dateFilter($leads, $startDate, $endDate, $request);


                if ($request->filled('min_value_range') && $request->min_value_range != 'undefined') {
                    $leads->where('deals.value', '>=', $request->min_value_range);
                }
                if ($request->filled('max_value_range') && $request->max_value_range != 'undefined') {
                    $leads->where('deals.value', '<=', $request->max_value_range);
                }

                if ($request->followUp != 'all' && $request->followUp != '' && $request->followUp != 'undefined') {
                    $leads = $leads->leftJoin('lead_follow_up', 'lead_follow_up.deal_id', 'deals.id');

                    if ($request->followUp == 'yes') {
                        $leads->where('deals.next_follow_up', 'yes');
                    } else {
                        $leads->where('deals.next_follow_up', 'no');
                    }
                }

                if ($this->pipelineId != 'all' && $this->pipelineId != '' && $this->pipelineId != null) {
                    $leads->where('deals.lead_pipeline_id', $this->pipelineId);
                }

                if ($request->product != 'all' && $request->product != '') {
                    $leads->leftJoin('lead_products', 'lead_products.deal_id', '=', 'deals.id')
                        ->where('lead_products.product_id', $request->product);
                }


                            if ($request->deal_watcher_id !== null && $request->deal_watcher_id != 'all' && $request->deal_watcher_id != '') {
                $leads->whereExists(function ($query) use ($request) {
                    $query->select(DB::raw(1))
                          ->from('deal_watchers')
                          ->whereColumn('deal_watchers.deal_id', 'deals.id')
                          ->where('deal_watchers.user_id', $request->deal_watcher_id);
                });
            }

                if ($request->lead_agent_id !== null && $request->lead_agent_id != 'null' && $request->lead_agent_id != '' && $request->lead_agent_id != 'all') {
                    $leads->where('deals.lead_id', $request->lead_agent_id);
                }

                if ($request->category_id !== null && $request->category_id != 'null' && $request->category_id != '' && $request->category_id != 'all') {
                    $leads = $leads->where('deals.category_id', $request->category_id);
                }

                if ($request->searchText != '') {

                    $leads->where(function ($query) {
                        $safeTerm = Common::safeString(request('searchText'));
                        $query->where('leads.client_name', 'like', '%' . $safeTerm . '%')
                            ->orWhere('leads.client_name', 'like', '%' . $safeTerm . '%')
                            ->orWhere('leads.client_email', 'like', '%' . $safeTerm . '%')
                            ->orWhere('leads.company_name', 'like', '%' . $safeTerm . '%')
                            ->orWhere('leads.mobile', 'like', '%' . $safeTerm . '%');
                    });
                }

                if (($request->agent != 'all' && $request->agent != '' && $request->agent != 'undefined') || $this->viewLeadPermission == 'added') {
                    $leads->where(function ($query) use ($request) {
                        if ($request->agent != 'all' && $request->agent != '') {

                            $query->whereHas('leadAgent', function ($q) use ($request) {
                                $q->where('user_id', $request->agent);
                            });
                        }

                        if ($this->viewLeadPermission == 'added') {
                            $query->where('deals.added_by', user()->id);
                        }
                    });
                }

                if ($this->viewLeadPermission == 'owned') {
                    $leads->where(function ($query) {
                        if (!empty($this->myAgentId)) {
                            $query->whereIn('agent_id', $this->myAgentId);
                        }

                        $query->orWhereExists(function ($subQuery) {
                            $subQuery->select(DB::raw(1))
                                    ->from('deal_watchers')
                                    ->whereColumn('deal_watchers.deal_id', 'deals.id')
                                    ->where('deal_watchers.user_id', user()->id);
                        });
                    });
                }

                if ($this->viewLeadPermission == 'both') {
                    $leads->where(function ($query) {
                        if (!empty($this->myAgentId)) {
                            $query->whereIn('agent_id', $this->myAgentId);
                        }

                        $query->orWhere('deals.added_by', user()->id)
                            ->orWhereExists(function ($subQuery) {
                                $subQuery->select(DB::raw(1))
                                        ->from('deal_watchers')
                                        ->whereColumn('deal_watchers.deal_id', 'deals.id')
                                        ->where('deal_watchers.user_id', user()->id);
                            });
                    });
                }

                $leads->skip(0)->take($this->taskBoardColumnLength);
                $leads = $leads->get();
                $dealIds = $leads->pluck('id')->toArray();

                $result['boardColumns'][$key]['total_value'] = 0;

                if (!empty($dealIds)) {
                    $statusTotalValue = Deal::whereIn('id', $dealIds)->sum('value');
                    $result['boardColumns'][$key]['total_value'] = $statusTotalValue;
                }

                $result['boardColumns'][$key]['deals'] = $leads;
            }

            $this->result = $result;
            $this->startDate = $startDate;
            $this->endDate = $endDate;

            // $view = view('leads.board.board_data', $this->data)->render();

            // return Reply::dataOnly(['view' => $view]);
        // }

        $this->leads = Deal::get();

        // Determine current pipeline name for display
        $currentPipelineName = $this->defaultPipeline->name;
        if (request()->has('lead_pipeline_id') && request('lead_pipeline_id') != 'all') {
            $selectedPipeline = $this->pipelines->find(request('lead_pipeline_id'));
            if ($selectedPipeline) {
                $currentPipelineName = $selectedPipeline->name;
            }
        }

        // For non-AJAX requests, we need to load the board data initially
        // if (!request()->ajax()) {
            $pipelineId = request('lead_pipeline_id', $this->defaultPipeline->id);
            $startDate = (request('start_date') && request('start_date') != 'null' && request('start_date') != '') ? companyToDateString(request('start_date')) : null;
            $endDate = (request('end_date') && request('end_date') != 'null' && request('end_date') != '') ? companyToDateString(request('end_date')) : null;
            
            // Load board data using the same logic as AJAX requests
            $result = $this->getBoardData($request, $pipelineId, $startDate, $endDate);
            $this->result = $result;
        // }

        // Check if this should be an Inertia response
        // if (request()->header('X-Inertia')) {
        // if (true) {
            $formData = $this->getDealFormData();

            return Inertia::render('LeadBoards/Index', array_merge([
                'pageTitle' => $this->pageTitle,
                'result' => $this->result ?? ['boardColumns' => []],
                'categories' => $this->categories,
                'sources' => $this->sources,
                'stages' => $this->stages,
                'leadAgents' => $this->leadAgents,
                'dealWatcher' => $this->dealWatcher,
                'dealLeads' => $this->dealLeads,
                'products' => $this->products,
                'currentPipelineName' => $currentPipelineName,
                'addLeadPermission' => user()->permission('add_deals'),
                'viewLeadPermission' => $this->viewLeadPermission,
                'allPipelines' => $this->pipelines,
                'defaultPipeline' => $this->defaultPipeline,
                'startDate' => $this->startDate,
                'endDate' => $this->endDate,
                'filters' => request()->only(['search', 'lead_pipeline_id', 'category_id', 'product', 'agent_id', 'start_date', 'end_date', 'min_value_range', 'max_value_range']),
            ], $formData));
        // }

        // For blade template (backward compatibility)
        // $this->data['currentPipelineName'] = $currentPipelineName;
        // return view('leads.board.index', $this->data);
    }

    /**
     * Extract board data loading logic into a separate method
     */
    protected function getBoardData(Request $request, $pipelineId, $startDate, $endDate)
    {
        $boardColumns = PipelineStage::withCount(['deals as deals_count' => function ($q) use ($startDate, $endDate, $request, $pipelineId) {
            $this->dateFilter($q, $startDate, $endDate, $request);
            $q->leftJoin('leads as lead1', 'lead1.id', 'deals.lead_id');

            if ($request->product != 'all' && $request->product != '') {
                $q->leftJoin('lead_products', 'lead_products.deal_id', '=', 'deals.id')
                    ->where('lead_products.product_id', $request->product);
            }

            if ($pipelineId != 'all' && $pipelineId != '' && $pipelineId != null) {
                $q->where('deals.lead_pipeline_id', $pipelineId);
            }

            if ($request->deal_watcher_id !== null && $request->deal_watcher_id != 'all' && $request->deal_watcher_id != '') {
                $q = $q->whereExists(function ($query) use ($request) {
                    $query->select(DB::raw(1))
                          ->from('deal_watchers')
                          ->whereColumn('deal_watchers.deal_id', 'deals.id')
                          ->where('deal_watchers.user_id', $request->deal_watcher_id);
                });
            }

            if ($request->lead_agent_id !== null && $request->lead_agent_id != 'null' && $request->lead_agent_id != '' && $request->lead_agent_id != 'all') {
                $q = $q->where('deals.lead_id', $request->lead_agent_id);
            }

            if ($request->category_id !== null && $request->category_id != 'null' && $request->category_id != '' && $request->category_id != 'all') {
                $q = $q->where('deals.category_id', $request->category_id);
            }

            if ($request->filled('search')) {
                $q->leftJoin('leads', 'leads.id', 'deals.lead_id');
                $searchTerm = $request->search;
                $q->where(function($query) use ($searchTerm) {
                    $query->where('deals.name', 'like', '%' . $searchTerm . '%')
                          ->orWhereHas('contact', function($q) use ($searchTerm) {
                              $q->where('client_name', 'like', '%' . $searchTerm . '%')
                                ->orWhere('client_email', 'like', '%' . $searchTerm . '%')
                                ->orWhere('company_name', 'like', '%' . $searchTerm . '%');
                          });
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

            if ($request->agent_status == 'unassigned') {
                $q->whereNull('deals.agent_id');
            } elseif ($request->agent_id != 'all' && $request->agent_id != 'undefined' && $request->agent_id != '') {
                $q->whereHas('leadAgent', function ($q) use ($request) {
                    $q->where('user_id', $request->agent_id);
                });
            } elseif ($request->agent_status == 'active') {
                $q->whereHas('leadAgent.user', function ($q) {
                    $q->where('status', 'active');
                });
            } elseif ($request->agent_status == 'inactive') {
                $q->whereHas('leadAgent.user', function ($q) {
                    $q->where('status', '!=', 'active');
                });
            }

            PermissionService::applyScope($q, user(), 'view_deals', $dealRules);

            $q->select(DB::raw('count(distinct deals.id)'));
        }])
        ->where(function ($query) use ($request, $pipelineId) {
            if ($pipelineId != 'all' && $pipelineId != '' && $pipelineId != null) {
                $query->where('lead_pipeline_id', $pipelineId);
            }
        });

        if ($pipelineId != 'all' && $pipelineId != '') {
            $boardColumns->where('lead_pipeline_id', $pipelineId);
        }

        if ($request->filled('pipeline_stage_id') && $request->pipeline_stage_id != 'all') {
            $boardColumns->where('id', $request->pipeline_stage_id);
        }

        $boardColumns = $boardColumns->with('userSetting')->orderBy('priority', 'asc')->get();

        $result = array();

        foreach ($boardColumns as $key => $boardColumn) {
            $result['boardColumns'][] = $boardColumn;

            $leads = Deal::select('deals.*', DB::raw("(select next_follow_up_date from lead_follow_up where deal_id = deals.id and deals.next_follow_up  = 'yes' ORDER BY next_follow_up_date desc limit 1) as next_follow_up_date"))
                ->with(['contact', 'leadStage', 'leadAgent', 'leadAgent.user', 'currency'])
                ->leftJoin('leads', 'leads.id', 'deals.lead_id')
                ->where('deals.pipeline_stage_id', $boardColumn->id)
                ->orderBy('deals.created_at', 'desc')
                ->groupBy('deals.id');

            $this->dateFilter($leads, $startDate, $endDate, $request);

            if ($request->filled('search')) {
                $searchTerm = $request->search;
                $leads->where(function($query) use ($searchTerm) {
                    $query->where('deals.name', 'like', '%' . $searchTerm . '%')
                          ->orWhereHas('contact', function($q) use ($searchTerm) {
                              $q->where('client_name', 'like', '%' . $searchTerm . '%')
                                ->orWhere('client_email', 'like', '%' . $searchTerm . '%')
                                ->orWhere('company_name', 'like', '%' . $searchTerm . '%');
                          });
                });
            }

            if ($pipelineId != 'all' && $pipelineId != '' && $pipelineId != null) {
                $leads->where('deals.lead_pipeline_id', $pipelineId);
            }

            if ($request->category_id !== null && $request->category_id != 'null' && $request->category_id != '' && $request->category_id != 'all') {
                $leads->where('deals.category_id', $request->category_id);
            }

            if ($request->agent_status == 'unassigned') {
                $leads->whereNull('deals.agent_id');
            } elseif ($request->filled('agent_id') && $request->agent_id != 'all') {
                $leads->whereHas('leadAgent', function ($q) use ($request) {
                    $q->where('user_id', $request->agent_id);
                });
            } elseif ($request->agent_status == 'active') {
                $leads->whereHas('leadAgent.user', function ($q) {
                    $q->where('status', 'active');
                });
            } elseif ($request->agent_status == 'inactive') {
                $leads->whereHas('leadAgent.user', function ($q) {
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
            PermissionService::applyScope($leads, user(), 'view_deals', $dealRules);

            // Calculate total value for the stage (all pages)
            $statusTotalValue = Deal::withoutGlobalScopes()->fromSub($leads, 'sub_deals')->sum('value');
            $result['boardColumns'][$key]['total_value'] = $statusTotalValue;

            // Return empty deals to force client-side fetch (Infinite Scroll)
            $result['boardColumns'][$key]['deals'] = [];
        }

        return $result;
    }

    public function getBoardDeals(Request $request)
    {
        $startDate = ($request->start_date && $request->start_date != 'null' && $request->start_date != '') ? companyToDateString($request->start_date) : null;
        $endDate = ($request->end_date && $request->end_date != 'null' && $request->end_date != '') ? companyToDateString($request->end_date) : null;
        $pipelineStageId = $request->pipeline_stage_id;
        $pipelineId = $request->lead_pipeline_id;

        $leads = Deal::select('deals.*', DB::raw("(select next_follow_up_date from lead_follow_up where deal_id = deals.id and deals.next_follow_up  = 'yes' ORDER BY next_follow_up_date desc limit 1) as next_follow_up_date"))
            ->with(['contact', 'leadStage', 'leadAgent', 'leadAgent.user', 'currency'])
            ->leftJoin('leads', 'leads.id', 'deals.lead_id')
            ->where('deals.pipeline_stage_id', $pipelineStageId)
            ->orderBy('deals.created_at', 'desc')
            ->groupBy('deals.id');



        $this->dateFilter($leads, $startDate, $endDate, $request);

        if ($request->filled('search')) {
            $searchTerm = $request->search;
            $leads->where(function($query) use ($searchTerm) {
                $query->where('deals.name', 'like', '%' . $searchTerm . '%')
                      ->orWhereHas('contact', function($q) use ($searchTerm) {
                          $q->where('client_name', 'like', '%' . $searchTerm . '%')
                            ->orWhere('client_email', 'like', '%' . $searchTerm . '%')
                            ->orWhere('company_name', 'like', '%' . $searchTerm . '%');
                      });
            });
        }

        if ($pipelineId != 'all' && $pipelineId != '' && $pipelineId != null) {
            $leads->where('deals.lead_pipeline_id', $pipelineId);
        }

        if ($request->category_id !== null && $request->category_id != 'null' && $request->category_id != '' && $request->category_id != 'all') {
            $leads->where('deals.category_id', $request->category_id);
        }

        if ($request->agent_status == 'unassigned') {
            $leads->whereNull('deals.agent_id');
        } elseif ($request->filled('agent_id') && $request->agent_id != 'all') {
            $leads->whereHas('leadAgent', function ($q) use ($request) {
                $q->where('user_id', $request->agent_id);
            });
        } elseif ($request->agent_status == 'active') {
            $leads->whereHas('leadAgent.user', function ($q) {
                $q->where('status', 'active');
            });
        } elseif ($request->agent_status == 'inactive') {
            $leads->whereHas('leadAgent.user', function ($q) {
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
        PermissionService::applyScope($leads, user(), 'view_deals', $dealRules);

        $deals = $leads->paginate(10);

        $deals->getCollection()->transform(function ($deal) {
            // attach custom fields
            return $deal->withCustomFields();
        });

        return Reply::dataOnly(['deals' => $deals]);
    }

    public function dateFilter($query, $startDate, $endDate, $request)
    {
        if ($startDate && $endDate) {
            $query->where(function ($task) use ($startDate, $endDate, $request) {
                if ($request->date_filter_on == 'updated_at') {
                    $task->whereBetween(DB::raw('DATE(leads.`updated_at`)'), [$startDate, $endDate]);
                } elseif ($request->date_filter_on == 'next_follow_up_date') {
                    $task->whereHas('followup', function ($q) use ($startDate, $endDate) {
                        $q->whereBetween(DB::raw('DATE(lead_follow_up.`next_follow_up_date`)'), [$startDate, $endDate]);
                    });
                } else {
                    $task->whereBetween(DB::raw('DATE(deals.`created_at`)'), [$startDate, $endDate]);
                }
            });
        }
    }
    

    public function loadMore(Request $request)
    {
        $startDate = ($request->start_date && $request->start_date != 'null' && $request->start_date != '') ? companyToDateString($request->start_date) : null;
        $endDate = ($request->end_date && $request->end_date != 'null' && $request->end_date != '') ? companyToDateString($request->end_date) : null;
        $skip = $request->currentTotalTasks;
        $totalTasks = $request->totalTasks;

        $leads = Deal::select('leads.*', 'deals.*', DB::raw("(select next_follow_up_date from lead_follow_up where deal_id = leads.id and deals.next_follow_up  = 'yes' ORDER BY next_follow_up_date desc limit 1) as next_follow_up_date"))
            ->leftJoin('leads', 'leads.id', 'deals.lead_id')
            ->where('deals.pipeline_stage_id', $request->columnId)
            ->orderBy('deals.created_at', 'desc')
            ->groupBy('deals.id');

        if ($startDate && $endDate) {
            $leads->where(function ($task) use ($startDate, $endDate) {
                $task->whereBetween(DB::raw('DATE(leads.`created_at`)'), [$startDate, $endDate]);
            });
        }

        if ($request->filled('min_value_range') && $request->min_value_range != 'undefined') {
            $leads->where('deals.value', '>=', $request->min_value_range);
        }
        if ($request->filled('max_value_range') && $request->max_value_range != 'undefined') {
            $leads->where('deals.value', '<=', $request->max_value_range);
        }

        if ($request->agent_status == 'unassigned') {
            $leads->whereNull('deals.agent_id');
        } elseif ($request->filled('agent_id') && $request->agent_id != 'all') {
            $leads->whereHas('leadAgent', function ($q) use ($request) {
                $q->where('user_id', $request->agent_id);
            });
        } elseif ($request->agent_status == 'active') {
            $leads->whereHas('leadAgent.user', function ($q) {
                $q->where('status', 'active');
            });
        } elseif ($request->agent_status == 'inactive') {
            $leads->whereHas('leadAgent.user', function ($q) {
                $q->where('status', '!=', 'active');
            });
        }

        if ($request->followUp != 'all' && $request->followUp != '' && $request->followUp != 'undefined') {
            $leads = $leads->leftJoin('lead_follow_up', 'lead_follow_up.deal_id', 'deals.id');

            if ($request->followUp == 'yes') {
                $leads->where('deals.next_follow_up', 'yes');
            } else {
                $leads->where('deals.next_follow_up', 'no');
            }
        }

        if ($request->filled('search')) {
            $searchTerm = $request->search;
            $leads->where(function($query) use ($searchTerm) {
                $query->where('deals.name', 'like', '%' . $searchTerm . '%')
                      ->orWhereHas('contact', function($q) use ($searchTerm) {
                          $q->where('client_name', 'like', '%' . $searchTerm . '%')
                            ->orWhere('client_email', 'like', '%' . $searchTerm . '%')
                            ->orWhere('company_name', 'like', '%' . $searchTerm . '%');
                      });
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
        PermissionService::applyScope($leads, user(), 'view_deals', $dealRules);

        $leads->skip($skip)->take($this->taskBoardColumnLength);
        $leads = $leads->get();
        $this->leads = $leads;

        if ($totalTasks <= ($skip + $this->taskBoardColumnLength)) {
            $loadStatus = 'hide';
        } else {
            $loadStatus = 'show';
        }

        $view = view('leads.board.load_more', $this->data)->render();

        return Reply::dataOnly(['view' => $view, 'load_more' => $loadStatus]);
    }

    public function updateIndex(Request $request)
    {
        $taskIds = $request->taskIds;
        $boardColumnId = $request->boardColumnId;
        $priorities = $request->prioritys;

        $board = PipelineStage::findOrFail($boardColumnId);

        if (isset($taskIds) && count($taskIds) > 0) {

            $taskIds = (array_filter($taskIds, function ($value) {
                return $value !== null;
            }));

            foreach ($taskIds as $key => $taskId) {
                if (!is_null($taskId)) {
                    $task = Deal::findOrFail($taskId);
                    
                    $oldStageId = $task->pipeline_stage_id;
                    $newStageId = $boardColumnId;
                    
                    $task->update(
                        [
                            'pipeline_stage_id' => $boardColumnId,
                            'column_priority' => $priorities[$key]
                        ]
                    );

                    if ($oldStageId != $newStageId) {
                        $this->triggerDealMoveAutomation($task);
                    }

                }
            }
        }

        return Reply::dataOnly(['status' => 'success']);
    }

    public function collapseColumn(Request $request)
    {
        $setting = UserLeadboardSetting::firstOrNew([
            'user_id' => user()->id,
            'pipeline_stage_id' => $request->boardColumnId,
        ]);
        $setting->collapsed = (($request->type == 'minimize') ? 1 : 0);
        $setting->save();

        return Reply::dataOnly(['status' => 'success']);
    }

    public function getStageSlug(Request $request)
    {
        $stage = PipelineStage::find($request->statusID);
        return response()->json(['slug' => $stage->slug]);
    }
}
