<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\Permission;
use App\Models\PermissionType;
use App\Models\SoftphoneCallPoolAgent;
use App\Models\SoftphoneDevice;
use App\Models\User;
use App\Models\UserPermission;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Incoming call routing pool (per-line agent pools and admin fallback list).
 *
 * Each line has its own pool of agents. If the lead owner and line agents do not
 * answer within the fallback window, the call routes to the admin fallback list.
 * Membership is managed per line (device_id, user_id) or globally (null, user_id).
 *
 * Reads are open to any company user behind the crm.softphone flag so the
 * dock can resolve the ring list. Writes are admin-only.
 */
class TelephonySoftphoneCallPoolController extends AccountBaseController
{
    /**
     * Compute the next available priority for a pool, defaulting to 100 or the lowest unused slot <= 100.
     */
    private function nextAvailablePriority(int $companyId, ?int $deviceId, ?int $userId = null): int
    {
        $existing = SoftphoneCallPoolAgent::query()
            ->where('company_id', $companyId)
            ->when($deviceId !== null, fn ($q) => $q->where('device_id', $deviceId), fn ($q) => $q->whereNull('device_id'))
            ->when($userId !== null, fn ($q) => $q->where('user_id', '!=', $userId))
            ->pluck('priority')
            ->map(fn ($p) => (int) $p)
            ->toArray();

        if (! in_array(100, $existing, true)) {
            return 100;
        }

        for ($p = 1; $p <= 100; $p++) {
            if (! in_array($p, $existing, true)) {
                return $p;
            }
        }

        return 100;
    }

    /** Pool members for one line or the global admin fallback list. */
    public function index(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();

        $companyId = (int) company()->id;
        $fallbackSeconds = (int) (Company::query()->whereKey($companyId)->value('incoming_call_fallback_seconds') ?? company()->incoming_call_fallback_seconds ?? 20);

        $scope = $request->input('scope');
        $rawDeviceId = $request->input('device_id');

        if ($scope === 'fallback' || $rawDeviceId === 'fallback' || ($rawDeviceId !== null && (int) $rawDeviceId === 0 && $scope !== 'line')) {
            $agents = SoftphoneCallPoolAgent::query()
                ->where('company_id', $companyId)
                ->whereNull('device_id')
                ->with('user:id,name,email')
                ->orderBy('priority')
                ->orderBy('id')
                ->get()
                ->map(fn(SoftphoneCallPoolAgent $agent) => [
                    'id' => $agent->id,
                    'user_id' => $agent->user_id,
                    'name' => $agent->user?->name,
                    'email' => $agent->user?->email,
                    'priority' => $agent->priority,
                    'active' => $agent->active,
                ])
                ->values();

            return response()->json([
                'status' => 'success',
                'data' => [
                    'agents' => $agents,
                    'fallback_seconds' => $fallbackSeconds,
                ],
            ]);
        }

        $deviceId = (int) $request->input('device_id', 0);
        $this->assertDeviceBelongsToCompany($deviceId);

        $agentsQuery = SoftphoneCallPoolAgent::query()
            ->where('company_id', $companyId)
            ->where('device_id', $deviceId)
            ->with('user:id,name,email')
            ->orderBy('priority')
            ->orderBy('id')
            ->get();

        $permissionId = Permission::query()->where('name', 'make_softphone_calls')->value('id');
        $permissionUsers = $permissionId ? UserPermission::query()
            ->whereIn('user_id', $agentsQuery->pluck('user_id'))
            ->where('permission_id', $permissionId)
            ->whereIn('permission_type_id', [PermissionType::ALL, PermissionType::ADDED])
            ->pluck('user_id')
            ->flip()
            ->toArray() : [];

        $agents = $agentsQuery
            ->map(fn(SoftphoneCallPoolAgent $agent) => [
                'id' => $agent->id,
                'user_id' => $agent->user_id,
                'name' => $agent->user?->name,
                'email' => $agent->user?->email,
                'priority' => $agent->priority,
                'active' => $agent->active,
                'has_permission' => isset($permissionUsers[$agent->user_id]),
            ])
            ->values();

        return response()->json([
            'status' => 'success',
            'data' => [
                'agents' => $agents,
                'fallback_seconds' => $fallbackSeconds,
            ],
        ]);
    }

    /** Users that may be added to a pool (holders of make_softphone_calls, or all active users for fallback). */
    public function eligibleAgents(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $companyId = (int) company()->id;
        $isFallback = $request->input('scope') === 'fallback' || $request->input('fallback') == '1';

        $users = $isFallback
            ? SoftphoneCallPoolAgent::eligibleFallbackUsersForCompany($companyId)
            : SoftphoneCallPoolAgent::eligibleUsersForCompany($companyId);

        $permissionId = Permission::query()->where('name', 'make_softphone_calls')->value('id');
        $permissionUsers = $permissionId ? UserPermission::query()
            ->whereIn('user_id', $users->pluck('id'))
            ->where('permission_id', $permissionId)
            ->whereIn('permission_type_id', [PermissionType::ALL, PermissionType::ADDED])
            ->pluck('user_id')
            ->flip()
            ->toArray() : [];

        return response()->json([
            'status' => 'success',
            'data' => [
                'users' => $users->map(fn($user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'has_permission' => isset($permissionUsers[$user->id]),
                ])->values(),
            ],
        ]);
    }

