<?php

namespace App\Http\Controllers\ApiV2;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Http\Requests\ApiV2\Employee\CreateEmployeeV2Request;
use App\Models\EmployeeDetails;
use App\Models\Team;
use App\Models\Designation;
use App\Models\LeadAgent;
use App\Models\Role;
use App\Models\User;
use App\Models\Company;
use App\Scopes\ActiveScope;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use App\Notifications\EmployeePasswordResetNotification;

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
            ->with(['employeeDetail.department', 'employeeDetail.designation', 'leadAgent' => function ($q) {
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

        $data = collect($paginator->items())->map(function (User $user) {
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
            ->with(['employeeDetail.department', 'employeeDetail.designation', 'leadAgent' => function ($q) {
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

        [$user, $employee, $leadAgent] = DB::transaction(function () use ($request, $companyId, $company, $employeeRole, $createLeadAgent, $uplineId) {
            $user = new User();
            $user->company_id = $companyId;
            $user->name = trim($request->input('firstName') . ' ' . $request->input('lastName'));
            $user->email = $request->input('email');
            $user->password = bcrypt(Str::random(20)); // ignored later; only used to satisfy DB schema
            $user->locale = $request->validated('locale') ?? ($company->locale ?? 'en');

            $this->applyStatus($user, $company, $request->input('status', 'active'));
            $user->save();

            $employee = new EmployeeDetails();
            $employee->user_id = $user->id;
            $employee->company_id = $companyId;
            $requestedEmployeeId = trim((string) $request->input('employeeId', ''));
            $employee->employee_id = $requestedEmployeeId !== '' ? $requestedEmployeeId : (string) $user->id;
            $employee->department_id = $request->input('departmentId');
            $employee->designation_id = $request->input('designationId');
            $employee->joining_date = Carbon::createFromFormat('Y-m-d', $request->input('joiningDate'), $company->timezone)->format('Y-m-d');
            $employee->calendar_view = 'task,events,holiday,tickets,leaves,follow_ups';
            $employee->save();

            $user->attachRole($employeeRole);
            $user->assignUserRolePermission($employeeRole->id);

            $leadAgent = null;
            if ($createLeadAgent) {
                $leadAgent = $this->ensureLeadAgentWithoutCategory($companyId, $user->id, $uplineId);
            }

            return [$user, $employee, $leadAgent];
        });

        // Only trigger password setup when `password` is provided with a non-empty value.
        // If `password` is null/empty, do not send the reset email.
        if ($request->filled('password')) {
            $this->sendPasswordSetupEmail($user);
        }

        return response()->json(Reply::successWithData('Employee created successfully', [
            'userId' => $user->id,
            'employeeId' => $employee->employee_id,
            'status' => $request->input('status', 'active') === 'inactive' ? 'inactive' : 'active',
            'leadAgentId' => $leadAgent?->id,
            'uplineId' => $leadAgent?->parent_agent_id,
        ]), 201);
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

        if ($request->filled('departmentId')) {
            $employee->department_id = $request->input('departmentId');
        }

        if ($request->filled('designationId')) {
            $employee->designation_id = $request->input('designationId');
        }

        if ($request->filled('joiningDate')) {
            $employee->joining_date = Carbon::createFromFormat('Y-m-d', $request->input('joiningDate'), $company->timezone)->format('Y-m-d');
        }

        if ($request->has('employeeId')) {
            $requestedEmployeeId = trim((string) $request->input('employeeId'));
            if ($requestedEmployeeId !== '') {
                $employee->employee_id = $requestedEmployeeId;
            } elseif (empty($employee->employee_id)) {
                $employee->employee_id = (string) $user->id;
            }
        } elseif (empty($employee->employee_id)) {
            $employee->employee_id = (string) $user->id;
        }

        $employee->save();

        // Send password setup email only when a non-empty `password` field is provided.
        // Value is ignored; presence + non-empty triggers the email.
        if ($request->filled('password')) {
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

        return response()->json(Reply::successWithData('Employee updated successfully', [
            'userId' => $user->id,
            'employeeId' => $employee->employee_id,
            'status' => $user->status === 'deactive' ? 'inactive' : 'active',
            'inactiveDate' => $this->formatYmd($user->inactive_date),
            'leadAgentId' => $leadAgent?->id,
            'uplineId' => $leadAgent?->parent_agent_id,
        ]));
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

    private function sendPasswordSetupEmail(User $user): void
    {
        // We manually create the token in `password_resets` and then send a reset email
        // using our custom notification/template.
        $token = Str::random(60);
        DB::table('password_resets')->updateOrInsert(
            ['email' => $user->email],
            [
                'token' => Hash::make($token),
                'created_at' => now(),
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
}

