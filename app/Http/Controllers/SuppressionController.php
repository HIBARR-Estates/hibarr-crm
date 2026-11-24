<?php

namespace App\Http\Controllers;

use App\Enums\CrmEventSource;
use App\Models\Deal;
use App\Models\DealHistory;
use App\Models\Lead;
use App\Models\User;
use App\Services\CrmEventService;
use App\Services\Suppression\SuppressionClient;
use App\Services\Suppression\SuppressionManagementClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * Session-authenticated CRM proxy & permission gate for OL's Release 2
 * suppression endpoints (HIB-1901, SUP-D11, SUP-D13).
 */
class SuppressionController extends Controller
{
    private const CHANNELS = ['email', 'whatsapp', 'sms', 'telegram', 'instagram', 'call'];

    private const SCOPES = ['non_transactional', 'transactional', 'all'];

    private const RECIPIENT_OPT_OUT_SOURCES = ['unsubscribe_link', 'preference_page', 'stop_keyword'];

    private const RESTRICTED_REASONS = ['complained', 'do_not_call'];

    public function __construct(
        private readonly SuppressionManagementClient $client,
        private readonly CrmEventService $events,
    ) {}

    public function entityRestrictions(Request $request, string $entityType, int $entityId): JsonResponse
    {
        $user = $this->requireUser($request);
        $this->resolveScopedRecord($entityType, $entityId, $user);

        $permissions = $this->resolvePermissions($user);
        $upstream = $this->client->getEntityRestrictions($entityType, $entityId, $user);

        return $this->formatRestrictionsResponse($upstream, $permissions);
    }

    public function handleRestrictions(Request $request): JsonResponse
    {
        $user = $this->requireUser($request);

        $validated = $request->validate([
            'handle' => ['required', 'string', 'max:255'],
            'channel' => ['nullable', Rule::in(self::CHANNELS)],
        ]);

        $permissions = $this->resolvePermissions($user);
        $upstream = $this->client->getHandleRestrictions(
            $validated['handle'],
            $validated['channel'] ?? null,
            $user
        );

        return $this->formatRestrictionsResponse($upstream, $permissions);
    }

    public function block(Request $request): JsonResponse
    {
        $user = $this->requireUser($request);
        $permissions = $this->resolvePermissions($user);

        if (! $permissions['canBlock']) {
            return response()->json([
                'message' => 'You do not have permission to block contacts.',
            ], 403);
        }

        $validated = $request->validate([
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'entityType' => ['nullable', Rule::in(['lead', 'deal'])],
            'entityId' => ['nullable', 'integer', 'min:1'],
            'channels' => ['required', 'array', 'min:1'],
            'channels.*' => ['required', Rule::in(self::CHANNELS)],
            'scope' => ['required', Rule::in(self::SCOPES)],
            'reason' => ['required', 'string', 'min:1', 'max:120'],
            'note' => ['nullable', 'string', 'max:2000'],
            'applyToFutureDetails' => ['nullable', 'boolean'],
        ]);

        $hasTargetHandle = ! empty($validated['email']) || ! empty($validated['phone']);
        $hasTargetEntity = ! empty($validated['entityType']) && ! empty($validated['entityId']);

        if (! $hasTargetHandle && ! $hasTargetEntity) {
            return response()->json([
                'message' => 'Provide an email, phone number, or lead/deal record to block.',
            ], 422);
        }

        $record = null;
        if ($hasTargetEntity) {
            $record = $this->resolveScopedRecord(
                (string) $validated['entityType'],
                (int) $validated['entityId'],
                $user
            );
        }

        $payload = [
            'channels' => array_values(array_unique($validated['channels'])),
            'scope' => $validated['scope'],
            'reason' => trim($validated['reason']),
        ];

        if (! empty($validated['email'])) {
            $payload['email'] = trim($validated['email']);
        }
        if (! empty($validated['phone'])) {
            $payload['phone'] = trim($validated['phone']);
        }
        if ($hasTargetEntity) {
            $payload['entityType'] = $validated['entityType'];
            $payload['entityId'] = (int) $validated['entityId'];
            $payload['applyToFutureDetails'] = (bool) ($validated['applyToFutureDetails'] ?? false);
        }
        if (isset($validated['note']) && trim((string) $validated['note']) !== '') {
            $payload['note'] = trim((string) $validated['note']);
        }

        $result = $this->client->block($payload, $user);

        if (! $result['ok']) {
            return response()->json([
                'message' => $result['message'],
            ], $result['status'] >= 400 ? $result['status'] : 502);
        }

        if ($record !== null && $hasTargetEntity) {
            $this->recordActivity(
                entityType: (string) $validated['entityType'],
                entityId: (int) $validated['entityId'],
                user: $user,
                action: 'suppression_blocked',
                details: [
                    'channels' => $payload['channels'],
                    'scope' => $payload['scope'],
                    'reason' => $payload['reason'],
                    'apply_to_future_details' => (bool) ($payload['applyToFutureDetails'] ?? false),
                ]
            );
        }

        return response()->json([
            'message' => $result['message'],
            'data' => $result['data'],
        ], 201);
    }

