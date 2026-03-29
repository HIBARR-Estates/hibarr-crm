<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\Agent\StoreAgentRequest;
use App\Http\Requests\Agent\UpdateAgentRequest;
use App\Http\Requests\Admin\Employee\ImportProcessRequest;
use App\Http\Requests\Admin\Employee\ImportRequest;
use App\Imports\AgentImport;
use App\Jobs\ImportAgentJob;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\Role;
use App\Models\User;
use App\Services\PermissionService;
use App\Traits\ImportExcel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AgentController extends AccountBaseController
{

    use ImportExcel;

    public function __construct()
    {
        parent::__construct();
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

    /**
     * Display a listing of agents.
     */
    public function index(Request $request)
    {
        $viewPermission = user()->permission('view_lead_agents');

        if (!in_array($viewPermission, ['all', 'added', 'owned', 'both'])) {
            if ($request->ajax() || $request->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $query = LeadAgent::with(['user', 'category'])
            ->where('company_id', company()->id);

        // Apply permission scoping
        if ($viewPermission === 'added') {
            $query->where('added_by', user()->id);
        } elseif ($viewPermission === 'owned') {
            $query->where('user_id', user()->id);
        } elseif ($viewPermission === 'both') {
            $query->where(function ($q) {
                $q->where('added_by', user()->id)
                  ->orWhere('user_id', user()->id);
            });
        }

        // Search filter
        if ($search = $request->input('search')) {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Status filter
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Category filter
        if ($categoryId = $request->input('category_id')) {
            $query->where('lead_category_id', $categoryId);
        }

        // Date range filters
        if ($startDate = $request->input('start_date')) {
            $query->whereDate('created_at', '>=', $startDate);
        }

        if ($endDate = $request->input('end_date')) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $allowedSorts = ['created_at', 'status'];

        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortDirection);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $perPage = $request->input('per_page', 15);
        $agents = $query->paginate($perPage);

        // Add deals count to each agent
        $agents->getCollection()->transform(function ($agent) {
            $agent->deals_count = $agent->leads()->count();
            return $agent;
        });

        $categories = LeadCategory::where('company_id', company()->id)->get();

        $roles = Role::where('company_id', company()->id)
            ->select('id', 'name', 'display_name')
            ->get();

        return Inertia::render('Agents/Index', [
            'pageTitle' => 'Agents',
            'agents' => [
                'data' => $agents->items(),
                'current_page' => $agents->currentPage(),
                'last_page' => $agents->lastPage(),
                'per_page' => $agents->perPage(),
                'total' => $agents->total(),
                'from' => $agents->firstItem(),
                'to' => $agents->lastItem(),
            ],
            'categories' => $categories,
            'roles' => $roles,
            'filters' => $request->only(['search', 'status', 'category_id', 'start_date', 'end_date']),
            'permissions' => [
                'add_lead_agent' => user()->permission('add_lead_agent'),
                'edit_lead_agent' => user()->permission('edit_lead_agent'),
                'delete_lead_agent' => user()->permission('delete_lead_agent'),
                'view_lead_agents' => $viewPermission,
            ],
        ]);
    }

    /**
     * Show the form for creating a new agent.
     */
    public function create(Request $request)
    {
        $addPermission = user()->permission('add_lead_agent');

        if (!in_array($addPermission, ['all', 'added'])) {
            if ($request->ajax() || $request->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $employees = User::join('role_user', 'role_user.user_id', '=', 'users.id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->select('users.id', 'users.name', 'users.email', 'users.created_at', 'users.image')
            ->where('roles.name', 'employee')
            ->where('users.company_id', company()->id)
            ->get();

        $categories = LeadCategory::where('company_id', company()->id)->get();

        return Inertia::render('Agents/Create', [
            'pageTitle' => 'Add Agent',
            'employees' => $employees,
            'categories' => $categories,
        ]);
    }

    /**
     * Store a newly created agent.
     */
    public function store(StoreAgentRequest $request)
    {
        $addPermission = user()->permission('add_lead_agent');
        abort_403(!in_array($addPermission, ['all', 'added']));

        $agentType = $request->input('agent_type', 'existing');
        $categoryIds = $this->normalizeCategoryIds($request->input('category_id', []));

        $userId = DB::transaction(function () use ($request, $agentType, $categoryIds) {
            if ($agentType === 'new') {
                // Create new user for external agent
                $user = new User();
                $user->company_id = company()->id;
                $user->name = $request->input('name');
                $user->email = $request->input('email');
                $user->password = bcrypt(str()->random(16));
                $user->mobile = $request->input('mobile');
                $user->save();

                // Attach employee role
                $role = Role::where('name', 'employee')
                    ->where('company_id', company()->id)
                    ->first();

                if ($role) {
                    $user->attachRole($role->id);
                    $user->assignUserRolePermission($role->id);
                }

                $userId = $user->id;
            } else {
                $userId = $request->input('user_id');
            }

            // Create LeadAgent records
            if (empty($categoryIds)) {
                $exists = LeadAgent::where('user_id', $userId)
                    ->where('company_id', company()->id)
                    ->whereNull('lead_category_id')
                    ->exists();

                if (!$exists) {
                    LeadAgent::create([
                        'company_id' => company()->id,
                        'user_id' => $userId,
                        'lead_category_id' => null,
                        'added_by' => user()->id,
                        'status' => 'enabled',
                    ]);
                }
            } else {
                foreach ($categoryIds as $categoryId) {
                    $exists = LeadAgent::where('user_id', $userId)
                        ->where('company_id', company()->id)
                        ->where('lead_category_id', $categoryId)
                        ->exists();

                    if (!$exists) {
                        LeadAgent::create([
                            'company_id' => company()->id,
                            'user_id' => $userId,
                            'lead_category_id' => $categoryId,
                            'added_by' => user()->id,
                            'status' => 'enabled',
                        ]);
                    }
                }
            }

            return $userId;
        });

        return Reply::successWithData(__('messages.recordSaved'), [
            'redirectUrl' => route('agents.index'),
        ]);
    }

    /**
     * Display the specified agent.
     */
    public function show($id, Request $request)
    {
        $agent = LeadAgent::with(['user', 'category'])
            ->where('company_id', company()->id)
            ->findOrFail($id);

        $viewPermission = user()->permission('view_lead_agents');
        $agentRules = [
            'added' => 'added_by',
            'owned' => 'user_id',
        ];

        $access = PermissionService::checkAccess(user(), 'view_lead_agents', $agent, $agentRules);

        if (!$access['canAccess']) {
            if ($request->ajax() || $request->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        // Get all LeadAgent records for this same user (covers multiple categories)
        $agentCategories = LeadAgent::where('user_id', $agent->user_id)
            ->where('company_id', company()->id)
            ->with('category')
            ->get()
            ->pluck('category')
            ->filter()
            ->values();

        // Get deals assigned to this agent
        $deals = Deal::where('agent_id', $agent->id)
            ->with(['leadAgent.user', 'leadStage:id,name', 'pipeline:id,name'])
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('Agents/Show', [
            'pageTitle' => $agent->user->name ?? 'Agent',
            'agent' => $agent,
            'agentCategories' => $agentCategories,
            'deals' => $deals,
            'permissions' => [
                'edit_lead_agent' => user()->permission('edit_lead_agent'),
                'delete_lead_agent' => user()->permission('delete_lead_agent'),
                'view_deals' => user()->permission('view_deals'),
            ],
        ]);
    }

    /**
     * Show the form for editing the specified agent.
     */
    public function edit($id, Request $request)
    {
        $agent = LeadAgent::with(['user', 'category'])
            ->where('company_id', company()->id)
            ->findOrFail($id);

        $agentRules = [
            'added' => 'added_by',
            'owned' => 'user_id',
        ];

        $access = PermissionService::checkAccess(user(), 'edit_lead_agent', $agent, $agentRules);

        if (!$access['canAccess']) {
            if ($request->ajax() || $request->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        $categories = LeadCategory::where('company_id', company()->id)->get();

        // Get current category IDs for this agent's user
        $currentCategoryIds = LeadAgent::where('user_id', $agent->user_id)
            ->where('company_id', company()->id)
            ->pluck('lead_category_id')
            ->filter()
            ->values();

        return Inertia::render('Agents/Edit', [
            'pageTitle' => 'Edit Agent',
            'agent' => $agent,
            'categories' => $categories,
            'currentCategoryIds' => $currentCategoryIds,
        ]);
    }

    /**
     * Update the specified agent.
     */
    public function update(UpdateAgentRequest $request, $id)
    {
        $agent = LeadAgent::where('company_id', company()->id)->findOrFail($id);

        $agentRules = [
            'added' => 'added_by',
            'owned' => 'user_id',
        ];

        $access = PermissionService::checkAccess(user(), 'edit_lead_agent', $agent, $agentRules);
        abort_403(!$access['canAccess']);

        DB::transaction(function () use ($request, $agent) {
            // Update status if provided
            if ($request->has('status')) {
                LeadAgent::where('user_id', $agent->user_id)
                    ->where('company_id', company()->id)
                    ->update([
                        'status' => $request->input('status'),
                        'last_updated_by' => user()->id,
                    ]);
            }

            // Update categories if provided
            if ($request->has('category_id')) {
                $categoryIds = $this->normalizeCategoryIds($request->input('category_id', []));
                $addedBy = $agent->added_by ?? user()->id;

                LeadAgent::where('user_id', $agent->user_id)
                    ->where('company_id', company()->id)
                    ->delete();

                if (empty($categoryIds)) {
                    LeadAgent::create([
                        'user_id' => $agent->user_id,
                        'lead_category_id' => null,
                        'company_id' => company()->id,
                        'added_by' => $addedBy,
                        'last_updated_by' => user()->id,
                        'status' => $request->input('status', 'enabled'),
                    ]);
                } else {
                    foreach ($categoryIds as $categoryId) {
                        LeadAgent::firstOrCreate(
                            [
                                'user_id' => $agent->user_id,
                                'lead_category_id' => $categoryId,
                                'company_id' => company()->id,
                            ],
                            [
                                'added_by' => $addedBy,
                                'last_updated_by' => user()->id,
                                'status' => $request->input('status', 'enabled'),
                            ]
                        );
                    }
                }
            }

            // Update user details if provided
            $user = User::find($agent->user_id);

            if ($user) {
                if ($request->has('name')) {
                    $user->name = $request->input('name');
                }

                if ($request->has('email')) {
                    $user->email = $request->input('email');
                }

                if ($request->has('mobile')) {
                    $user->mobile = $request->input('mobile');
                }

                $user->save();
            }
        });

        return Reply::successWithData(__('messages.updateSuccess'), [
            'redirectUrl' => route('agents.show', $id),
        ]);
    }

    /**
     * Remove the specified agent.
     */
    public function destroy($id)
    {
        $agent = LeadAgent::where('company_id', company()->id)->findOrFail($id);

        $deletePermission = user()->permission('delete_lead_agent');
        abort_403(!($deletePermission === 'all'
            || ($deletePermission === 'added' && $agent->added_by == user()->id)
            || ($deletePermission === 'owned' && $agent->user_id == user()->id)
            || ($deletePermission === 'both' && ($agent->added_by == user()->id || $agent->user_id == user()->id))
        ));

        // Delete all LeadAgent records for this user in this company
        LeadAgent::where('user_id', $agent->user_id)
            ->where('company_id', company()->id)
            ->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    /**
     * Apply bulk quick actions (enable, disable, delete, change_role).
     */
    public function applyQuickAction(Request $request)
    {
        $rowIds = explode(',', $request->row_ids);
        $actionType = $request->action_type;

        switch ($actionType) {
            case 'enable':
                LeadAgent::whereIn('id', $rowIds)
                    ->where('company_id', company()->id)
                    ->update(['status' => 'enabled', 'last_updated_by' => user()->id]);
                return Reply::success(__('messages.updateSuccess'));

            case 'disable':
                LeadAgent::whereIn('id', $rowIds)
                    ->where('company_id', company()->id)
                    ->update(['status' => 'disabled', 'last_updated_by' => user()->id]);
                return Reply::success(__('messages.updateSuccess'));

            case 'change_role':
                $roleId = $request->role_id;

                if (!$roleId) {
                    return Reply::error(__('messages.selectRole'));
                }

                $role = Role::where('id', $roleId)
                    ->where('company_id', company()->id)
                    ->first();

                if (!$role) {
                    return Reply::error(__('messages.roleNotFound'));
                }

                $userIds = LeadAgent::whereIn('id', $rowIds)
                    ->where('company_id', company()->id)
                    ->pluck('user_id')
                    ->unique();

                foreach ($userIds as $userId) {
                    $user = User::find($userId);

                    if ($user) {
                        // Remove existing roles and attach new one
                        DB::table('role_user')->where('user_id', $userId)->delete();
                        $user->attachRole($role->id);
                        $user->assignUserRolePermission($role->id);
                    }
                }

                return Reply::success(__('messages.updateSuccess'));

            case 'delete':
                $agents = LeadAgent::whereIn('id', $rowIds)
                    ->where('company_id', company()->id)
                    ->get();

                $deletePermission = user()->permission('delete_lead_agent');

                foreach ($agents as $agent) {
                    $canDelete = $deletePermission === 'all'
                        || ($deletePermission === 'added' && $agent->added_by == user()->id)
                        || ($deletePermission === 'owned' && $agent->user_id == user()->id)
                        || ($deletePermission === 'both' && ($agent->added_by == user()->id || $agent->user_id == user()->id));

                    if ($canDelete) {
                        $agent->delete();
                    }
                }

                return Reply::success(__('messages.deleteSuccess'));

            default:
                return Reply::error(__('messages.actionNotFound'));
        }
    }

    /**
     * Show the import form / upload step.
     */
    public function importAgents()
    {
        $addPermission = user()->permission('add_lead_agent');

        if (!in_array($addPermission, ['all', 'added'])) {
            if (request()->ajax() || request()->header('X-Inertia')) {
                return redirect()->back()->with('error', __('messages.permissionDenied'));
            }
            abort(403);
        }

        if (request()->inertia() || request()->wantsJson()) {
            return response()->json(['status' => 'success']);
        }

        return view('agents.import', $this->data);
    }

    /**
     * Store the uploaded import file and return parsed data.
     */
    public function importStore(ImportRequest $request)
    {
        $rvalue = $this->importFileProcess($request, AgentImport::class);

        if ($rvalue === 'abort') {
            if ($request->wantsJson() || $request->inertia()) {
                return response()->json(['error' => __('messages.abortAction')], 400);
            }

            return Reply::error(__('messages.abortAction'));
        }

        if ($request->inertia() || $request->wantsJson()) {
            return response()->json([
                'status' => 'success',
                'message' => __('messages.importUploadSuccess'),
            ]);
        }

        return Reply::successWithData(__('messages.importUploadSuccess'), []);
    }

    /**
     * Process the import and dispatch jobs.
     */
    public function importProcess(ImportProcessRequest $request)
    {
        $batch = $this->importJobProcess($request, AgentImport::class, ImportAgentJob::class);

        if ($request->inertia() || $request->wantsJson()) {
            return response()->json([
                'status' => 'success',
                'message' => __('messages.importProcessStart'),
                'batch' => $batch,
            ]);
        }

        return Reply::successWithData(__('messages.importProcessStart'), ['batch' => $batch]);
    }

    /**
     * Download sample import file.
     */
    public function downloadSampleImport()
    {
        $sampleFilePath = public_path('sample-import/agent-sample.xlsx');

        if (!file_exists($sampleFilePath)) {
            return response()->json(['error' => 'Sample file not found'], 404);
        }

        return response()->download($sampleFilePath, 'agent-sample.xlsx');
    }

    /**
     * Normalize category ID input to an array of non-empty IDs.
     */
    private function normalizeCategoryIds($input): array
    {
        if (!is_array($input)) {
            $input = $input !== null && $input !== '' ? [$input] : [];
        }

        return array_values(array_filter($input));
    }

}
