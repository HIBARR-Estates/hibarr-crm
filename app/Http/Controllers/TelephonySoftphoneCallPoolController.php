<?php

namespace App\Http\Controllers;

use App\Models\SoftphoneCallPoolAgent;
use App\Models\SoftphoneDevice;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Per-line incoming call pool.
 *
 * Each sipgate channel (softphone line) has its own pool of agents that can be
 * routed a call when the lead's owner does not answer within the company's
 * fallback window. Membership is managed per line: one row per
 * (device_id, user_id).
 *
 * Reads are open to any company user behind the shared.softphone flag so the
 * dock can resolve the ring list. Writes are admin-only.
 */
class TelephonySoftphoneCallPoolController extends AccountBaseController
{
    /** Pool members for one line. */
    public function index(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();

        $deviceId = (int) $request->input('device_id', 0);
        $this->assertDeviceBelongsToCompany($deviceId);

        $agents = SoftphoneCallPoolAgent::query()
            ->where('device_id', $deviceId)
            // Admins bypass the pool entirely, so they are hidden from the list
            // even if an earlier seed added them.
            ->whereNotIn('user_id', SoftphoneCallPoolAgent::adminUserIds((int) company()->id))
            ->with('user:id,name,email')
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            ->map(fn (SoftphoneCallPoolAgent $agent) => [
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
            'data' => ['agents' => $agents],
        ]);
    }

    /** Users that may be added to a pool (holders of make_softphone_calls). */
    public function eligibleAgents(): JsonResponse
    {
        $this->assertSoftphoneEnabled();

        return response()->json([
            'status' => 'success',
            'data' => [
                'users' => SoftphoneCallPoolAgent::eligibleUsersForCompany(
                    (int) company()->id
                )->map(fn ($user) => [
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
        abort_unless($user !== null && (int) $user->company_id === (int) company()->id, 404);
        // Admins bypass the pool, so they cannot be queued as agents.
        abort_if($user->hasRole('admin'), 422, 'Admins cannot be added to a call pool.');

        $agent = SoftphoneCallPoolAgent::updateOrCreate(
            [
                'device_id' => $deviceId,
                'user_id' => $userId,
            ],
            [
                'company_id' => (int) company()->id,
                'priority' => $validated['priority'] ?? 100,
                'active' => $validated['active'] ?? true,
                'last_updated_by' => (int) user()->id,
            ],
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Agent added to the pool.',
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
            'message' => 'Agent removed from the pool.',
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
        abort_unless(FeatureFlags::enabled('shared.softphone'), 404);
    }

    /** Admin-only, consistent with how call/agent configuration is treated. */
    private function assertCanManage(): void
    {
        abort_unless(user() !== null && user()->hasRole('admin'), 403);
    }
}