    public function lift(Request $request, string $uuid): JsonResponse
    {
        $user = $this->requireUser($request);
        $permissions = $this->resolvePermissions($user);

        if (! $permissions['canLift']) {
            return response()->json([
                'message' => 'You do not have permission to lift suppression blocks.',
            ], 403);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:1', 'max:2000'],
            'note' => ['nullable', 'string', 'max:2000'],
            'consentEvidence' => ['nullable', 'array'],
            'consentEvidence.text' => ['nullable', 'string', 'max:4000'],
            'entityType' => ['nullable', Rule::in(['lead', 'deal'])],
            'entityId' => ['nullable', 'integer', 'min:1'],
            'entryChannel' => ['nullable', Rule::in(self::CHANNELS)],
            'entryReason' => ['nullable', 'string', 'max:120'],
            'entrySource' => ['nullable', 'string', 'max:120'],
        ]);

        $record = null;
        if (! empty($validated['entityType']) && ! empty($validated['entityId'])) {
            $record = $this->resolveScopedRecord(
                (string) $validated['entityType'],
                (int) $validated['entityId'],
                $user
            );
        }

        $entryMeta = $this->resolveEntryMetadata($uuid, $validated, $user);

        $isRecipientOptOut = in_array($entryMeta['source'], self::RECIPIENT_OPT_OUT_SOURCES, true);
        $isRestricted = $isRecipientOptOut
            || in_array($entryMeta['reason'], self::RESTRICTED_REASONS, true)
            || $entryMeta['channel'] === 'call';

        $consentText = trim((string) ($validated['consentEvidence']['text'] ?? ''));

        if ($isRecipientOptOut && $consentText === '') {
            return response()->json([
                'message' => 'Consent evidence is required to lift a recipient opt-out.',
            ], 422);
        }

        if ($isRestricted && ! $permissions['canLiftRestricted']) {
            return response()->json([
                'message' => 'Elevated permission is required to lift this suppression entry.',
            ], 403);
        }

        $payload = [
            'reason' => trim($validated['reason']),
        ];

        if (isset($validated['note']) && trim((string) $validated['note']) !== '') {
            $payload['note'] = trim((string) $validated['note']);
        }
        if ($consentText !== '') {
            $payload['consentEvidence'] = ['text' => $consentText];
        }

        $result = $this->client->lift($uuid, $payload, $user);

        if (! $result['ok']) {
            return response()->json([
                'message' => $result['message'],
            ], $result['status'] >= 400 ? $result['status'] : 502);
        }

        if ($record !== null && ! empty($validated['entityType']) && ! empty($validated['entityId'])) {
            $this->recordActivity(
                entityType: (string) $validated['entityType'],
                entityId: (int) $validated['entityId'],
                user: $user,
                action: 'suppression_lifted',
                details: [
                    'suppression_uuid' => $uuid,
                    'channel' => $entryMeta['channel'],
                    'reason' => $payload['reason'],
                ]
            );
        }

