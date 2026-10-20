<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\SoftphoneCallPoolAgent;
use App\Models\Lead;
use App\Services\CallBridge\CallBridgeService;
use App\Services\CallBridge\LeadPhoneMatcher;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        if (! in_array(user()->permission('make_softphone_calls'), ['all'])) {
            // Incoming matching is still available to anyone who can view leads;
            // callers without softphone permission get an explicit 403.
            abort_403(true);
        }

        $request->validate([
            'phone' => 'required|string|max:100',
            'device_id' => 'nullable|integer|min:1',
        ]);
        $incoming = preg_replace('/[^0-9]/', '', $request->input('phone') ?? '');

        if ($incoming === '') {
            return response()->json(['status' => 'success', 'data' => null]);
        }

        $lead = $this->leadMatcher->findLead((int) company()->id, $incoming);

        // Pool is per line: only agents registered on the line that is ringing
        // should be offered the call. Rows without a line (legacy backfill that
        // could not resolve a default device) stay company-wide.
        $poolUserIds = SoftphoneCallPoolAgent::query()
            ->where('company_id', company()->id)
            ->where('active', true)
            ->where(function ($query): void {
                $query->whereNull('device_id');
                if ($this->ringingDeviceId() !== null) {
                    $query->orWhere('device_id', $this->ringingDeviceId());
                }
            })
            ->orderBy('priority')
            ->pluck('user_id')
            ->all();
        $fallbackSeconds = company()->incoming_call_fallback_seconds ?? 20;

        if (! $lead) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'id' => null,
                'lead_id' => null,
                    'name' => null,
                    'url' => null,
                    'owner_id' => null,
                    'matched' => false,
                    'route' => 'pool',
                    'can_ring' => true,
                    'pool_user_ids' => $poolUserIds,
                    'fallback_seconds' => $fallbackSeconds,
                    'current_user_id' => user()->id,
                ],
            ]);
        }

        $access = PermissionService::checkAccess(user(), 'view_lead', $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);

        if (! ($access['canAccess'] ?? false)) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'id' => $lead->id,
                    'lead_id' => $lead->id,
                    'name' => null,
                    'url' => null,
                    'matched' => false,
                    'owner_id' => null,
                    'route' => 'pool',
                    'can_ring' => false,
                    'pool_user_ids' => $poolUserIds,
                    'fallback_seconds' => $fallbackSeconds,
                    'current_user_id' => user()->id,
                ],
            ]);
        }

        $ownerId = $lead->lead_owner ?: null;

        return response()->json([
            'status' => 'success',
            'data' => [
                'id' => $lead->id,
                'lead_id' => $lead->id,
                'name' => $lead->client_name ?? $lead->client_name_salutation,
                'url' => route('lead-contact.show', $lead->id),
                'matched' => true,
                'owner_id' => $ownerId,
                'route' => ($ownerId !== null) ? 'owner' : 'pool',
                'can_ring' => user()->hasRole('admin')
                    || $ownerId === user()->id
                    || in_array(user()->id, $poolUserIds, true),
                'pool_user_ids' => $poolUserIds,
                'fallback_seconds' => $fallbackSeconds,
                'current_user_id' => user()->id,
            ],
        ]);
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
        abort_403(! in_array(user()->permission('make_softphone_calls'), ['all']));

        $validated = $request->validate([
            'phone' => 'required|string|max:50',
            'entity_type' => 'required|string|in:lead,deal',
            'entity_id' => 'required|integer|min:1',
            'event' => 'nullable|string|max:80',
            'direction' => 'nullable|string|in:inbound,outbound,incoming,outgoing',
            'status' => 'nullable|string|max:40',
            'duration' => 'nullable|integer|min:0',
            'call_ref' => 'nullable|string|max:64',
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

        try {
            $this->callBridge->logCallEvent([
                'event' => $validated['event'] ?? 'call.started',
                'direction' => $validated['direction'] ?? 'outbound',
                'status' => $validated['status'] ?? null,
                'duration' => $validated['duration'] ?? null,
                'call_ref' => $validated['call_ref'] ?? null,
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
                if (! in_array($emitEvent, ['call.started', 'call.ended', 'call.missed', 'call_declined', 'call_voicemail', 'call_busy', 'call_failed'], true)) {
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
