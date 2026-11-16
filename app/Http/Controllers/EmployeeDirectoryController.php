<?php

namespace App\Http\Controllers;

use App\Models\Designation;
use App\Models\Role;
use App\Models\Team;
use App\Models\User;
use App\Scopes\ActiveScope;
use App\Services\EmployeeDirectoryService;
use App\Services\EmployeeImpersonationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeDirectoryController extends AccountBaseController
{
    public function __construct(
        private EmployeeDirectoryService $directory,
        private EmployeeImpersonationService $impersonation,
    ) {
        parent::__construct();

        $this->pageTitle = 'app.menu.employees';

        $this->middleware(function ($request, $next) {
            $this->ensureAdmin($request);

            return $next($request);
        })->except(['leave']);
    }

    public function index(Request $request): Response
    {
        $this->ensureAdmin($request);

        $actor = $request->user();
        $filters = $this->filters($request);

        return Inertia::render('Settings/Employees/Index', [
            'pageTitle' => __('app.menu.employees'),
            'filters' => $filters,
            'employees' => $this->directory->paginate($actor, $filters),
            'departments' => Team::query()
                ->orderBy('team_name')
                ->get(['id', 'team_name'])
                ->map(fn (Team $team) => [
                    'id' => $team->id,
                    'name' => $team->team_name,
                ])
                ->values(),
            'designations' => Designation::query()
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Designation $designation) => [
                    'id' => $designation->id,
                    'name' => $designation->name,
                ])
                ->values(),
            'roles' => Role::query()
                ->where('name', '<>', 'client')
                ->orderBy('display_name')
                ->get(['id', 'name', 'display_name'])
                ->map(fn (Role $role) => [
                    'id' => $role->id,
                    'name' => $role->name,
                    'display_name' => $role->display_name ?: $role->name,
                ])
                ->values(),
        ]);
    }

    public function store(Request $request, int $user): RedirectResponse
    {
        $this->ensureAdmin($request);

        $employee = User::query()
            ->withoutGlobalScope(ActiveScope::class)
            ->findOrFail($user);

        $this->impersonation->start($request, $employee);

        return redirect()->route('dashboard');
    }

    public function leave(Request $request): RedirectResponse
    {
        $this->impersonation->leave($request);

        return redirect()->route('settings-employees.index');
    }

    private function ensureAdmin(Request $request): void
    {
        abort_403($this->impersonation->isActive());
        abort_403(! $request->user()?->hasRole('admin'));
    }

    /**
     * @return array{
     *     search: string,
     *     status: string,
     *     department_id: int|null,
     *     designation_id: int|null,
     *     role_id: int|null,
     *     per_page: int
     * }
     */
    private function filters(Request $request): array
    {
        $status = $request->string('status')->toString();

        if (! in_array($status, ['active', 'deactive', 'all'], true)) {
            $status = 'active';
        }

        $perPage = (int) $request->input('per_page', 25);

        if (! in_array($perPage, [10, 15, 25, 50, 100], true)) {
            $perPage = 25;
        }

        $search = trim($request->string('search')->toString());

        if (mb_strlen($search) > 255) {
            $search = mb_substr($search, 0, 255);
        }

        return [
            'search' => $search,
            'status' => $status,
            'department_id' => $this->positiveInt($request->input('department_id')),
            'designation_id' => $this->positiveInt($request->input('designation_id')),
            'role_id' => $this->positiveInt($request->input('role_id')),
            'per_page' => $perPage,
        ];
    }

    private function positiveInt(mixed $value): ?int
    {
        $id = (int) $value;

        return $id > 0 ? $id : null;
    }
}
