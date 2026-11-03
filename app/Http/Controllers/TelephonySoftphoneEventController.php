<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\SoftphoneCallPoolAgent;
use App\Models\Lead;
use App\Models\User;
use App\Services\CallBridge\CallBridgeService;
use App\Services\CallBridge\LeadPhoneMatcher;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TelephonySoftphoneEventController extends AccountBaseController
{
    public function __construct(
        private readonly CallBridgeService $callBridge,
        private readonly LeadPhoneMatcher $leadMatcher,
    ) {
        parent::__construct();
    }


    public function leadByPhone(Request $request): JsonResponse
    {
        if (! user()->hasRole('admin') && ! in_array(user()->permission('make_softphone_calls'), ['all', 'added'])) {
            // Incoming matching is still available to anyone who can view leads;
            // callers without softphone permission get an explicit 403.
            abort_403(true);
        }

        $request->validate([
            'phone' => 'required|string|max:100',
            'device_id' => 'nullable|integer|min:1',
            'call_id' => 'nullable|string|max:100',
        ]);
        $incoming = preg_replace('/[^0-9]/', '', $request->input('phone') ?? '');
        $callId = $request->input('call_id');

        if ($incoming === '') {
            return response()->json(['status' => 'success', 'data' => null]);
        }

        $companyId = (int) company()->id;
        $deviceId = $this->ringingDeviceId();

        $passedUserIds = $this->passedUserIdsForCall($companyId, $deviceId, $incoming, $callId);

        // Routing (match count, owner, rotation) is derived from every matching
        // lead so it is identical for all viewers; the viewer's own access only
        // decides whether the lead's identity is revealed (see below).
        $matchingLeads = $this->leadMatcher->findLeads($companyId, $incoming)->values();
        $matchCount = $matchingLeads->count();

        // 1. Line pool: active agents explicitly registered on the ringing line, ordered by priority
        $poolAgents = SoftphoneCallPoolAgent::query()
            ->where('company_id', $companyId)
            ->where('active', true)
            ->whereNotIn('user_id', SoftphoneCallPoolAgent::adminUserIds($companyId))
            ->when($deviceId !== null, fn ($q) => $q->where('device_id', $deviceId), fn ($q) => $q->whereNotNull('device_id'))
            ->with(['user' => fn ($q) => $q->select('id', 'name', 'status', 'login')])
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            ->filter(function (SoftphoneCallPoolAgent $agent): bool {
                $u = $agent->user;

                return $u !== null
                    && (($u->status ?? 'active') === 'active')
                    && (($u->login ?? 'enable') !== 'disable');
            })
            ->unique('user_id')
            ->values();

        $poolUsers = $poolAgents
            ->map(fn (SoftphoneCallPoolAgent $agent): array => [
                'id' => (int) $agent->user_id,
                'name' => trim((string) ($agent->user?->name ?? '')) ?: ('User #' . $agent->user_id),
                'role' => 'pool',
                'priority' => (int) $agent->priority,
            ])
            ->values()
            ->all();

        $poolUserIds = array_map(fn (array $u): int => $u['id'], $poolUsers);

        // 2. Admin fallback list: configured fallback users (where device_id is null)
        $fallbackAgents = SoftphoneCallPoolAgent::query()
            ->where('company_id', $companyId)
            ->where('active', true)
            ->whereNull('device_id')
            ->with(['user' => fn ($q) => $q->select('id', 'name', 'status', 'login')])
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            ->filter(function (SoftphoneCallPoolAgent $agent): bool {
                $u = $agent->user;

                return $u !== null
                    && (($u->status ?? 'active') === 'active')
                    && (($u->login ?? 'enable') !== 'disable');
            })
            ->unique('user_id')
            ->values();

        if ($fallbackAgents->isNotEmpty()) {
            $fallbackUsers = $fallbackAgents
                ->map(fn (SoftphoneCallPoolAgent $agent): array => [
                    'id' => (int) $agent->user_id,
                    'name' => trim((string) ($agent->user?->name ?? '')) ?: ('User #' . $agent->user_id),
                    'role' => 'fallback',
                    'priority' => (int) $agent->priority,
                ])
                ->values()
                ->all();
        } else {
            // Default: active admins
            $adminUsers = User::query()
                ->where('company_id', $companyId)
                ->where('status', 'active')
                ->where('login', '!=', 'disable')
                ->whereExists(function ($q): void {
                    $q->select(DB::raw(1))
                        ->from('role_user')
                        ->join('roles', 'roles.id', '=', 'role_user.role_id')
                        ->whereColumn('role_user.user_id', 'users.id')
                        ->where('roles.name', 'admin');
                })
                ->orderBy('id')
                ->get(['id', 'name']);

            $fallbackUsers = $adminUsers
                ->map(fn ($u): array => [
                    'id' => (int) $u->id,
                    'name' => trim((string) $u->name) ?: ('Admin #' . $u->id),
                    'role' => 'fallback',
                    'priority' => 999,
                ])
                ->values()
                ->all();
        }

        $fallbackSeconds = (int) (\App\Models\Company::query()->whereKey($companyId)->value('incoming_call_fallback_seconds') ?? company()->incoming_call_fallback_seconds ?? 20);

        // Helper to build rotation array in strict priority: owner -> line agents -> fallback agents
        $buildRotation = function (?int $ownerId, ?string $ownerName, array $lineUsers, array $fallbackList): array {
            $result = [];
            $seen = [];

            if ($ownerId !== null) {
                $result[] = [
                    'id' => $ownerId,
                    'name' => $ownerName,
                    'role' => 'owner',
                ];
                $seen[$ownerId] = true;
            }

            foreach ($lineUsers as $u) {
                if (! isset($seen[$u['id']])) {
                    $result[] = $u;
                    $seen[$u['id']] = true;
                }
            }

            foreach ($fallbackList as $f) {
                if (! isset($seen[$f['id']])) {
                    $result[] = $f;
                    $seen[$f['id']] = true;
                }
            }

            return $result;
        };

        if ($matchCount !== 1) {
            $rotationUsers = $buildRotation(null, null, $poolUsers, $fallbackUsers);
            $rotationUserIds = array_map(fn (array $u): int => (int) $u['id'], $rotationUsers);
            if ($rotationUserIds !== [] && empty(array_diff($rotationUserIds, $passedUserIds))) {
                $this->clearPassedUsers($companyId, $deviceId, $incoming, $callId);
                $passedUserIds = [];
            }
            $canRing = in_array((int) user()->id, array_column($rotationUsers, 'id'), true)
                || ($rotationUsers === [] && user()->hasRole('admin'));

            return response()->json([
                'status' => 'success',
                'data' => [
                    'id' => null,
                    'lead_id' => null,
                    'name' => null,
                    'url' => null,
                    'owner_id' => null,
                    'owner_name' => null,
                    'matched' => false,
                    'match_count' => $matchCount,
                    'route' => 'pool',
                    'can_ring' => $canRing,
                    'pool_user_ids' => $poolUserIds,
                    'rotation_users' => $rotationUsers,
                    'passed_user_ids' => $passedUserIds,
                    'fallback_seconds' => $fallbackSeconds,
                    'current_user_id' => user()->id,
                ],
            ]);
        }

        /** @var Lead $lead */
        $lead = $matchingLeads->first();
        $canViewLead = (bool) (PermissionService::checkAccess(user(), 'view_lead', $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ])['canAccess'] ?? false);
        $rawOwnerId = $lead->lead_owner ? (int) $lead->lead_owner : null;
        $owner = $rawOwnerId
            ? User::query()
                ->where('company_id', $companyId)
                ->find($rawOwnerId)
            : null;
        $isActiveOwner = $owner !== null
            && (($owner->status ?? 'active') === 'active')
            && (($owner->login ?? 'enable') !== 'disable');
        $ownerId = $isActiveOwner ? (int) $owner->id : null;
        $ownerName = $isActiveOwner
            ? (trim((string) ($owner->name ?? '')) ?: ('User #' . $owner->id))
            : null;

        $rotationUsers = $buildRotation($ownerId, $ownerName, $poolUsers, $fallbackUsers);
        $rotationUserIds = array_map(fn (array $u): int => (int) $u['id'], $rotationUsers);
        if ($rotationUserIds !== [] && empty(array_diff($rotationUserIds, $passedUserIds))) {
            $this->clearPassedUsers($companyId, $deviceId, $incoming, $callId);
            $passedUserIds = [];
        }
        $leadName = trim((string) ($lead->client_name ?? $lead->client_name_salutation ?? ''));
        $canRing = in_array((int) user()->id, array_column($rotationUsers, 'id'), true)
            || ($rotationUsers === [] && user()->hasRole('admin'));

        return response()->json([
            'status' => 'success',
            'data' => [
                // Identity is only revealed to viewers who may open the lead.
                'id' => $canViewLead ? $lead->id : null,
                'lead_id' => $canViewLead ? $lead->id : null,
                'name' => $canViewLead
                    ? ($leadName !== '' ? $leadName : ('Lead #' . $lead->id))
                    : null,
                'url' => $canViewLead ? route('lead-contact.show', $lead->id) : null,
                'matched' => true,
                'match_count' => 1,
                'owner_id' => $ownerId,
                'owner_name' => $ownerName,
                'route' => ($ownerId !== null) ? 'owner' : 'pool',
                'can_ring' => $canRing,
                'pool_user_ids' => $poolUserIds,
                'rotation_users' => $rotationUsers,
                'passed_user_ids' => $passedUserIds,
                'fallback_seconds' => $fallbackSeconds,
                'current_user_id' => user()->id,
            ],
        ]);
    }

    /**
     * Record that the current user declined/passed an incoming call so the
     * rotation immediately advances to the next active user.
     */
    public function passCall(Request $request): JsonResponse
    {
        abort_403(
            ! user()->hasRole('admin')
            && ! in_array(user()->permission('make_softphone_calls'), ['all', 'added'], true)
        );

        $request->validate([
            'phone' => 'required|string|max:100',
            'device_id' => 'nullable|integer|min:1',
            'call_id' => 'nullable|string|max:100',
        ]);

        $incoming = preg_replace('/[^0-9]/', '', $request->input('phone') ?? '');
        $callId = $request->input('call_id');
        if ($incoming !== '' || ($callId !== null && trim($callId) !== '')) {
            $this->recordPassedUser(
                (int) company()->id,
                $this->ringingDeviceId(),
                $incoming,
                (int) user()->id,
                $callId
            );
        }

        return response()->json(['status' => 'success']);
    }

    private function passCallIdCacheKey(int $companyId, string $callId): string
    {
        return sprintf('softphone:call_pass:id:%d:%s', $companyId, trim($callId));
    }

    private function passCacheKey(int $companyId, ?int $deviceId, string $incoming): string
    {
        return sprintf('softphone:call_pass:%d:%d:%s', $companyId, $deviceId ?? 0, $incoming);
    }

    /**
     * @return array<int, int>
     */
    private function passedUserIdsForCall(int $companyId, ?int $deviceId, string $incoming, ?string $callId = null): array
    {
        if ($callId !== null && trim($callId) !== '') {
            $cached = Cache::get($this->passCallIdCacheKey($companyId, trim($callId)));
            if (is_array($cached)) {
                return array_values(array_unique(array_map('intval', $cached)));
            }
        }

        $cached = Cache::get($this->passCacheKey($companyId, $deviceId, $incoming));
        if (! is_array($cached)) {
            return [];
        }

        return array_values(array_unique(array_map('intval', $cached)));
    }

    private function recordPassedUser(int $companyId, ?int $deviceId, string $incoming, int $userId, ?string $callId = null): void
    {
        if ($callId !== null && trim($callId) !== '') {
            $key = $this->passCallIdCacheKey($companyId, trim($callId));
            $current = Cache::get($key);
            $current = is_array($current) ? array_values(array_unique(array_map('intval', $current))) : [];
            if (! in_array($userId, $current, true)) {
                $current[] = $userId;
            }
            Cache::put($key, $current, now()->addSeconds(90));
        }

        if ($incoming !== '') {
            $key = $this->passCacheKey($companyId, $deviceId, $incoming);
            $current = Cache::get($key);
            $current = is_array($current) ? array_values(array_unique(array_map('intval', $current))) : [];
            if (! in_array($userId, $current, true)) {
                $current[] = $userId;
            }
            Cache::put($key, $current, now()->addSeconds(90));
        }
    }

    private function clearPassedUsers(int $companyId, ?int $deviceId, string $incoming, ?string $callId = null): void
    {
        if ($callId !== null && trim($callId) !== '') {
            Cache::forget($this->passCallIdCacheKey($companyId, trim($callId)));
        }
        if ($incoming !== '') {
            Cache::forget($this->passCacheKey($companyId, $deviceId, $incoming));
            if ($deviceId !== null) {
                Cache::forget($this->passCacheKey($companyId, null, $incoming));
            }
        }
    }

    /**
     * The line the call arrived on, sent by the browser (it knows which device
     * its SIP session is registered on). Null lets every active pool agent of
     * the company ring, which is the pre-per-line behaviour.
     */
    private function ringingDeviceId(): ?int
    {
        $deviceId = request()->input('device_id');

        if (! is_numeric($deviceId) || (int) $deviceId <= 0) {
            return null;
        }

        $device = \App\Models\SoftphoneDevice::find((int) $deviceId);
        if ($device === null || (int) $device->company_id !== (int) company()->id) {
            return null;
        }

        return (int) $device->id;
    }

    public function store(Request $request): JsonResponse
    {
        abort_403(
            ! user()->hasRole('admin')
            && ! in_array(user()->permission('make_softphone_calls'), ['all', 'added'], true)
        );

        $validated = $request->validate([
            'phone' => 'required|string|max:50',
            'call_id' => 'nullable|string|max:100',
            'entity_type' => 'required|string|in:lead,deal',
            'entity_id' => 'required|integer|min:1',
            'device_id' => 'nullable|integer|min:1',
            'event' => 'nullable|string|max:80',
            'direction' => 'nullable|string|in:inbound,outbound,incoming,outgoing',
            'status' => 'nullable|string|max:40',
            'duration' => 'nullable|integer|min:0',
            'call_ref' => 'nullable|string|max:64',
            // Why a dial attempt never connected (softphone failure code) and
            // the agent-facing sentence, so the timeline can explain it.
            'failure_reason' => 'nullable|string|max:80',
            'failure_message' => 'nullable|string|max:255',
            // Inbound call forwarding metadata (when the call rotated past an earlier user).
            'routing_reason' => 'nullable|string|max:40',
            'is_forwarded' => 'nullable|boolean',
            'forwarded_from_user_id' => 'nullable|integer|min:1',
            'forwarded_from_user_name' => 'nullable|string|max:180',
        ]);

        $entityType = $validated['entity_type'];
        $entityId = (int) $validated['entity_id'];

        if ($entityType === 'lead') {
            $lead = Lead::findOrFail($entityId);
            abort_if((int) $lead->company_id !== (int) company()->id, 404);
            $access = PermissionService::checkAccess(user(), 'view_lead', $lead, [
                'added' => 'added_by',
                'owned' => 'lead_owner',
            ]);
            abort_unless($access['canAccess'], 403);
        } else {
            $deal = Deal::findOrFail($entityId);
            abort_if((int) $deal->company_id !== (int) company()->id, 404);
            $access = PermissionService::checkAccess(user(), 'view_deals', $deal, [
                'added' => 'added_by',
                'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
            ]);
            abort_unless($access['canAccess'], 403);
        }

        $incomingDigits = preg_replace('/[^0-9]/', '', $validated['phone']) ?? '';
        $callId = $validated['call_id'] ?? null;
        if (in_array($validated['direction'] ?? null, ['inbound', 'incoming'], true)) {
            $this->clearPassedUsers((int) company()->id, $this->ringingDeviceId(), $incomingDigits, $callId);
        }

        $isForwarded = (bool) ($validated['is_forwarded'] ?? false);
        $forwardedUserId = null;
        $forwardedUserName = null;

        if ($isForwarded && ! empty($validated['forwarded_from_user_id'])) {
            $forwardedUser = User::query()
                ->where('company_id', company()->id)
                ->find((int) $validated['forwarded_from_user_id']);

            if ($forwardedUser) {
                $forwardedUserId = (int) $forwardedUser->id;
                $forwardedUserName = (string) $forwardedUser->name;
            } else {
                $isForwarded = false;
            }
        } else {
            $isForwarded = false;
        }

        try {
            $this->callBridge->logCallEvent([
                'event' => $validated['event'] ?? 'call.started',
                'direction' => $validated['direction'] ?? 'outbound',
                'status' => $validated['status'] ?? null,
                'duration' => $validated['duration'] ?? null,
                'call_ref' => $validated['call_ref'] ?? null,
                'failure_reason' => $validated['failure_reason'] ?? null,
                'failure_message' => $validated['failure_message'] ?? null,
                'routing_reason' => $validated['routing_reason'] ?? null,
                'is_forwarded' => $isForwarded ?: null,
                'forwarded_from_user_id' => $forwardedUserId,
                'forwarded_from_user_name' => $forwardedUserName,
                'phone_number' => $validated['phone'],
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'user_id' => (int) user()->id,
                'company_id' => (int) company()->id,
                'occurred_at' => now(),
            ]);
            // Emit the call event to the OL call bridge so it records the
            // call happening on its side. This is best-effort — a failure
            // here must not block the call that already started or the
            // softphone UI response.
            try {
                $emitDirection = $validated['direction'] ?? 'outbound';
                $emitEvent = $validated['event'] ?? 'call.started';
                if (! in_array($emitEvent, ['call.started', 'call.ended', 'call.missed', 'call.declined', 'call.busy', 'call.failed', 'call_declined', 'call_voicemail', 'call_busy', 'call_failed'], true)) {
                    $emitEvent = 'call.started';
                }
                $this->callBridge->emitCallEvent([
                    'event' => $emitEvent,
                    'call_id' => $validated['call_ref'] ?? null,
                    'direction' => $emitDirection,
                    'phone_number' => $validated['phone'],
                    'status' => $validated['status'] ?? null,
                ]);
            } catch (\Throwable $e) {
                // Emit failure must not block the call logging path.
                Log::warning('TelephonySoftphoneEventController: failed to emit call event to OL', [
                    'error' => $e->getMessage(),
                    'event' => $validated['event'] ?? null,
                    'call_ref' => $validated['call_ref'] ?? null,
                ]);
            }
        } catch (\Throwable $e) {
            // Logging must not block the call that already started.
        }

        return response()->json(['status' => 'success']);
    }
}
