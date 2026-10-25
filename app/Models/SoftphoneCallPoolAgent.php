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
        return User::query()
            ->where('company_id', $companyId)
            ->whereExists(function ($query): void {
                $query->select(DB::raw(1))
                    ->from('user_permissions')
                    ->join('permissions', 'permissions.id', '=', 'user_permissions.permission_id')
                    ->whereColumn('user_permissions.user_id', 'users.id')
                    ->where('permissions.name', 'make_softphone_calls');
            })
            ->whereNotExists(function ($query): void {
                $query->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->where('roles.name', 'admin');
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
}
