<?php

namespace App\Http\Controllers;

use App\Models\CrmEvent;
use App\Models\CrmEventType;
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


    /**
     * Match an incoming caller's phone number to a lead and return routing details.
     */
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
            'call_ref' => 'nullable|string|max:100',
        ]);
        $incoming = preg_replace('/[^0-9]/', '', $request->input('phone') ?? '');
        $callId = $request->input('call_id');
        $callRef = $request->input('call_ref');

        if ($incoming === '') {
            return response()->json(['status' => 'success', 'data' => null]);
        }

        $companyId = (int) company()->id;
        $deviceId = $this->ringingDeviceId();

        $authoritativeCallKey = $this->isAuthoritativeCallId($callId)
            ? $callId
            : ($this->isAuthoritativeCallId($callRef) ? $callRef : null);

        $passedUserIds = $this->passedUserIdsForCall($companyId, $deviceId, $incoming, $callId);
        $callStatus = $this->getCallStatus($companyId, $authoritativeCallKey);
        $statusVal = $callStatus['status'] ?? null;
        $answeredByUserId = isset($callStatus['user_id']) ? (int) $callStatus['user_id'] : null;

        // Routing (match count, owner, rotation) is derived from every matching
        // lead so it is identical for all viewers; the viewer's own access only
        // decides whether the lead's identity is revealed (see below).
        $matchingLeads = $this->leadMatcher->findLeads($companyId, $incoming)->values();
        $matchCount = $matchingLeads->count();

        // Emit an incoming_call event to the call bridge (OL) once per incoming call
        $emitCallKey = $authoritativeCallKey ?? $callId ?? $callRef;
        if (! empty($emitCallKey)) {
            $emitLockKey = sprintf('softphone:inbound_emitted:%d:%s', $companyId, trim((string) $emitCallKey));
            if (Cache::add($emitLockKey, 1, 120)) {
                try {
                    $firstLead = $matchingLeads->first();
                    $emitPayload = [
                        'event' => 'incoming_call',
                        'call_id' => trim((string) $emitCallKey),
                        'direction' => 'inbound',
                        'phone_number' => $request->input('phone'),
                        'status' => 'ringing',
                    ];
                    if ($firstLead) {
                        $emitPayload['entity_type'] = 'lead';
                        $emitPayload['entity_id'] = (int) $firstLead->id;
                    }
                    $this->callBridge->emitCallEvent($emitPayload);
                } catch (\Throwable $e) {
                    Log::warning('TelephonySoftphoneEventController: failed to emit incoming_call event to OL', [
                        'error' => $e->getMessage(),
                        'call_id' => $emitCallKey,
                        'phone' => $request->input('phone'),
                    ]);
                }
            }
        }

        // 1. Line pool: active agents explicitly registered on the ringing line, ordered by priority
        $poolAgents = SoftphoneCallPoolAgent::query()
            ->where('company_id', $companyId)
            ->where('active', true)
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
                    'call_status' => $statusVal,
                    'answered_by_user_id' => $answeredByUserId,
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
                'call_status' => $statusVal,
                'answered_by_user_id' => $answeredByUserId,
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
            'call_ref' => 'nullable|string|max:100',
        ]);

        $incoming = preg_replace('/[^0-9]/', '', $request->input('phone') ?? '');
        $callId = $request->input('call_id');
        $callRef = $request->input('call_ref');
        $companyId = (int) company()->id;
        $passingUserId = (int) user()->id;
        $passingUserName = (string) user()->name;

        if ($incoming !== '' || ($callId !== null && trim($callId) !== '')) {
            $this->recordPassedUser(
                $companyId,
                $this->ringingDeviceId(),
                $incoming,
                $passingUserId,
                $callId
            );
        }

        // Persist a durable, trusted server-side forwarding transition keyed to the call
        $declinedTypeId = CrmEventType::withoutGlobalScopes()
            ->where(fn ($q) => $q->whereNull('company_id')->orWhere('company_id', $companyId))
            ->where('slug', 'call_declined')
            ->value('id');

        if ($declinedTypeId) {
            try {
                CrmEvent::withoutGlobalScopes()->create([
                    'uuid' => (string) \Illuminate\Support\Str::uuid(),
                    'company_id' => $companyId,
                    'event_type_id' => $declinedTypeId,
                    'generation_type' => \App\Enums\CrmEventGenerationType::SYSTEM_GENERATED,
                    'source' => \App\Enums\CrmEventSource::API,
                    'direction' => \App\Enums\CrmEventDirection::INBOUND,
                    'status' => \App\Enums\CrmEventStatus::COMPLETED,
                    'user_id' => $passingUserId,
                    'metadata' => array_filter([
                        'call_id' => $callId,
                        'call_ref' => $callRef,
                        'phone_number' => $request->input('phone'),
                        'is_forwarded' => true,
                        'forwarded_from_user_id' => $passingUserId,
                        'forwarded_from_user_name' => $passingUserName,
                        'action' => 'pass',
                    ], fn ($v) => $v !== null && $v !== ''),
                    'occurred_at' => now(),
                ]);
            } catch (\Throwable) {
                // Best-effort transition persistence
            }
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * Cache key for users who passed a call identified by a call ID.
     */
    private function passCallIdCacheKey(int $companyId, string $callId): string
    {
        return sprintf('softphone:call_pass:id:%d:%s', $companyId, trim($callId));
    }

    /**
     * Cache key for users who passed a call identified by device and phone.
     */
    private function passCacheKey(int $companyId, ?int $deviceId, string $incoming): string
    {
        return sprintf('softphone:call_pass:%d:%d:%s', $companyId, $deviceId ?? 0, $incoming);
    }

    /**
     * Fetch user IDs that have passed or declined this call.
     *
     * @return array<int, int>
     */
    private function passedUserIdsForCall(int $companyId, ?int $deviceId, string $incoming, ?string $callId = null): array
    {
        if ($callId !== null && trim($callId) !== '') {
            $cached = Cache::get($this->passCallIdCacheKey($companyId, trim($callId)));
            if (is_array($cached)) {
                return array_values(array_unique(array_map('intval', $cached)));
            }

            return [];
        }

        $cached = Cache::get($this->passCacheKey($companyId, $deviceId, $incoming));
        if (! is_array($cached)) {
            return [];
        }

        return array_values(array_unique(array_map('intval', $cached)));
    }

    /**
     * Record that a user passed an incoming call.
     */
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
            return;
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

    /**
     * Clear passed user state for a call upon answer or termination.
     */
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
     * Determine whether an identifier is an authoritative, call-specific token across agents.
     */
    private function isAuthoritativeCallId(?string $callId): bool
    {
        if ($callId === null) {
            return false;
        }

        $trimmed = trim($callId);
        if ($trimmed === '' || preg_match('/^call-\d+$/', $trimmed)) {
            return false;
        }

        return true;
    }

    /**
     * Record the authoritative status of an active call using a call-specific identifier.
     */
    private function recordCallStatus(int $companyId, ?string $callId, string $status, int $userId): void
    {
        if (! $this->isAuthoritativeCallId($callId)) {
            return;
        }

        $payload = [
            'call_id' => trim($callId),
            'status' => $status,
            'user_id' => $userId,
            'updated_at' => now()->timestamp,
        ];

        Cache::put(sprintf('softphone:call_status:id:%d:%s', $companyId, trim($callId)), $payload, 300);
    }

    /**
     * Retrieve the authoritative call status when correlated through an authoritative call identifier.
     */
    private function getCallStatus(int $companyId, ?string $callId): ?array
    {
        if (! $this->isAuthoritativeCallId($callId)) {
            return null;
        }

        $status = Cache::get(sprintf('softphone:call_status:id:%d:%s', $companyId, trim($callId)));
        if (is_array($status) && isset($status['status'])) {
            return $status;
        }

        return null;
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

    /**
     * Persist a softphone timeline event (e.g. call.started, call.ended) and update call bridge.
     */
    public function store(Request $request): JsonResponse
    {
        abort_403(
            ! user()->hasRole('admin')
            && ! in_array(user()->permission('make_softphone_calls'), ['all', 'added'], true)
        );

        $validated = $request->validate([
            'phone' => 'required|string|max:50',
            'call_id' => 'nullable|string|max:100',
            // Optional for inbound calls: the server matches the number itself
            // (see below), so a call answered by an agent who cannot view the
            // lead, or from a number that matches no lead, is still logged.
            'entity_type' => 'nullable|string|in:lead,deal|required_with:entity_id',
            'entity_id' => 'nullable|integer|min:1|required_with:entity_type',
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
            'recording_status' => 'nullable|string|max:40',
            'recording_error' => 'nullable|string|max:255',
            // Inbound call forwarding metadata (when the call rotated past an earlier user).
            'routing_reason' => 'nullable|string|max:40',
            'is_forwarded' => 'nullable|boolean',
            'forwarded_from_user_id' => 'nullable|integer|min:1',
            'forwarded_from_user_name' => 'nullable|string|max:180',
        ]);

        $isInbound = in_array($validated['direction'] ?? null, ['inbound', 'incoming'], true);
        $entityType = $validated['entity_type'] ?? null;
        $entityId = isset($validated['entity_id']) ? (int) $validated['entity_id'] : null;

        if ($entityType !== null && $entityId !== null) {
            $viewable = $this->canViewEntity($entityType, $entityId);

            if ($viewable === null) {
                // The record is gone or belongs to another company (deleted
                // between the dock's match and this log, or a bad id). Inbound
                // calls drop the pointer and re-match the number below, so the
                // call is still logged; an outbound call has no fallback.
                abort_unless($isInbound, 404);
                $entityType = null;
                $entityId = null;
            } elseif (! $viewable) {
                // An inbound call reaches whoever is on the line, who may not be
                // allowed to see the caller's lead. Drop the client's pointer and
                // match the number below instead, so the call still lands on the
                // lead without revealing it. Outbound calls are placed from a
                // record the agent opened, so a hidden one there is refused.
                abort_unless($isInbound, 403);
                $entityType = null;
                $entityId = null;
            }
        }

        if ($entityType === null && $isInbound) {
            $matches = $this->leadMatcher->findLeads((int) company()->id, (string) $validated['phone']);
            // Only an unambiguous match is linked; several leads sharing a
            // number stay unlinked rather than guessing.
            if ($matches->count() === 1) {
                $entityType = 'lead';
                $entityId = (int) $matches->first()->id;
            }
        }

        $incomingDigits = preg_replace('/[^0-9]/', '', $validated['phone']) ?? '';
        $callId = $validated['call_id'] ?? null;
        $callRef = $validated['call_ref'] ?? null;
        $authoritativeKey = $this->isAuthoritativeCallId($callId)
            ? $callId
            : ($this->isAuthoritativeCallId($callRef) ? $callRef : null);

        $companyId = (int) company()->id;
        if (in_array($validated['direction'] ?? null, ['inbound', 'incoming'], true)) {
            $eventSlug = $validated['event'] ?? 'call.started';
            if ($eventSlug === 'call.started') {
                $this->clearPassedUsers($companyId, $this->ringingDeviceId(), $incomingDigits, $callId);
                $this->recordCallStatus($companyId, $authoritativeKey, 'answered', (int) user()->id);
            } elseif (in_array($eventSlug, ['call.ended', 'call.completed', 'call.failed', 'call.declined'], true)) {
                $this->recordCallStatus($companyId, $authoritativeKey, 'ended', (int) user()->id);
            }
        }

        $callRef = $validated['call_ref'] ?? null;
        $isForwarded = false;
        $forwardedUserId = null;
        $forwardedUserName = null;

        // Derive forwarding attribution only from a durable, trusted server-side forwarding transition
        // keyed to this call, never from untrusted request body data.
        if ($callId || $callRef) {
            $transition = CrmEvent::withoutGlobalScopes()
                ->where('company_id', (int) company()->id)
                ->where(function ($q) use ($callId, $callRef) {
                    if ($callId) {
                        $q->where('metadata->call_id', $callId);
                    }
                    if ($callRef) {
                        $callId ? $q->orWhere('metadata->call_ref', $callRef) : $q->where('metadata->call_ref', $callRef);
                    }
                })
                ->where('metadata->is_forwarded', true)
                ->whereNotNull('metadata->forwarded_from_user_id')
                ->latest('id')
                ->first();

            if ($transition) {
                $meta = is_array($transition->metadata) ? $transition->metadata : [];
                $candidateId = (int) ($meta['forwarded_from_user_id'] ?? 0);
                $forwardedUser = User::query()
                    ->where('company_id', (int) company()->id)
                    ->find($candidateId);

                if ($forwardedUser) {
                    $isForwarded = true;
                    $forwardedUserId = (int) $forwardedUser->id;
                    $forwardedUserName = (string) $forwardedUser->name;
                }
            }
        }

        if (! empty($validated['recording_status']) && $validated['recording_status'] === 'failed') {
            Log::warning('Softphone: recording failure reported from client', [
                'call_ref' => $validated['call_ref'] ?? null,
                'user_id' => (int) user()->id,
                'error' => $validated['recording_error'] ?? null,
            ]);

            if (! empty($validated['call_ref'])) {
                $events = \App\Models\CrmEvent::withoutGlobalScopes()
                    ->where('company_id', (int) company()->id)
                    ->where('metadata->call_ref', $validated['call_ref'])
                    ->whereNull('metadata->recording_id')
                    ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', (int) user()->id))
                    ->get();

                foreach ($events as $event) {
                    $meta = is_array($event->metadata) ? $event->metadata : [];
                    $meta['recording_status'] = 'failed';
                    $meta['recording_error'] = $validated['recording_error'] ?? 'Upload failed';
                    $event->forceFill(['metadata' => $meta])->save();
                }
            }

            if (($validated['event'] ?? null) === 'call.recording_failed') {
                return response()->json(['status' => 'success']);
            }
        }

        try {
            $this->callBridge->logCallEvent([
                'event' => $validated['event'] ?? 'call.started',
                'call_id' => $validated['call_id'] ?? null,
                'direction' => $validated['direction'] ?? 'outbound',
                'status' => $validated['status'] ?? null,
                'duration' => $validated['duration'] ?? null,
                'call_ref' => $validated['call_ref'] ?? null,
                'failure_reason' => $validated['failure_reason'] ?? null,
                'failure_message' => $validated['failure_message'] ?? null,
                'recording_status' => $validated['recording_status'] ?? null,
                'recording_error' => $validated['recording_error'] ?? null,
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
                // Softphone calls are logged even with no lead or deal, so the
                // Calls page shows calls from unknown numbers too.
                'log_unlinked' => true,
            ]);
            // The recording upload can finish before this event is written
            // (it often beats "call ended"); link it now so the order of the
            // two never decides whether the lead shows the recording.
            if (! empty($validated['call_ref'])) {
                app(\App\Services\CallRecording\CallRecordingLinker::class)->linkExisting(
                    (string) $validated['call_ref'],
                    (int) company()->id,
                    (int) user()->id,
                );
            }
            // Emit the call event to the OL call bridge so it records the
            // call happening on its side. This is best-effort — a failure
            // here must not block the call that already started or the
            // softphone UI response.
            try {
                $emitDirection = $validated['direction'] ?? 'outbound';
                $emitEvent = $validated['event'] ?? 'call.started';
                if (! in_array($emitEvent, ['call.started', 'call.answered', 'call_answered', 'incoming_call', 'outgoing_call', 'call.ended', 'call_ended', 'call.missed', 'call_missed', 'call.declined', 'call_declined', 'call.busy', 'call_busy', 'call.failed', 'call_failed', 'call_voicemail'], true)) {
                    $emitEvent = ($emitDirection === 'inbound') ? 'incoming_call' : 'call.started';
                }
                $emitPayload = [
                    'event' => $emitEvent,
                    'call_id' => $validated['call_id'] ?? $validated['call_ref'] ?? null,
                    'direction' => $emitDirection,
                    'phone_number' => $validated['phone'],
                    'status' => $validated['status'] ?? null,
                ];
                if (! empty($entityType) && ! empty($entityId)) {
                    $emitPayload['entity_type'] = $entityType;
                    $emitPayload['entity_id'] = $entityId;
                }
                $this->callBridge->emitCallEvent($emitPayload);
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
            Log::warning('TelephonySoftphoneEventController: failed to log call event', [
                'error' => $e->getMessage(),
                'event' => $validated['event'] ?? null,
                'call_id' => $validated['call_id'] ?? null,
            ]);
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * Whether the current user may view the lead or deal: true/false, or null
     * when it does not exist in this company (so callers can fall back).
     */
    private function canViewEntity(string $entityType, int $entityId): ?bool
    {
        if ($entityType === 'lead') {
            $lead = Lead::find($entityId);
            if ($lead === null || (int) $lead->company_id !== (int) company()->id) {
                return null;
            }

            return (bool) PermissionService::checkAccess(user(), 'view_lead', $lead, [
                'added' => 'added_by',
                'owned' => 'lead_owner',
            ])['canAccess'];
        }

        $deal = Deal::find($entityId);
        if ($deal === null || (int) $deal->company_id !== (int) company()->id) {
            return null;
        }

        return (bool) PermissionService::checkAccess(user(), 'view_deals', $deal, [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ])['canAccess'];
    }
}