        return response()->json([
            'message' => $result['message'],
            'data' => $result['data'],
        ]);
    }

    /**
     * @param  array{unavailable: bool, restrictions: array<int, array<string, mixed>>}  $upstream
     * @param  array{canViewDetails: bool, canBlock: bool, canLift: bool, canLiftRestricted: bool, canViewFull: bool}  $permissions
     */
    private function formatRestrictionsResponse(array $upstream, array $permissions): JsonResponse
    {
        if ($upstream['unavailable']) {
            return response()->json([
                'unavailable' => true,
                'canViewDetails' => $permissions['canViewDetails'],
                'restrictions' => [],
                'blockedChannels' => [],
            ]);
        }

        $raw = $upstream['restrictions'];
        $blockedChannels = array_values(array_map(fn (array $entry) => [
            'channel' => $entry['channel'] ?? 'email',
            'scope' => $entry['scope'] ?? 'non_transactional',
            'applyToFutureDetails' => (bool) ($entry['applyToFutureDetails'] ?? false),
            'email' => ! empty($entry['email']) ? $this->ensureMaskedEmail((string) $entry['email']) : null,
            'phone' => ! empty($entry['phone']) ? $this->ensureMaskedPhone((string) $entry['phone']) : null,
        ], $raw));

        if (! $permissions['canViewDetails']) {
            // Users without view_suppression_restrictions receive no reason,
            // source, author, date, or unmasked contact details — only what is
            // needed to disable blocked contact actions.
            return response()->json([
                'unavailable' => false,
                'canViewDetails' => false,
                'restrictions' => [],
                'blockedChannels' => $blockedChannels,
            ]);
        }

        $restrictions = array_values(array_map(function (array $entry) use ($permissions): array {
            if (! $permissions['canViewFull']) {
                if (! empty($entry['email'])) {
                    $entry['email'] = $this->ensureMaskedEmail((string) $entry['email']);
                }
                if (! empty($entry['phone'])) {
                    $entry['phone'] = $this->ensureMaskedPhone((string) $entry['phone']);
                }
            }

            return $entry;
        }, $raw));

        return response()->json([
            'unavailable' => false,
            'canViewDetails' => true,
            'restrictions' => $restrictions,
            'blockedChannels' => $blockedChannels,
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{channel: ?string, reason: ?string, source: ?string}
     */
    private function resolveEntryMetadata(string $uuid, array $validated, User $user): array
    {
        if (! empty($validated['entityType']) && ! empty($validated['entityId'])) {
            $lookup = $this->client->getEntityRestrictions(
                (string) $validated['entityType'],
                (int) $validated['entityId'],
                $user
            );

            if (! $lookup['unavailable']) {
                foreach ($lookup['restrictions'] as $entry) {
                    if (($entry['uuid'] ?? null) === $uuid) {
                        return [
                            'channel' => isset($entry['channel']) ? (string) $entry['channel'] : null,
                            'reason' => isset($entry['reason']) ? (string) $entry['reason'] : null,
                            'source' => isset($entry['source']) ? (string) $entry['source'] : null,
                        ];
                    }
                }
            }
        }

        return [
            'channel' => isset($validated['entryChannel']) ? (string) $validated['entryChannel'] : null,
            'reason' => isset($validated['entryReason']) ? (string) $validated['entryReason'] : null,
            'source' => isset($validated['entrySource']) ? (string) $validated['entrySource'] : null,
        ];
    }

    private function requireUser(Request $request): User
    {
        $user = $request->user();
        abort_if(! $user instanceof User, 401);

        return $user;
    }

    private function resolveScopedRecord(string $entityType, int $entityId, User $user): Lead|Deal
    {
        $companyId = $user->company_id;

        if ($entityType === 'lead') {
            $query = Lead::query()->whereKey($entityId);
            if ($companyId !== null) {
                $query->where('company_id', $companyId);
            }
            $lead = $query->first();
            abort_if($lead === null, 404);

            return $lead;
        }

        $query = Deal::query()->whereKey($entityId);
        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }
        $deal = $query->first();
        abort_if($deal === null, 404);

        return $deal;
    }

    /**
     * @return array{canViewDetails: bool, canBlock: bool, canLift: bool, canLiftRestricted: bool, canViewFull: bool}
     */
    private function resolvePermissions(User $user): array
    {
        return [
            'canViewDetails' => $this->hasPermission($user, 'view_suppression_restrictions'),
            'canBlock' => $this->hasPermission($user, 'block_suppressions'),
            'canLift' => $this->hasPermission($user, 'lift_suppressions'),
            'canLiftRestricted' => $this->hasPermission($user, 'lift_restricted_suppressions'),
            'canViewFull' => $this->hasPermission($user, 'view_full_suppression_details'),
        ];
    }

    private function hasPermission(User $user, string $permission): bool
    {
        $granted = $user->permission($permission);

        return $granted !== false && $granted !== 'none' && $granted !== 5;
    }

    private function ensureMaskedEmail(string $value): string
    {
        return str_contains($value, '***') ? $value : SuppressionClient::maskEmail($value);
    }

    private function ensureMaskedPhone(string $value): string
    {
        return str_contains($value, '***') ? $value : SuppressionClient::maskPhone($value);
    }

    /**
     * @param  array<string, mixed>  $details
     */
    private function recordActivity(
        string $entityType,
        int $entityId,
        User $user,
        string $action,
        array $details
    ): void {
        try {
            if ($entityType === 'deal') {
                DealHistory::create([
                    'deal_id' => $entityId,
                    'event_type' => $action === 'suppression_blocked' ? 'suppression-blocked' : 'suppression-lifted',
                    'created_by' => $user->id,
                ]);
            }

            $companyId = $user->company_id;
            if ($companyId === null) {
                return;
            }

            $this->events->record([
                'event_type_slug' => $entityType === 'deal' ? 'deal_updated' : 'lead_updated',
                'company_id' => $companyId,
                'user_id' => $user->id,
                'model_type' => $entityType === 'deal' ? Deal::class : Lead::class,
                'model_id' => $entityId,
                'source' => CrmEventSource::CONTROLLER->value,
                'metadata' => array_merge($details, [
                    'suppression_action' => $action,
                    'actor_user_id' => $user->id,
                    'actor_name' => $user->name,
                ]),
            ], true);
        } catch (\Throwable $exception) {
            Log::warning('SuppressionController: failed to write timeline activity.', [
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'action' => $action,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
