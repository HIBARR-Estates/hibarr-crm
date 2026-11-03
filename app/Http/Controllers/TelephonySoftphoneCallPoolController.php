<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\SoftphoneCallPoolAgent;
use App\Models\SoftphoneDevice;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $agents = SoftphoneCallPoolAgent::query()
            ->where('company_id', $companyId)
            ->where('device_id', $deviceId)
            // Admins bypass the line pool, so they are hidden from the line list
            ->whereNotIn('user_id', SoftphoneCallPoolAgent::adminUserIds($companyId))
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

    /** Users that may be added to a pool (holders of make_softphone_calls, or all active users for fallback). */
    public function eligibleAgents(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();

        $companyId = (int) company()->id;
        $isFallback = $request->input('scope') === 'fallback' || $request->input('fallback') == '1';

        $users = $isFallback
            ? SoftphoneCallPoolAgent::eligibleFallbackUsersForCompany($companyId)
            : SoftphoneCallPoolAgent::eligibleUsersForCompany($companyId);

        return response()->json([
            'status' => 'success',
            'data' => [
                'users' => $users->map(fn($user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ])->values(),
            ],
        ]);
    }

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
            || ! $request->filled('device_id')
            || (int) $request->input('device_id') === 0;

        if ($isFallback) {
            $validated = $request->validate([
                'user_id' => 'required|integer|min:1',
                'priority' => 'nullable|integer|min:0|max:1000',
                'active' => 'sometimes|boolean',
            ]);

            $userId = (int) $validated['user_id'];
            $user = \App\Models\User::find($userId);
            abort_unless($user !== null && (int) $user->company_id === $companyId, 404);

            $agent = SoftphoneCallPoolAgent::updateOrCreate(
                [
                    'company_id' => $companyId,
                    'device_id' => null,
                    'user_id' => $userId,
                ],
                [
                    'priority' => $validated['priority'] ?? 100,
                    'active' => $validated['active'] ?? true,
                    'last_updated_by' => (int) user()->id,
                ],
            );

            return response()->json([
                'status' => 'success',
                'message' => 'User added to admin fallback list.',
                'data' => ['id' => $agent->id],
            ]);
        }

        $validated = $request->validate([
            'device_id' => 'required|integer|min:1',
            'user_id' => 'required|integer|min:1',
            'priority' => 'nullable|integer|min:0|max:1000',
            'active' => 'sometimes|boolean',
        ]);

        $deviceId = (int) $validated['device_id'];
        $this->assertDeviceBelongsToCompany($deviceId);

        $userId = (int) $validated['user_id'];
        $user = \App\Models\User::find($userId);
        abort_unless($user !== null && (int) $user->company_id === $companyId, 404);
        abort_if($user->hasRole('admin'), 422, 'Admins cannot be added to a line call pool.');

        $agent = SoftphoneCallPoolAgent::updateOrCreate(
            [
                'device_id' => $deviceId,
                'user_id' => $userId,
            ],
            [
                'company_id' => $companyId,
                'priority' => $validated['priority'] ?? 100,
                'active' => $validated['active'] ?? true,
                'last_updated_by' => (int) user()->id,
            ],
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Agent added to the line pool.',
            'data' => ['id' => $agent->id],
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $agent = SoftphoneCallPoolAgent::findOrFail($id);
        abort_unless((int) $agent->company_id === (int) company()->id, 404);

        $validated = $request->validate([
            'priority' => 'nullable|integer|min:0|max:1000',
            'active' => 'sometimes|boolean',
        ]);

        if (array_key_exists('priority', $validated)) {
            $agent->priority = $validated['priority'];
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
    }

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