    /**
     * Add an agent to a line call pool or the admin fallback list.
     */
    public function store(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        if ($request->has('incoming_call_fallback_seconds') && ! $request->has('user_id')) {
            $validated = $request->validate([
                'incoming_call_fallback_seconds' => 'required|integer|min:1|max:600',
            ]);
            $seconds = (int) $validated['incoming_call_fallback_seconds'];
            $companyId = (int) company()->id;

            Company::query()
                ->whereKey($companyId)
                ->update(['incoming_call_fallback_seconds' => $seconds]);

            if (session()->has('company')) {
                $cached = session('company');
                $cached->incoming_call_fallback_seconds = $seconds;
                session(['company' => $cached]);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Call rotation timing updated.',
                'data' => ['fallback_seconds' => $seconds],
            ]);
        }

        $companyId = (int) company()->id;
        $isFallback = $request->input('scope') === 'fallback'
            || $request->input('device_id') === 'fallback';

        if ($isFallback) {
            $validated = $request->validate([
                'user_id' => 'required|integer|min:1',
                'priority' => 'nullable|integer|min:1|max:100',
                'active' => 'sometimes|boolean',
            ]);

            $userId = (int) $validated['user_id'];
            $user = \App\Models\User::find($userId);
            abort_unless($user !== null && (int) $user->company_id === $companyId, 404);
            abort_unless(
                SoftphoneCallPoolAgent::eligibleFallbackUsersForCompany($companyId)->contains('id', $userId),
                422,
                'User is not eligible for the fallback list.'
            );

            return DB::transaction(function () use ($companyId, $userId, $validated) {
                Company::query()->whereKey($companyId)->lockForUpdate()->first();

                $explicitPriority = isset($validated['priority']) && is_numeric($validated['priority'])
                    ? (int) $validated['priority']
                    : null;
                $priority = $explicitPriority ?? $this->nextAvailablePriority($companyId, null, $userId);

                $duplicate = SoftphoneCallPoolAgent::query()
                    ->where('company_id', $companyId)
                    ->whereNull('device_id')
                    ->where('user_id', '!=', $userId)
                    ->where('priority', $priority)
                    ->exists();

                if ($duplicate) {
                    return response()->json([
                        'status' => 'fail',
                        'message' => "Priority {$priority} is already assigned to another agent in the fallback list. Each agent must have a unique priority from 1 to 100.",
                    ], 422);
                }

                $agent = SoftphoneCallPoolAgent::updateOrCreate(
                    [
                        'company_id' => $companyId,
                        'device_id' => null,
                        'user_id' => $userId,
                    ],
                    [
                        'priority' => $priority,
                        'active' => $validated['active'] ?? true,
                        'last_updated_by' => (int) user()->id,
                    ],
                );

                return response()->json([
                    'status' => 'success',
                    'message' => 'User added to admin fallback list.',
                    'data' => ['id' => $agent->id],
                ]);
            });
        }

        $validated = $request->validate([
            'device_id' => 'required|integer|min:1',
            'user_id' => 'required|integer|min:1',
            'priority' => 'nullable|integer|min:1|max:100',
            'active' => 'sometimes|boolean',
        ]);

        $deviceId = (int) $validated['device_id'];
        $this->assertDeviceBelongsToCompany($deviceId);

        $userId = (int) $validated['user_id'];
        $user = \App\Models\User::find($userId);
        abort_unless($user !== null && (int) $user->company_id === $companyId, 404);

        $this->ensureSoftphonePermission($userId);

