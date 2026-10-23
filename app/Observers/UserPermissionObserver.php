<?php

namespace App\Observers;

use App\Models\SoftphoneCallPoolAgent;
use App\Models\UserPermission;
use Illuminate\Support\Facades\Schema;

class UserPermissionObserver
{
    public function saving(UserPermission $permission): void
    {
        \Illuminate\Support\Facades\Cache::forget('permission-' . $permission->permission->name . '-' . $permission->user_id);
        \Illuminate\Support\Facades\Cache::forget('permission-id-' . $permission->permission->name . '-' . $permission->user_id);
    }

    public function created(UserPermission $permission): void
    {
        if ($permission->permission?->name !== 'make_softphone_calls') {
            return;
        }

        $companyId = $permission->user?->company_id;
        if (empty($companyId)) {
            return;
        }

        // device_id arrives in a later migration than this observer's first
        // write. During a fresh migrate the table is already present but not
        // yet altered, so writing the column would abort the migration.
        if (! Schema::hasColumn('softphone_call_agents', 'device_id')) {
            return;
        }

        // Admins are not call-pool agents — the pool routes inbound calls to
        // the people who answer them, and adding admins made every admin ring.
        if ($permission->user?->hasRole('admin')) {
            return;
        }

        // Seed the agent into the company's default line so they are reachable
        // for inbound calls as soon as they hold the permission.
        $defaultDeviceId = \App\Models\SoftphoneDevice::query()
            ->where('company_id', $companyId)
            ->orderByDesc('is_default')
            ->value('id');

        SoftphoneCallPoolAgent::firstOrCreate(
            [
                'device_id' => $defaultDeviceId,
                'user_id' => $permission->user_id,
            ],
            [
                'company_id' => $companyId,
                'priority' => 100,
                'active' => true,
                'added_by' => $permission->user_id,
            ]
        );
    }
}
