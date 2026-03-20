<?php

namespace App\Http\Controllers\ApiV2;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Http\Requests\ApiV2\Employee\CreateEmployeeV2Request;
use App\Models\EmployeeDetails;
use App\Models\Team;
use App\Models\Designation;
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
            ->with(['employeeDetail.department', 'employeeDetail.designation'])
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
            ->with(['employeeDetail.department', 'employeeDetail.designation'])
            ->findOrFail($userId);

        $employee = $user->employeeDetail;

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
        ]));
    }

    public function createEmployee(CreateEmployeeV2Request $request)
    {
        $companyId = (int) $request->input('companyId');
        $company = Company::find($companyId);

        if (!$company) {
            return response()->json(Reply::error('Company not found'), 404);
        }

        $user = new User();
        $user->company_id = $companyId;
        $user->name = trim($request->input('firstName') . ' ' . $request->input('lastName'));
        $user->email = $request->input('email');
        $user->password = bcrypt(Str::random(20)); // ignored later; only used to satisfy DB schema
        $user->locale = $request->input('locale', $company->locale ?? 'en');

        $this->applyStatus($user, $company, $request->input('status', 'active'));

        $user->save();

        $employee = new EmployeeDetails();
        $employee->user_id = $user->id;
        $employee->company_id = $companyId;
        $employee->employee_id = (string) $user->id; // ignore request employeeId
        $employee->department_id = $request->input('departmentId');
        $employee->designation_id = $request->input('designationId');
        $employee->joining_date = Carbon::createFromFormat('Y-m-d', $request->input('joiningDate'), $company->timezone)->format('Y-m-d');
        $employee->calendar_view = 'task,events,holiday,tickets,leaves,follow_ups';
        $employee->save();

        $employeeRole = Role::where('name', 'employee')
            ->where('company_id', $companyId)
            ->first();

        if ($employeeRole) {
            $user->attachRole($employeeRole);
            $user->assignUserRolePermission($employeeRole->id);
        }

        // Only trigger password setup when `password` is provided with a non-empty value.
        // If `password` is null/empty, do not send the reset email.
        if ($request->filled('password')) {
            $this->sendPasswordSetupEmail($user);
        }

        return response()->json(Reply::successWithData('Employee created successfully', [
            'userId' => $user->id,
            'employeeId' => $employee->employee_id,
            'status' => $request->input('status', 'active') === 'inactive' ? 'inactive' : 'active',
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

            $this->applyStatus($user, $company, $newStatus);

            // Spec: inactive -> active should clear the end/inactive_date.
            if ($previousStatus === 'deactive' && $newStatus === 'active') {
                $user->inactive_date = null;
            }
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

        // Always ignore request employeeId
        $employee->employee_id = (string) $user->id;

        $employee->save();

        // Send password setup email only when a non-empty `password` field is provided.
        // Value is ignored; presence + non-empty triggers the email.
        if ($request->filled('password')) {
            $this->sendPasswordSetupEmail($user);
        }

        return response()->json(Reply::successWithData('Employee updated successfully', [
            'userId' => $user->id,
            'employeeId' => $employee->employee_id,
            'status' => $user->status === 'deactive' ? 'inactive' : 'active',
            'inactiveDate' => $this->formatYmd($user->inactive_date),
        ]));
    }

    private function applyStatus(User $user, Company $company, string $status): void
    {
        $today = now($company->timezone)->toDateString();

        if ($status === 'inactive') {
            $user->status = 'deactive';
            $user->inactive_date = $today;
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