        return DB::transaction(function () use ($companyId, $deviceId, $userId, $validated) {
            Company::query()->whereKey($companyId)->lockForUpdate()->first();

            $explicitPriority = isset($validated['priority']) && is_numeric($validated['priority'])
                ? (int) $validated['priority']
                : null;
            $priority = $explicitPriority ?? $this->nextAvailablePriority($companyId, $deviceId, $userId);

            $duplicate = SoftphoneCallPoolAgent::query()
                ->where('company_id', $companyId)
                ->where('device_id', $deviceId)
                ->where('user_id', '!=', $userId)
                ->where('priority', $priority)
                ->exists();

            if ($duplicate) {
                return response()->json([
                    'status' => 'fail',
                    'message' => "Priority {$priority} is already assigned to another agent on this line. Each agent must have a unique priority from 1 to 100.",
                ], 422);
            }

            $agent = SoftphoneCallPoolAgent::updateOrCreate(
                [
                    'device_id' => $deviceId,
                    'user_id' => $userId,
                ],
                [
                    'company_id' => $companyId,
                    'priority' => $priority,
                    'active' => $validated['active'] ?? true,
                    'last_updated_by' => (int) user()->id,
                ],
            );

            return response()->json([
                'status' => 'success',
                'message' => 'Agent added to the line pool.',
                'data' => ['id' => $agent->id],
            ]);
        });
    }

    /**
     * Update a pool agent's priority or active status.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $agent = SoftphoneCallPoolAgent::findOrFail($id);
        abort_unless((int) $agent->company_id === (int) company()->id, 404);

        $validated = $request->validate([
            'priority' => 'sometimes|integer|min:1|max:100',
            'active' => 'sometimes|boolean',
        ]);

        return DB::transaction(function () use ($agent, $validated) {
            Company::query()->whereKey((int) $agent->company_id)->lockForUpdate()->first();

            if (array_key_exists('priority', $validated)) {
                if ($validated['priority'] === null || ! is_numeric($validated['priority'])) {
                    return response()->json([
                        'status' => 'fail',
                        'message' => 'Priority cannot be null. Each agent must have a unique priority from 1 to 100.',
                    ], 422);
                }

                $priority = (int) $validated['priority'];

                $query = SoftphoneCallPoolAgent::query()
                    ->where('company_id', (int) $agent->company_id)
                    ->where('id', '!=', $agent->id)
                    ->where('priority', $priority);

                if ($agent->device_id !== null) {
                    $query->where('device_id', $agent->device_id);
                } else {
                    $query->whereNull('device_id');
                }

                if ($query->exists()) {
                    return response()->json([
                        'status' => 'fail',
                        'message' => "Priority {$priority} is already assigned to another agent in this pool. Each agent must have a unique priority from 1 to 100.",
                    ], 422);
                }

                $agent->priority = $priority;
            }
            if (array_key_exists('active', $validated)) {
                $agent->active = $validated['active'];
            }
            $agent->last_updated_by = (int) user()->id;
            $agent->save();

            return response()->json([
                'status' => 'success',
                'message' => 'Pool agent updated.',
                'data' => ['id' => $agent->id],
            ]);
        });
    }

    /**
     * Remove an agent from a call pool.
     */
    public function destroy(int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $agent = SoftphoneCallPoolAgent::findOrFail($id);
        abort_unless((int) $agent->company_id === (int) company()->id, 404);

        $agent->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Removed successfully.',
        ]);
    }

    /**
     * Grant or revoke the softphone calls permission for an agent.
     */
    public function togglePermission(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $validated = $request->validate([
            'user_id' => 'required|integer|min:1',
            'enabled' => 'required|boolean',
        ]);

        $userId = (int) $validated['user_id'];
        $user = User::query()->where('company_id', company()->id)->findOrFail($userId);
        $enabled = (bool) $validated['enabled'];

        $permission = Permission::query()->where('name', 'make_softphone_calls')->first();
        if (! $permission) {
            $permission = Permission::firstOrCreate(
                ['name' => 'make_softphone_calls'],
                [
                    'display_name' => 'Make Softphone Calls',
                    'is_custom' => 1,
                    'allowed_permissions' => Permission::ALL_ADDED_NONE,
                ]
            );
        }

        UserPermission::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'permission_id' => $permission->id,
            ],
            [
                'permission_type_id' => $enabled ? PermissionType::ALL : PermissionType::NONE,
            ]
        );

        return response()->json([
            'status' => 'success',
            'message' => $enabled
                ? "Softphone permission granted to {$user->name}."
                : "Softphone permission removed from {$user->name}.",
            'data' => [
                'user_id' => $user->id,
                'has_permission' => $enabled,
            ],
        ]);
    }

    /**
     * Automatically ensure user holds make_softphone_calls permission.
     */
    private function ensureSoftphonePermission(int $userId): void
    {
        $permission = Permission::query()->where('name', 'make_softphone_calls')->first();
        if ($permission) {
            UserPermission::query()->updateOrCreate(
                [
                    'user_id' => $userId,
                    'permission_id' => $permission->id,
                ],
                [
                    'permission_type_id' => PermissionType::ALL,
                ]
            );
        }
    }

    private function assertDeviceBelongsToCompany(int $deviceId): SoftphoneDevice
    {
        $device = SoftphoneDevice::find($deviceId);
        abort_unless($device !== null, 404);
        abort_unless((int) $device->company_id === (int) company()->id, 404);

        return $device;
    }

    private function assertSoftphoneEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('crm.softphone'), 404);
    }

    /** Admin-only, consistent with how call/agent configuration is treated. */
    private function assertCanManage(): void
    {
        abort_unless(user() !== null && user()->hasRole('admin'), 403);
    }
}
