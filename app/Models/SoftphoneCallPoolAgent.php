<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Membership of a user in a line's incoming-call pool.
 *
 * One row per (device_id, user_id): an agent who covers two lines has one row
 * per line, with its own priority and active flag.
 */
class SoftphoneCallPoolAgent extends Model
{
    use HasCompany;

    protected $table = 'softphone_call_agents';
    protected $guarded = ['id'];

    protected $casts = [
        'active' => 'boolean',
        'priority' => 'integer',
    ];

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function device(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(SoftphoneDevice::class, 'device_id');
    }

    /**
     * Users of this company eligible to take calls — i.e. those holding the
     * make_softphone_calls permission. Admins are excluded: they already bypass
     * the pool (see TelephonySoftphoneEventController can_ring), so listing them
     * would imply they are queued like everyone else.
     *
     * @return \Illuminate\Support\Collection<int, \App\Models\User>
     */
    public static function eligibleUsersForCompany(int $companyId)
    {
        $leadAgentUserIds = LeadAgent::query()
            ->where('company_id', $companyId)
            ->where('status', 'enabled')
            ->pluck('user_id')
            ->filter()
            ->unique()
            ->toArray();

        return User::query()
            ->where('company_id', $companyId)
            ->where('status', 'active')
            ->where(function ($q) use ($leadAgentUserIds): void {
                if (! empty($leadAgentUserIds)) {
                    $q->whereIn('id', $leadAgentUserIds);
                }
                $q->orWhereExists(function ($sub): void {
                    $sub->select(DB::raw(1))
                        ->from('user_permissions')
                        ->join('permissions', 'permissions.id', '=', 'user_permissions.permission_id')
                        ->whereColumn('user_permissions.user_id', 'users.id')
                        ->where('permissions.name', 'make_softphone_calls')
                        ->whereIn('user_permissions.permission_type_id', [
                            PermissionType::ALL,
                            PermissionType::ADDED,
                        ]);
                });
                $q->orWhereExists(function ($sub): void {
                    $sub->select(DB::raw(1))
                        ->from('role_user')
                        ->join('roles', 'roles.id', '=', 'role_user.role_id')
                        ->whereColumn('role_user.user_id', 'users.id')
                        ->whereIn('roles.name', ['employee', 'admin']);
                });
            })
            ->whereNotExists(function ($sub): void {
                $sub->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->where('roles.name', 'client');
            })
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
    }

    /** Admin users of a company — never part of a line pool. */
    public static function adminUserIds(int $companyId): array
    {
        return User::query()
            ->where('company_id', $companyId)
            ->whereExists(function ($query): void {
                $query->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->where('roles.name', 'admin');
            })
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Line ids a non-admin user may use (receive and dial on). Admins are not
     * restricted — callers must check that separately.
     *
     * Returns null when the user is on the admin fallback list (a row with no
     * line): fallback users must be able to register on any line to be rung.
     *
     * @return array<int, int>|null
     */
    public static function allowedDeviceIdsForUser(int $companyId, int $userId): ?array
    {
        $rows = static::query()
            ->where('company_id', $companyId)
            ->where('user_id', $userId)
            ->where('active', true)
            ->get(['device_id']);

        if ($rows->contains(fn ($row) => $row->device_id === null)) {
            return null;
        }

        return $rows->pluck('device_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
    }

    /** Active company users (admins and staff) who can be added to the fallback list. */
    public static function eligibleFallbackUsersForCompany(int $companyId)
    {
        return User::query()
            ->where('company_id', $companyId)
            ->where('status', 'active')
            ->where('login', '!=', 'disable')
            ->where(function ($query): void {
                $query->whereExists(function ($adminQuery): void {
                    $adminQuery->select(DB::raw(1))
                        ->from('role_user')
                        ->join('roles', 'roles.id', '=', 'role_user.role_id')
                        ->whereColumn('role_user.user_id', 'users.id')
                        ->where('roles.name', 'admin');
                })->orWhere(function ($staffQuery): void {
                    $staffQuery->whereNotExists(function ($clientQuery): void {
                        $clientQuery->select(DB::raw(1))
                            ->from('role_user')
                            ->join('roles', 'roles.id', '=', 'role_user.role_id')
                            ->whereColumn('role_user.user_id', 'users.id')
                            ->where('roles.name', 'client');
                    })->whereExists(function ($permQuery): void {
                        $permQuery->select(DB::raw(1))
                            ->from('user_permissions')
                            ->join('permissions', 'permissions.id', '=', 'user_permissions.permission_id')
                            ->whereColumn('user_permissions.user_id', 'users.id')
                            ->where('permissions.name', 'make_softphone_calls')
                            ->whereIn('user_permissions.permission_type_id', [
                                PermissionType::ALL,
                                PermissionType::ADDED,
                            ]);
                    });
                });
            })
            ->orderBy('name')
            ->get(['id', 'name', 'email']);
    }
}
