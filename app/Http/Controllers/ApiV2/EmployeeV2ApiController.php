<?php

namespace App\Http\Controllers\ApiV2;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Http\Requests\ApiV2\Employee\CreateEmployeeV2Request;
use App\Http\Requests\ApiV2\Employee\FindOrCreateEmployeeV2Request;
use App\Models\EmployeeDetails;
use App\Models\Team;
use App\Models\Designation;
use App\Models\LeadAgent;
use App\Http\Controllers\AppSettingController;
use App\Models\Role;
use App\Models\RoleUser;
use App\Models\User;
use App\Models\Company;
use App\Models\Country;
use App\Scopes\ActiveScope;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use App\Notifications\EmployeePasswordResetNotification;
use App\Auth\Passwords\ContextAwareDatabaseTokenRepository;

class EmployeeV2ApiController extends Controller
{
    public function listDepartments(Request $request)
    {
        $companyId = (int) $request->header('X-COMPANY-ID');
        if ($companyId <= 0) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 401);
        }

        $departments = Team::query()
            ->where('company_id', $companyId)
            ->orderBy('team_name')
            ->get(['id', 'team_name'])
            ->map(fn ($t) => [
                'id' => $t->id,
                'name' => $t->team_name,
            ])
            ->values();

        return response()->json(Reply::successWithData('Departments fetched successfully', [
            'departments' => $departments,
        ]));
    }

    public function listDesignations(Request $request)
    {
        $companyId = (int) $request->header('X-COMPANY-ID');
        if ($companyId <= 0) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 401);
        }

        $designations = Designation::query()
            ->where('company_id', $companyId)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($d) => [
                'id' => $d->id,
                'name' => $d->name,
            ])
            ->values();

        return response()->json(Reply::successWithData('Designations fetched successfully', [
            'designations' => $designations,
        ]));
    }

    public function listEmployees(Request $request)
    {
        $companyId = (int) $request->header('X-COMPANY-ID');
        if ($companyId <= 0) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 401);
        }

        // Support both parameter names:
        // - status (preferred)
        // - statusFilter (legacy / client-side naming)
        $rawStatus = $request->query('status', $request->query('statusFilter', 'active'));
        $statusFilter = strtolower(trim((string) $rawStatus));
        if (!in_array($statusFilter, ['active', 'inactive'], true)) {
            return response()->json(Reply::error('Invalid status filter. Use status=active or status=inactive.'), 422);
        }

        $perPage = (int) ($request->query('perPage') ?? $request->query('per_page') ?? 20);
        $perPage = max(1, min($perPage, 100));
        $page = (int) ($request->query('page') ?? 1);
        $page = max(1, $page);

        $query = User::query()
            ->where('company_id', $companyId)
            ->onlyEmployee()
            ->with(['employeeDetail.department', 'employeeDetail.designation', 'roles', 'leadAgent' => function ($q) {
                $q->whereNull('lead_category_id');
            }])
            ->orderBy('users.id', 'desc');

        // Default behavior: active only (ActiveScope stays applied).
        // When requesting inactive employees, disable the ActiveScope global filter.
        if ($statusFilter === 'inactive') {
            $query->withoutGlobalScope(ActiveScope::class)
                ->where('users.status', 'deactive');
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        $data = collect($paginator->items())->map(function (User $user) use ($companyId) {
            $employee = $user->employeeDetail;
            $leadAgent = $user->leadAgent instanceof \Illuminate\Support\Collection
                ? $user->leadAgent->first()
                : $user->leadAgent;
            $parts = preg_split('/\s+/', trim((string) $user->name), 2);
            $firstName = $parts[0] ?? '';
            $lastName = $parts[1] ?? '';

            return [
                'userId' => $user->id,
                'firstName' => $firstName,
                'lastName' => $lastName,
                'email' => $user->email,
                'status' => $user->status === 'deactive' ? 'inactive' : 'active',
                'inactiveDate' => $this->formatYmd($user->inactive_date),

                // EmployeeDetails
                'employeeId' => $employee?->employee_id,
                'designationId' => $employee?->designation_id,
                'departmentId' => $employee?->department_id,
                'joiningDate' => $this->formatYmd($employee?->joining_date),
                'leadAgentId' => $leadAgent?->id,
                'uplineId' => $leadAgent?->parent_agent_id,
                'roleId' => $this->resolveEmployeeV2RoleId($user, $companyId),
            ];
        })->values();

        return response()->json(Reply::successWithData('Employees fetched successfully', [
            'data' => $data,
            'pagination' => [
                'total' => $paginator->total(),
                'perPage' => $paginator->perPage(),
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
            ],
        ]));
    }

    public function getEmployee(Request $request, $userId)
    {
        $companyId = (int) $request->header('X-COMPANY-ID');
        if ($companyId <= 0) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 401);
        }

        $userId = (int) $userId;

        $user = User::withoutGlobalScope(ActiveScope::class)
            ->where('company_id', $companyId)
            ->onlyEmployee()
            ->with(['employeeDetail.department', 'employeeDetail.designation', 'roles', 'leadAgent' => function ($q) {
                $q->whereNull('lead_category_id');
            }])
            ->findOrFail($userId);

        $employee = $user->employeeDetail;
        $leadAgent = $user->leadAgent instanceof \Illuminate\Support\Collection
            ? $user->leadAgent->first()
            : $user->leadAgent;

        $parts = preg_split('/\s+/', trim((string) $user->name), 2);
        $firstName = $parts[0] ?? '';
        $lastName = $parts[1] ?? '';

        $status = $user->status === 'deactive' ? 'inactive' : 'active';

        // Same as create/update: non-empty `password` (e.g. query ?password=1) triggers setup email; value is not used.
        if ($this->shouldSendPasswordSetupEmail($request) && $request->filled('password')) {
            $this->sendPasswordSetupEmail($user);
        }

        return response()->json(Reply::successWithData('Employee fetched successfully', [
            'userId' => $user->id,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'email' => $user->email,
            'status' => $status,
            'inactiveDate' => $this->formatYmd($user->inactive_date),

            'employeeId' => $employee?->employee_id,
            'designationId' => $employee?->designation_id,
            'departmentId' => $employee?->department_id,
            'joiningDate' => $this->formatYmd($employee?->joining_date),
            'leadAgentId' => $leadAgent?->id,
            'uplineId' => $leadAgent?->parent_agent_id,
            'roleId' => $this->resolveEmployeeV2RoleId($user, $companyId),
        ]));
    }

    public function createEmployee(CreateEmployeeV2Request $request)
    {
        $companyId = (int) $request->input('companyId');
        $company = Company::find($companyId);

        if (!$company) {
            return response()->json(Reply::error('Company not found'), 404);
        }

        $employeeRole = Role::where('name', 'employee')
            ->where('company_id', $companyId)
            ->first();

        if (!$employeeRole) {
            return response()->json(Reply::error('Employee role not found for this company'), 422);
        }

        $createLeadAgent = $request->boolean('createLeadAgent', false);
        $uplineId = $request->filled('uplineId') ? (int) $request->input('uplineId') : null;

        $permissionRoleId = $request->filled('roleId')
            ? (int) $request->input('roleId')
            : (int) $employeeRole->id;

        [$user, $employee, $leadAgent] = $this->persistNewEmployee(
            $request,
            $companyId,
            $company,
            $employeeRole,
            $createLeadAgent,
            $uplineId,
            $permissionRoleId
        );

        // Only trigger password setup when `password` is provided with a non-empty value.
        // If `password` is null/empty, do not send the reset email.
        if ($this->shouldSendPasswordSetupEmail($request) && $request->filled('password')) {
            $this->sendPasswordSetupEmail($user);
        }

        $user->load('roles');

        return response()->json(Reply::successWithData('Employee created successfully', [
            'userId' => $user->id,
            'employeeId' => $employee->employee_id,
            'status' => $request->input('status', 'active') === 'inactive' ? 'inactive' : 'active',
            'leadAgentId' => $leadAgent?->id,
            'uplineId' => $leadAgent?->parent_agent_id,
            'roleId' => $this->resolveEmployeeV2RoleId($user, $companyId),
        ]), 201);
    }

    public function findOrCreateEmployee(FindOrCreateEmployeeV2Request $request)
    {
        $companyId = $request->resolvedCompanyId();

        $company = Company::find($companyId);
        if (!$company) {
            return response()->json(Reply::error('Company not found'), 404);
        }

        $userType = $this->normalizeFindOrCreateUserType((string) $request->input('userType'));

        $existingUserId = $request->input('existingUserId');
        if ($existingUserId) {
            $user = User::withoutGlobalScope(ActiveScope::class)
                ->where('company_id', $companyId)
                ->findOrFail($existingUserId);

            $resolved = $this->resolveFindOrCreateExistingUser($company, $user, $userType, $request);
            if ($resolved instanceof \Illuminate\Http\JsonResponse) {
                return $resolved;
            }

            $created = (bool) ($resolved['created'] ?? false);
            $payload = collect($resolved)->except('created')->all();

            if ($this->shouldSendPasswordSetupEmail($request) && $request->filled('password')) {
                $this->sendPasswordSetupEmail($user);
            }

            if (!array_key_exists('roleId', $payload)) {
                $user->load('roles');
                $payload['roleId'] = $this->resolveEmployeeV2RoleId($user, $companyId);
            }

            return response()->json(Reply::successWithData('Employee resolved successfully', array_merge($payload, [
                'created' => $created,
            ])));
        }

        $employeeRole = Role::where('name', 'employee')
            ->where('company_id', $companyId)
            ->first();

        if (!$employeeRole) {
            return response()->json(Reply::error('Employee role not found for this company'), 422);
        }

        $createLeadAgent = $request->boolean('createLeadAgent', false) || $userType === 'lead_agent';
        $uplineId = $request->filled('uplineId') ? (int) $request->input('uplineId') : null;

        $permissionRoleId = $request->filled('roleId')
            ? (int) $request->input('roleId')
            : (int) $employeeRole->id;

        [$user, $employee, $leadAgent] = $this->persistNewEmployee(
            $request,
            $companyId,
            $company,
            $employeeRole,
            $createLeadAgent,
            $uplineId,
            $permissionRoleId
        );

        if ($userType === 'lead_agent' && $leadAgent === null) {
            $leadAgent = $this->ensureLeadAgentWithoutCategory($companyId, $user->id, $uplineId);
        }

        // New user row: send password setup notification unless explicitly disabled via flag.
        if ($this->shouldSendPasswordSetupEmail($request)) {
            $this->sendPasswordSetupEmail($user);
        }

        $user->load('roles');
        $typed = $this->typedIdsForFindOrCreate($userType, $user, $employee, $leadAgent, $companyId);

        return response()->json(Reply::successWithData(
            'Employee created successfully',
            array_merge($typed, [
                'created' => true,
                'status' => $request->input('status', 'active') === 'inactive' ? 'inactive' : 'active',
            ])
        ), 201);
    }

    public function updateEmployee(\App\Http\Requests\ApiV2\Employee\UpdateEmployeeV2Request $request, $userId)
    {
        $userId = (int) $userId;

        $companyId = (int) $request->input('companyId');
        $company = Company::find($companyId);

        if (!$company) {
            return response()->json(Reply::error('Company not found'), 404);
        }

        $user = User::withoutGlobalScope(ActiveScope::class)
            ->where('company_id', $companyId)
            ->onlyEmployee()
            ->with(['employeeDetail.department', 'employeeDetail.designation'])
            ->findOrFail($userId);

        $employee = EmployeeDetails::where('company_id', $companyId)
            ->where('user_id', $userId)
            ->first();

        if (!$employee) {
            $employee = new EmployeeDetails();
            $employee->user_id = $userId;
            $employee->company_id = $companyId;
            $employee->calendar_view = 'task,events,holiday,tickets,leaves,follow_ups';
        }

        $uplineId = $request->filled('uplineId') ? (int) $request->input('uplineId') : null;
        $existingLeadAgentId = LeadAgent::query()
            ->where('company_id', $companyId)
            ->where('user_id', $user->id)
            ->whereNull('lead_category_id')
            ->value('id');

        if ($uplineId !== null && $existingLeadAgentId !== null && $uplineId === (int) $existingLeadAgentId) {
            return response()->json(Reply::error('uplineId cannot reference the same lead agent'), 422);
        }

        if ($request->filled('firstName') || $request->filled('lastName')) {
            $nameParts = preg_split('/\s+/', trim((string) $user->name), 2);
            $existingFirstName = $nameParts[0] ?? '';
            $existingLastName = $nameParts[1] ?? '';

            $newFirstName = $request->filled('firstName')
                ? (string) $request->input('firstName')
                : $existingFirstName;
            $newLastName = $request->filled('lastName')
                ? (string) $request->input('lastName')
                : $existingLastName;

            $user->name = trim($newFirstName . ' ' . $newLastName);
        }

        if ($request->filled('email')) {
            $user->email = $request->input('email');
        }

        if ($request->has('phone')) {
            $this->formatPhone($user, $request->input('phone'));
        }

        $statusProvided = $request->has('status') || $request->has('statusFilter');
        $statusValue = $request->input('status', $request->input('statusFilter'));

        if ($statusProvided) {
            $normalizedStatus = strtolower(trim((string) $statusValue));
            if ($normalizedStatus === '') {
                return response()->json(Reply::error('Status cannot be empty. Use active or inactive.'), 422);
            }

            if (!in_array($normalizedStatus, ['active', 'inactive'], true)) {
                return response()->json(Reply::error('Invalid status. Use active or inactive.'), 422);
            }
        }

        if ($statusProvided && !empty($statusValue)) {
            $previousStatus = $user->status;
            $newStatus = strtolower(trim((string) $statusValue));

            $this->applyStatus($user, $company, $newStatus, $previousStatus);
        }

        $user->save();

        if ($request->filled('roleId')) {
            $permissionRoleId = (int) $request->input('roleId');
            $syncError = $this->syncEmployeeRoleForCompanyUser($companyId, $user, $permissionRoleId);
            if ($syncError !== null) {
                return $syncError;
            }
            $user->load('roles');
        }

        if ($request->filled('departmentId')) {
            $employee->department_id = $request->input('departmentId');
        }

        if ($request->filled('designationId')) {
            $employee->designation_id = $request->input('designationId');
        }

        if ($request->filled('joiningDate')) {
            $employee->joining_date = Carbon::createFromFormat('Y-m-d', $request->input('joiningDate'), $company->timezone)->format('Y-m-d');
        }

        // Employee ID must always mirror the User ID in v2 API.
        $employee->employee_id = (string) $user->id;

        $employee->save();

        // Send password setup email only when a non-empty `password` field is provided.
        // Value is ignored; presence + non-empty triggers the email.
        if ($this->shouldSendPasswordSetupEmail($request) && $request->filled('password')) {
            $this->sendPasswordSetupEmail($user);
        }

        $leadAgent = null;
        if ($request->boolean('createLeadAgent', false)) {
            $leadAgent = $this->ensureLeadAgentWithoutCategory($companyId, $user->id, $uplineId);
        }

        if ($leadAgent === null) {
            $leadAgent = LeadAgent::query()
                ->where('company_id', $companyId)
                ->where('user_id', $user->id)
                ->whereNull('lead_category_id')
                ->first();
        }

        if (!$user->relationLoaded('roles')) {
            $user->load('roles');
        }

        return response()->json(Reply::successWithData('Employee updated successfully', [
            'userId' => $user->id,
            'employeeId' => $employee->employee_id,
            'status' => $user->status === 'deactive' ? 'inactive' : 'active',
            'inactiveDate' => $this->formatYmd($user->inactive_date),
            'leadAgentId' => $leadAgent?->id,
            'uplineId' => $leadAgent?->parent_agent_id,
            'roleId' => $this->resolveEmployeeV2RoleId($user, $companyId),
        ]));
    }

    /**
     * @return array{0: User, 1: EmployeeDetails, 2: LeadAgent|null}
     */
    private function persistNewEmployee(
        FormRequest $request,
        int $companyId,
        Company $company,
        Role $employeeRole,
        bool $createLeadAgent,
        ?int $uplineId,
        int $permissionRoleId
    ): array {
        return DB::transaction(function () use ($request, $companyId, $company, $employeeRole, $createLeadAgent, $uplineId, $permissionRoleId) {
            $user = new User();
            $user->company_id = $companyId;
            $user->name = trim($request->input('firstName') . ' ' . $request->input('lastName'));
            $user->email = $request->input('email');
            $this->formatPhone($user, $request->input('phone'));
            $user->password = bcrypt(Str::random(20)); // ignored later; only used to satisfy DB schema
            $user->locale = $company->locale ?? 'en';

            $this->applyStatus($user, $company, $request->input('status', 'active'));
            $user->save();

            $employee = new EmployeeDetails();
            $employee->user_id = $user->id;
            $employee->company_id = $companyId;
            $employee->employee_id = (string) $user->id;
            $employee->department_id = $request->input('departmentId');
            $employee->designation_id = $request->input('designationId');
            $employee->joining_date = Carbon::createFromFormat('Y-m-d', $request->input('joiningDate'), $company->timezone)->format('Y-m-d');
            $employee->calendar_view = 'task,events,holiday,tickets,leaves,follow_ups';
            $employee->save();

            $this->applyEmployeeRoleSync($user, $employeeRole, $permissionRoleId);

            $leadAgent = null;
            if ($createLeadAgent) {
                $leadAgent = $this->ensureLeadAgentWithoutCategory($companyId, $user->id, $uplineId);
            }

            return [$user, $employee, $leadAgent];
        });
    }

    private function normalizeFindOrCreateUserType(string $raw): string
    {
        if ($raw === 'leadAgent' || strtolower($raw) === 'leadagent' || strtolower($raw) === 'lead_agent') {
            return 'lead_agent';
        }

        return strtolower(trim($raw));
    }

    /**
     * @return array<string, mixed>|\Illuminate\Http\JsonResponse
     */
    private function resolveFindOrCreateExistingUser(
        Company $company,
        User $user,
        string $userType,
        FindOrCreateEmployeeV2Request $request
    ) {
        $companyId = (int) $company->id;
        $uplineId = $request->filled('uplineId') ? (int) $request->input('uplineId') : null;

        if ($userType === 'user') {
            $user->load('roles');

            return [
                'userId' => $user->id,
                'roleId' => $this->resolveEmployeeV2RoleId($user, $companyId),
                'created' => false,
            ];
        }

        if ($userType === 'employee') {
            $isEmployee = User::withoutGlobalScope(ActiveScope::class)
                ->where('company_id', $companyId)
                ->whereKey($user->getKey())
                ->onlyEmployee()
                ->exists();

            if ($isEmployee) {
                if ($request->filled('roleId')) {
                    $syncError = $this->syncEmployeeRoleForCompanyUser($companyId, $user, (int) $request->input('roleId'));
                    if ($syncError !== null) {
                        return $syncError;
                    }
                }

                $user->load('roles');
                $employee = EmployeeDetails::where('company_id', $companyId)
                    ->where('user_id', $user->id)
                    ->first();

                return [
                    'userId' => $user->id,
                    'employeeId' => $employee?->employee_id ?? (string) $user->id,
                    'roleId' => $this->resolveEmployeeV2RoleId($user, $companyId),
                    'created' => false,
                ];
            }

            $employeeRole = Role::where('name', 'employee')
                ->where('company_id', $companyId)
                ->first();

            if (!$employeeRole) {
                return response()->json(Reply::error('Employee role not found for this company'), 422);
            }

            $ensured = $this->ensureEmployeeRecordForUser($company, $user, $request, $employeeRole);

            return [
                'userId' => $user->id,
                'employeeId' => $ensured['employee']->employee_id,
                'created' => $ensured['created'],
            ];
        }

        if ($userType === 'lead_agent') {
            $hadLeadAgent = LeadAgent::query()
                ->where('company_id', $companyId)
                ->where('user_id', $user->id)
                ->whereNull('lead_category_id')
                ->exists();

            $leadAgent = $this->ensureLeadAgentWithoutCategory($companyId, $user->id, $uplineId);
            $employeeId = $this->resolveEmployeeIdForFindOrCreate($companyId, $user->id);

            if ($request->filled('roleId')) {
                $syncError = $this->syncEmployeeRoleForCompanyUser($companyId, $user, (int) $request->input('roleId'));
                if ($syncError !== null) {
                    return $syncError;
                }
            }

            $user->load('roles');

            return [
                'userId' => $user->id,
                'employeeId' => $employeeId,
                'leadAgentId' => $leadAgent->id,
                'roleId' => $this->resolveEmployeeV2RoleId($user, $companyId),
                'created' => !$hadLeadAgent,
            ];
        }

        return response()->json(Reply::error('Invalid userType. Use user, employee, or lead_agent.'), 422);
    }

    /**
     * Attach employee role and/or employee_details for an existing user (same fields as create).
     *
     * @return array{employee: EmployeeDetails, created: bool}
     */
    private function ensureEmployeeRecordForUser(
        Company $company,
        User $user,
        FindOrCreateEmployeeV2Request $request,
        Role $employeeRole
    ): array {
        $companyId = (int) $company->id;

        return DB::transaction(function () use ($company, $companyId, $user, $request, $employeeRole) {
            $user = User::withoutGlobalScope(ActiveScope::class)
                ->where('company_id', $companyId)
                ->whereKey($user->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $employee = EmployeeDetails::firstOrNew([
                'company_id' => $companyId,
                'user_id' => $user->id,
            ]);
            $detailsWereNew = !$employee->exists;

            $user->name = trim($request->input('firstName') . ' ' . $request->input('lastName'));
            $this->formatPhone($user, $request->input('phone'));
            $this->applyStatus($user, $company, $request->input('status', 'active'), $user->status);
            $user->save();

            $employee->employee_id = (string) $user->id;
            $employee->department_id = $request->input('departmentId');
            $employee->designation_id = $request->input('designationId');
            $employee->joining_date = Carbon::createFromFormat('Y-m-d', $request->input('joiningDate'), $company->timezone)->format('Y-m-d');
            if (empty($employee->calendar_view)) {
                $employee->calendar_view = 'task,events,holiday,tickets,leaves,follow_ups';
            }
            $employee->save();

            $roleAdded = false;
            if ($request->filled('roleId')) {
                $this->applyEmployeeRoleSync($user, $employeeRole, (int) $request->input('roleId'));
            } elseif (!$user->hasRole('employee')) {
                $user->attachRole($employeeRole);
                $user->assignUserRolePermission($employeeRole->id);
                $roleAdded = true;
            }

            return [
                'employee' => $employee,
                'created' => $detailsWereNew || $roleAdded,
            ];
        });
    }

    /**
     * @return array<string, int|string|null>
     */
    private function typedIdsForFindOrCreate(string $userType, User $user, EmployeeDetails $employee, ?LeadAgent $leadAgent, int $companyId): array
    {
        $roleId = $this->resolveEmployeeV2RoleId($user, $companyId);

        return match ($userType) {
            'user' => ['userId' => $user->id, 'roleId' => $roleId],
            'employee' => [
                'userId' => $user->id,
                'employeeId' => $employee->employee_id,
                'roleId' => $roleId,
            ],
            'lead_agent' => [
                'userId' => $user->id,
                'employeeId' => $employee->employee_id,
                'leadAgentId' => $leadAgent?->id,
                'roleId' => $roleId,
            ],
            default => ['userId' => $user->id, 'roleId' => $roleId],
        };
    }

    private function resolveEmployeeV2RoleId(User $user, int $companyId): ?int
    {
        $employeeRoleId = Role::query()
            ->where('company_id', $companyId)
            ->where('name', 'employee')
            ->value('id');

        $attachedIds = $user->roles
            ->where('company_id', $companyId)
            ->sortBy('id')
            ->pluck('id')
            ->values();

        if ($attachedIds->isEmpty()) {
            return $employeeRoleId !== null ? (int) $employeeRoleId : null;
        }

        $employeeRoleId = $employeeRoleId !== null ? (int) $employeeRoleId : null;
        $nonEmployee = $attachedIds->first(fn (int $id) => $employeeRoleId === null || $id !== $employeeRoleId);

        return (int) ($nonEmployee ?? $attachedIds->first());
    }

    private function applyEmployeeRoleSync(User $user, Role $employeeRole, int $permissionRoleId): void
    {
        RoleUser::where('user_id', $user->id)->delete();
        $user->roles()->attach($employeeRole->id);
        if ($employeeRole->id !== $permissionRoleId) {
            $user->roles()->attach($permissionRoleId);
        }
        $user->assignUserRolePermission($permissionRoleId);
        $user->save();

        (new AppSettingController())->deleteSessions([$user->id]);
        cache()->forget('sidebar_user_perms_' . $user->id);
    }

    /**
     * @return \Illuminate\Http\JsonResponse|null
     */
    private function syncEmployeeRoleForCompanyUser(int $companyId, User $user, int $permissionRoleId): ?\Illuminate\Http\JsonResponse
    {
        $role = Role::query()
            ->where('company_id', $companyId)
            ->whereKey($permissionRoleId)
            ->first();

        if (!$role || $role->name === 'client') {
            return response()->json(Reply::error('Invalid roleId for this company.'), 422);
        }

        $employeeRole = Role::where('name', 'employee')
            ->where('company_id', $companyId)
            ->first();

        if (!$employeeRole) {
            return response()->json(Reply::error('Employee role not found for this company'), 422);
        }

        $this->applyEmployeeRoleSync($user, $employeeRole, $permissionRoleId);

        return null;
    }

    private function resolveEmployeeIdForFindOrCreate(int $companyId, int $userId): string
    {
        return EmployeeDetails::query()
            ->where('company_id', $companyId)
            ->where('user_id', $userId)
            ->value('employee_id') ?? (string) $userId;
    }

    private function applyStatus(User $user, Company $company, string $status, ?string $previousStatus = null): void
    {
        $today = now($company->timezone)->toDateString();
        $previousStatus = strtolower(trim((string) $previousStatus));

        if ($status === 'inactive') {
            $user->status = 'deactive';

            // Preserve original inactive_date if user is already inactive.
            if ($previousStatus !== 'deactive') {
                $user->inactive_date = $today;
            }
        } else {
            $user->status = 'active';
            $user->inactive_date = null;
        }
    }

    private function shouldSendPasswordSetupEmail(Request $request): bool
    {
        if ($request->has('sendOnboardingEmail')) {
            return $request->boolean('sendOnboardingEmail');
        }

        if ($request->has('send_onboarding_email')) {
            return $request->boolean('send_onboarding_email');
        }

        return true;
    }

    private function sendPasswordSetupEmail(User $user): void
    {
        // We manually create the token in `password_resets` and then send a reset email
        // using our custom notification/template. Row `type` is used by
        // ContextAwareDatabaseTokenRepository so this link stays valid for 7 days while
        // standard forgot-password rows remain limited by config('auth.passwords.users.expire').
        $token = Str::random(60);
        DB::table('password_resets')->updateOrInsert(
            ['email' => $user->email],
            [
                'token' => Hash::make($token),
                'created_at' => now(),
                'type' => ContextAwareDatabaseTokenRepository::TYPE_EMPLOYEE_INVITE,
            ]
        );

        $company = Company::find($user->company_id);
        if (!$company) {
            return;
        }

        $user->notify(new EmployeePasswordResetNotification($token, $company));
    }

    private function ensureLeadAgentWithoutCategory(int $companyId, int $userId, ?int $uplineId = null): LeadAgent
    {
        $leadAgent = LeadAgent::firstOrCreate(
            [
                'company_id' => $companyId,
                'user_id' => $userId,
                'lead_category_id' => null,
            ],
            [
                'status' => 'enabled',
                'added_by' => null,
                'last_updated_by' => null,
                'parent_agent_id' => $uplineId,
            ]
        );

        if ($uplineId !== null && $leadAgent->parent_agent_id !== $uplineId) {
            $leadAgent->parent_agent_id = $uplineId;
            $leadAgent->save();
        }

        return $leadAgent;
    }

    private function formatYmd(mixed $value): ?string
    {
        if (empty($value)) {
            return null;
        }

        if ($value instanceof Carbon) {
            return $value->format('Y-m-d');
        }

        try {
            return Carbon::parse((string) $value)->format('Y-m-d');
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function formatPhone(User $user, mixed $phoneInput): void
    {
        if (!is_string($phoneInput)) {
            return;
        }

        $e164Phone = trim($phoneInput);
        if ($e164Phone === '' || !str_starts_with($e164Phone, '+')) {
            return;
        }

        $digits = preg_replace('/\D+/', '', $e164Phone);
        if ($digits === '') {
            return;
        }

        // For API v2 we receive E.164 (e.g. +905338773001).
        // Resolve by longest known country dialing code prefix.
        $countryCode = $this->resolveCountryCodeFromE164Digits($digits);
        if ($countryCode === null) {
            return;
        }
        $localPhone = substr($digits, strlen($countryCode));

        if ($countryCode === '' || $localPhone === '') {
            return;
        }

        $user->mobile = json_encode([
            'phone' => '+' . $countryCode . ' ' . $localPhone,
            'country_code' => $countryCode,
        ]);
        $user->country_phonecode = (int) $countryCode;
    }

    private function resolveCountryCodeFromE164Digits(string $digits): ?string
    {
        static $countryCodes = null;

        if ($countryCodes === null) {
            $countryCodes = Country::query()
                ->where('phonecode', '>', 0)
                ->pluck('phonecode')
                ->map(fn ($code) => (string) $code)
                ->unique()
                ->sortByDesc(fn (string $code) => strlen($code))
                ->values()
                ->all();
        }

        foreach ($countryCodes as $countryCode) {
            if (str_starts_with($digits, $countryCode)) {
                return $countryCode;
            }
        }

        return null;
    }
}

