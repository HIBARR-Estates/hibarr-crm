<?php

namespace App\Observers;

use App\Models\SoftphoneCallPoolAgent;
use App\Models\UserPermission;

class UserPermissionObserver
{
    public function saving(UserPermission $permission): void
    {
        if (function_exists('Cache') === false) {
            // no-op guard (cache facade may be unavailable in certain contexts)
        }
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
