<?php

namespace App\Services;

use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class EmployeeDirectoryService
{
    public function __construct(private EmployeeImpersonationService $impersonation)
    {
    }

    /**
     * Employees in the actor's company. Anyone with the employee role is
     * included, including admins who also have it; those rows stay visible
     * and the impersonate action is withheld.
     *
     * @param  array{
     *     search: string,
     *     status: string,
     *     department_id: int|null,
     *     designation_id: int|null,
     *     role_id: int|null,
     *     per_page: int
     * }  $filters
     */
    public function paginate(User $actor, array $filters): LengthAwarePaginator
    {
        $actor->loadMissing('roles:id,name');

        return $this->query($actor, $filters)
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(fn (User $user) => $this->present($actor, $user));
    }

    /**
     * @param  array{
     *     search: string,
     *     status: string,
     *     department_id: int|null,
     *     designation_id: int|null,
     *     role_id: int|null,
     *     per_page: int
     * }  $filters
     */
    private function query(User $actor, array $filters): Builder
    {
        $query = User::query()
            ->withoutGlobalScope(ActiveScope::class)
            ->select([
                'users.id',
                'users.company_id',
                'users.name',
                'users.email',
                'users.status',
                'users.login',
                'users.admin_approval',
            ])
            ->where('users.company_id', $actor->company_id)
            ->whereHas('roles', fn (Builder $roles) => $roles->where('roles.name', 'employee'))
            ->with([
                'roles:id,name,display_name',
                'employeeDetail:id,user_id,employee_id,department_id,designation_id',
                'employeeDetail.department:id,team_name',
                'employeeDetail.designation:id,name',
            ]);

        if (in_array($filters['status'], ['active', 'deactive'], true)) {
            $query->where('users.status', $filters['status']);
        }

        if ($filters['department_id']) {
            $query->whereHas(
                'employeeDetail',
                fn (Builder $detail) => $detail->where('department_id', $filters['department_id'])
            );
        }

        if ($filters['designation_id']) {
            $query->whereHas(
                'employeeDetail',
                fn (Builder $detail) => $detail->where('designation_id', $filters['designation_id'])
            );
        }

        if ($filters['role_id']) {
            $query->whereHas(
                'roles',
                fn (Builder $roles) => $roles->where('roles.id', $filters['role_id'])
            );
        }

        $search = $filters['search'];

        if ($search !== '') {
            $like = '%'.$search.'%';

            $query->where(function (Builder $matches) use ($like) {
                $matches->where('users.name', 'like', $like)
                    ->orWhere('users.email', 'like', $like)
                    ->orWhereHas(
                        'employeeDetail',
                        fn (Builder $detail) => $detail->where('employee_id', 'like', $like)
                    );
            });
        }

        return $query->orderBy('users.name')->orderBy('users.id');
    }

    /**
     * @return array<string, mixed>
     */
    private function present(User $actor, User $user): array
    {
        $detail = $user->employeeDetail;
        $block = $this->impersonation->blockReason($actor, $user);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'employee_id' => $detail?->employee_id,
            'department' => $detail?->department?->team_name,
            'designation' => $detail?->designation?->name,
            'roles' => $user->roles
                ->map(fn ($role) => [
                    'id' => $role->id,
                    'name' => $role->name,
                    'display_name' => $role->display_name ?: $role->name,
                ])
                ->values()
                ->all(),
            'can_impersonate' => $block === null,
            'impersonate_block' => $block,
        ];
    }
}
