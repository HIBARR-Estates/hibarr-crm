<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\CrmEvent;
use App\Models\CrmEventType;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\SoftphoneCallPoolAgent;
use App\Models\SoftphoneDevice;
use App\Models\User;
use App\Services\CallBridge\CallBridgeService;
use App\Services\CallBridge\InboundCallRotation;
use App\Services\CallBridge\LeadPhoneMatcher;
use App\Services\CallBridge\LineConcurrencyManager;
use App\Services\PermissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class TelephonySoftphoneEventController extends AccountBaseController
{
    private const DEFAULT_FALLBACK_SECONDS = 20;

    private static ?bool $hasCanReceiveCallsColumn = null;

    private static function supportsCanReceiveCalls(): bool
    {
        if (self::$hasCanReceiveCallsColumn === null) {
            try {
                self::$hasCanReceiveCallsColumn = Schema::hasColumn('users', 'can_receive_calls');
            } catch (\Throwable) {
                self::$hasCanReceiveCallsColumn = false;
            }
        }

        return self::$hasCanReceiveCallsColumn;
    }

    public function __construct(
        private readonly CallBridgeService $callBridge,
        private readonly LeadPhoneMatcher $leadMatcher,
    ) {
        parent::__construct();
    }

    /**
     * Match an incoming caller's phone number to a lead and return routing details.
     *
     * Every agent on the line polls this while the call rings, so the routing
     * (owner, rotation order and position) must come out identical for all of
     * them; only the lead's identity depends on who is asking.
     */
    public function leadByPhone(Request $request): JsonResponse
    {
        abort_403(! $this->canUseSoftphone(user()));

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
        $line = $this->ringingDevice();
        $deviceId = $line?->id;

        $authoritativeCallKey = $this->isAuthoritativeCallId($callId)
            ? $callId
            : ($this->isAuthoritativeCallId($callRef) ? $callRef : null);

        $passedUserIds = $this->passedUserIdsForCall($companyId, $deviceId, $incoming, $callId);
        $callStatus = $this->getCallStatus($companyId, $authoritativeCallKey);
        $statusVal = $callStatus['status'] ?? null;

        $matchingLeads = $this->leadMatcher->findLeads($companyId, $incoming)->values();
        $company = Company::query()->whereKey($companyId)->first();
        $fallbackSeconds = (int) ($company?->incoming_call_fallback_seconds ?? self::DEFAULT_FALLBACK_SECONDS);

        $routing = [
            'id' => null,
            'lead_id' => null,
            'name' => null,
            'url' => null,
            'owner_id' => null,
            'owner_name' => null,
            'matched' => false,
            'match_count' => $matchingLeads->count(),
            'route' => 'pool',
            'can_ring' => false,
            'pool_user_ids' => [],
            'rotation_users' => [],
            'passed_user_ids' => $passedUserIds,
            'fallback_seconds' => $fallbackSeconds,
            'fallback_voice_message' => null,
            'user_can_receive_calls' => (bool) (user()->can_receive_calls ?? true),
            'current_user_id' => user()->id,
            'call_status' => $statusVal,
            'answered_by_user_id' => isset($callStatus['user_id']) ? (int) $callStatus['user_id'] : null,
        ];

        // A full line cannot carry another call, so nobody rings. Once someone
        // has answered, that call is one of the live ones and must not count
        // against itself for the agents still polling.
        if ($line !== null && $statusVal !== 'answered' && ! LineConcurrencyManager::hasCapacity($line)) {
            return response()->json([
                'status' => 'success',
                'data' => ['capacity_reached' => true] + $routing,
            ]);
        }

        $this->emitIncomingCallOnce($companyId, $authoritativeCallKey ?? $callId ?? $callRef, $request->input('phone'), $matchingLeads->first());

        $poolUsers = $this->getAvailableAgentsForTier($companyId, SoftphoneCallPoolAgent::TIER_LINE, $deviceId, 'pool');
        [$lead, $owner] = $this->resolveLeadAndOwner($matchingLeads, $companyId, $deviceId);

        $rotationUsers = $this->buildRotationSequence(
            $owner,
            $poolUsers,
            $this->getAvailableAgentsForTier($companyId, SoftphoneCallPoolAgent::TIER_DEFAULT_FALLBACK, null, 'default_fallback'),
            $this->getAvailableAdminFallbackUsers($companyId),
        );

        // Agents already on a call are skipped while anyone else can take it,
        // so their turn does not make the caller wait. Once this call is
        // answered the agent who took it is on a call too, so nobody counts as
        // busy from then on.
        $busyUserIds = $statusVal !== 'answered' ? LineConcurrencyManager::usersOnCall($companyId) : [];

        // With an id every agent shares, the order is frozen and the position
        // advances on the server, so all browsers agree on who rings now. The
        // whole roster is frozen, busy agents included, so they can still be
        // rung if everyone free has passed or timed out.
        $sharedCallKey = $this->sharedCallKey($callId);
        if ($sharedCallKey !== null) {
            $rotation = InboundCallRotation::resolve($companyId, $sharedCallKey, $rotationUsers, $passedUserIds, $fallbackSeconds, $busyUserIds);
            $rotationUsers = $rotation['users'];
            $routing['rotation_index'] = $rotation['index'];
            $routing['slot_remaining_seconds'] = $rotation['slot_remaining_seconds'];
        } else {
            $rotationUsers = $this->withoutBusyAgents($rotationUsers, $passedUserIds, $busyUserIds);
        }

        $ownerEntry = collect($rotationUsers)->firstWhere('role', 'owner');

        $routing = array_merge($routing, [
            'owner_id' => $ownerEntry['id'] ?? null,
            'owner_name' => $ownerEntry['name'] ?? null,
            'route' => $ownerEntry !== null ? 'owner' : 'pool',
            'can_ring' => in_array((int) user()->id, array_column($rotationUsers, 'id'), true),
            'pool_user_ids' => array_column($poolUsers, 'id'),
            'rotation_users' => $rotationUsers,
            'fallback_voice_message' => $this->resolveFallbackVoiceMessageConfig($company),
        ]);

        if ($lead !== null) {
            $routing['matched'] = true;

            // Identity is only revealed to viewers who may open the lead.
            $canViewLead = (bool) (PermissionService::checkAccess(user(), 'view_lead', $lead, [
                'added' => 'added_by',
                'owned' => 'lead_owner',
            ])['canAccess'] ?? false);

            if ($canViewLead) {
                $leadName = trim((string) ($lead->client_name ?? $lead->client_name_salutation ?? ''));
                $routing = array_merge($routing, [
                    'id' => $lead->id,
                    'lead_id' => $lead->id,
                    'name' => $leadName !== '' ? $leadName : ('Lead #' . $lead->id),
                    'url' => route('lead-contact.show', $lead->id),
                ]);
            }
        }

        return response()->json(['status' => 'success', 'data' => $routing]);
    }

    /**
     * The lead a call is about and, when they can take it, its owner.
     *
     * Tier 1 goes to the first matching lead whose owner can actually ring on
     * this line. With no such owner the first owned lead is still returned so
     * the caller is identified, and the call starts at the line pool.
     *
     * @param  Collection<int, Lead>  $matchingLeads
     * @return array{0: ?Lead, 1: ?User}
     */
    private function resolveLeadAndOwner(Collection $matchingLeads, int $companyId, ?int $deviceId): array
    {
        foreach ($matchingLeads as $lead) {
            if (empty($lead->lead_owner)) {
                continue;
            }

            $owner = User::query()->where('company_id', $companyId)->find((int) $lead->lead_owner);

            if ($owner !== null && $this->canRingOnLine($owner, $companyId, $deviceId)) {
                return [$lead, $owner];
            }
        }

        return [
            $matchingLeads->first(fn (Lead $lead) => ! empty($lead->lead_owner)) ?? $matchingLeads->first(),
            null,
        ];
    }

    /**
     * For a call without a shared id (no server-held rotation): the rotation
     * minus busy agents, unless no free agent who has not passed is left —
     * then the busy agents are the only ones the call can still go to.
     *
     * @param  array<int, array{id: int, name: string, role: string, priority?: int}>  $rotationUsers
     * @param  array<int, int>  $passedUserIds
     * @param  array<int, int>  $busyUserIds
     * @return array<int, array{id: int, name: string, role: string, priority?: int}>
     */
    private function withoutBusyAgents(array $rotationUsers, array $passedUserIds, array $busyUserIds): array
    {
        if ($busyUserIds === []) {
            return $rotationUsers;
        }

        $isBusy = fn (array $user): bool => in_array((int) $user['id'], $busyUserIds, true);
        $hasFreeUnpassed = collect($rotationUsers)->contains(
            fn (array $user): bool => ! $isBusy($user) && ! in_array((int) $user['id'], $passedUserIds, true),
        );

        return $hasFreeUnpassed
            ? array_values(array_filter($rotationUsers, fn (array $user): bool => ! $isBusy($user)))
            : $rotationUsers;
    }

    /** Admins and holders of make_softphone_calls can run the softphone. */
    private function canUseSoftphone(User $user): bool
    {
        return $user->hasRole('admin')
            || in_array($user->permission('make_softphone_calls'), ['all', 'added'], true);
    }

    /** Active, not paused, and allowed to run the softphone. */
    private function isAvailableForCalls(User $user): bool
    {
        return (($user->status ?? 'active') === 'active')
            && (($user->login ?? 'enable') !== 'disable')
            && ($user->can_receive_calls ?? true)
            && $this->canUseSoftphone($user);
    }

    /** Available, and able to register on the line the call arrived on. */
    private function canRingOnLine(User $user, int $companyId, ?int $deviceId): bool
    {
        if (! $this->isAvailableForCalls($user)) {
            return false;
        }

        if ($deviceId === null || $user->hasRole('admin')) {
            return true;
        }

        $allowedLines = SoftphoneCallPoolAgent::allowedDeviceIdsForUser($companyId, (int) $user->id);

        return $allowedLines === null || in_array($deviceId, $allowedLines, true);
    }

    /** Tell the call bridge (OL) about an incoming call, once per call. */
    private function emitIncomingCallOnce(int $companyId, ?string $callKey, ?string $phone, ?Lead $lead): void
    {
        $callKey = trim((string) $callKey);
        if ($callKey === '') {
            return;
        }

        if (! Cache::add(sprintf('softphone:inbound_emitted:%d:%s', $companyId, $callKey), 1, 120)) {
            return;
        }

        try {
            $payload = [
                'event' => 'incoming_call',
                'call_id' => $callKey,
                'direction' => 'inbound',
                'phone_number' => $phone,
                'status' => 'ringing',
            ];
            if ($lead !== null) {
                $payload['entity_type'] = 'lead';
                $payload['entity_id'] = (int) $lead->id;
            }
            $this->callBridge->emitCallEvent($payload);
        } catch (\Throwable $e) {
            Log::warning('TelephonySoftphoneEventController: failed to emit incoming_call event to OL', [
                'error' => $e->getMessage(),
                'call_id' => $callKey,
                'phone' => $phone,
            ]);
        }
    }

    /**
     * Record that the current user declined/passed an incoming call so the
     * rotation immediately advances to the next active user.
     */
    public function passCall(Request $request): JsonResponse
    {
        abort_403(! $this->canUseSoftphone(user()));

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

        $this->recordPassedUser($companyId, $this->ringingDeviceId(), $incoming, $passingUserId, $callId);

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
        $cached = Cache::get($this->passKeyForCall($companyId, $deviceId, $incoming, $callId));

        return is_array($cached) ? array_values(array_unique(array_map('intval', $cached))) : [];
    }

    /**
     * Where the passed list of a call lives: under its shared call id when it
     * has one, otherwise under the line and caller number. A browser-local id
     * ("call-3") means a different call in every browser, so it never keys
     * state that agents share.
     */
    private function passKeyForCall(int $companyId, ?int $deviceId, string $incoming, ?string $callId): string
    {
        $sharedCallKey = $this->sharedCallKey($callId);

        return $sharedCallKey !== null
            ? $this->passCallIdCacheKey($companyId, $sharedCallKey)
            : $this->passCacheKey($companyId, $deviceId, $incoming);
    }

    /**
     * Record that a user passed an incoming call.
     */
    private function recordPassedUser(int $companyId, ?int $deviceId, string $incoming, int $userId, ?string $callId = null): void
    {
        if ($incoming === '' && $this->sharedCallKey($callId) === null) {
            return;
        }

        $passed = $this->passedUserIdsForCall($companyId, $deviceId, $incoming, $callId);
        if (! in_array($userId, $passed, true)) {
            $passed[] = $userId;
        }

        // Outlives the longest rotation, so a passed agent is never rung again
        // for the same call.
        Cache::put($this->passKeyForCall($companyId, $deviceId, $incoming, $callId), $passed, InboundCallRotation::TTL_SECONDS);
    }

    /**
     * Clear passed user state for a call upon answer or termination.
     */
    private function clearPassedUsers(int $companyId, ?int $deviceId, string $incoming, ?string $callId = null): void
    {
        $sharedCallKey = $this->sharedCallKey($callId);
        if ($sharedCallKey !== null) {
            Cache::forget($this->passCallIdCacheKey($companyId, $sharedCallKey));
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

    /** The call's id when every agent's browser reports the same one, else null. */
    private function sharedCallKey(?string $callId): ?string
    {
        return $this->isAuthoritativeCallId($callId) ? trim((string) $callId) : null;
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
        return $this->ringingDevice()?->id;
    }

    /** The line named by the request, or null when it is not this company's. */
    private function ringingDevice(): ?SoftphoneDevice
    {
        $deviceId = request()->input('device_id');

        if (! is_numeric($deviceId) || (int) $deviceId <= 0) {
            return null;
        }

        $device = SoftphoneDevice::find((int) $deviceId);
        if ($device === null || (int) $device->company_id !== (int) company()->id) {
            return null;
        }

        return $device;
    }

    /**
     * Persist a softphone timeline event (e.g. call.started, call.ended) and update call bridge.
     */
    public function store(Request $request): JsonResponse
    {
        abort_403(! $this->canUseSoftphone(user()));

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
        if ($isInbound) {
            $eventSlug = $validated['event'] ?? 'call.started';
            if ($eventSlug === 'call.started') {
                // The answering agent now occupies one of the line's slots; the
                // dock frees it when the call ends (outbound calls take theirs
                // before dialling, see reserveCapacity).
                $line = $this->ringingDevice();
                if ($line !== null) {
                    LineConcurrencyManager::reserve($line, (int) user()->id, force: true);
                }
                $this->clearPassedUsers($companyId, $line?->id, $incomingDigits, $callId);
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
                $events = CrmEvent::withoutGlobalScopes()
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
                $callId = $validated['call_id'] ?? $validated['call_ref'] ?? null;
                if (empty($callId)) {
                    $callId = sprintf('call-%s-%d-%s', $emitDirection, now()->timestamp, \Illuminate\Support\Str::random(6));
                }
                $emitPayload = [
                    'event' => $emitEvent,
                    'call_id' => $callId,
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

    /**
     * Fetch active agents for a routing tier who are eligible and available to receive calls.
     *
     * @return array<int, array{id: int, name: string, role: string, priority: int}>
     */
    private function getAvailableAgentsForTier(int $companyId, string $tier, ?int $deviceId, string $role): array
    {
        $userSelect = ['id', 'name', 'status', 'login'];
        if (self::supportsCanReceiveCalls()) {
            $userSelect[] = 'can_receive_calls';
        }

        return SoftphoneCallPoolAgent::query()
            ->where('company_id', $companyId)
            ->where('active', true)
            ->where('tier', $tier)
            ->when($deviceId !== null, fn ($q) => $q->where('device_id', $deviceId))
            ->when($deviceId === null && $tier !== SoftphoneCallPoolAgent::TIER_LINE, fn ($q) => $q->whereNull('device_id'))
            ->with(['user' => fn ($q) => $q->select($userSelect)])
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            // A listed user who cannot run the softphone would be a silent
            // slot the caller waits through, so they are left out.
            ->filter(fn (SoftphoneCallPoolAgent $agent): bool => $agent->user !== null
                && $this->isAvailableForCalls($agent->user))
            ->unique('user_id')
            ->map(fn (SoftphoneCallPoolAgent $agent): array => [
                'id' => (int) $agent->user_id,
                'name' => trim((string) ($agent->user?->name ?? '')) ?: ('User #' . $agent->user_id),
                'role' => $role,
                'priority' => (int) $agent->priority,
            ])
            ->values()
            ->all();
    }

    /**
     * Resolve admin fallback tier users. Only users explicitly configured on the admin fallback tier list (and who hold the admin role) are returned.
     *
     * @return array<int, array{id: int, name: string, role: string, priority: int}>
     */
    private function getAvailableAdminFallbackUsers(int $companyId): array
    {
        $agents = $this->getAvailableAgentsForTier(
            $companyId,
            SoftphoneCallPoolAgent::TIER_ADMIN_FALLBACK,
            null,
            'admin_fallback'
        );

        $adminUserIds = SoftphoneCallPoolAgent::adminUserIds($companyId);

        return array_values(array_filter($agents, fn ($agent) => in_array((int) $agent['id'], $adminUserIds, true)));
    }

    /**
     * Assemble rotation sequence with strict priority: Lead Owner -> Line Pool -> Default Fallback -> Admin Fallback.
     *
     * @return array<int, array{id: int, name: string, role: string, priority?: int}>
     */
    private function buildRotationSequence(
        ?User $owner,
        array $lineUsers,
        array $defaultFallbackUsers,
        array $adminFallbackUsers
    ): array {
        $sequence = [];
        $seenUserIds = [];

        if ($owner !== null) {
            $ownerId = (int) $owner->id;
            $sequence[] = [
                'id' => $ownerId,
                'name' => trim((string) ($owner->name ?? '')) ?: "User #{$ownerId}",
                'role' => 'owner',
            ];
            $seenUserIds[$ownerId] = true;
        }

        foreach ([$lineUsers, $defaultFallbackUsers, $adminFallbackUsers] as $tierUsers) {
            foreach ($tierUsers as $candidate) {
                $candidateId = (int) $candidate['id'];
                if (! isset($seenUserIds[$candidateId])) {
                    $sequence[] = $candidate;
                    $seenUserIds[$candidateId] = true;
                }
            }
        }

        return $sequence;
    }

    /**
     * Resolve fallback voice message configuration for the company.
     *
     * @return array{enabled: bool, url: ?string, text: string, repeat_count: int}
     */
    private function resolveFallbackVoiceMessageConfig(?Company $company): array
    {
        $isFlagEnabled = FeatureFlags::enabled('softphone.voicemail');
        $isCompanyEnabled = (bool) ($company?->fallback_voice_message_enabled ?? false);

        return [
            'enabled' => $isFlagEnabled && $isCompanyEnabled,
            'url' => $company?->fallback_voice_message_url,
            'text' => $company?->fallback_voice_message_text ?? 'We are unable to take your call at this time. Please try again later.',
            'repeat_count' => (int) ($company?->fallback_voice_message_repeat_count ?? 1),
        ];
    }
}
