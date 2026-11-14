<?php

namespace App\Http\Controllers;

use App\Helper\Files;
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
use Illuminate\Support\Facades\Schema;

/**
 * Incoming call routing pool (per-line agent pools, default fallback tier, and admin fallback tier).
 *
 * Tier 1: Lead Owner (Direct route when incoming caller matches a CRM lead)
 * Tier 2: Line call pool (device_id, user_id)
 * Tier 2: Default fallback tier (tier = 'default_fallback', device_id = null)
 * Tier 3: Admin fallback tier (tier = 'admin_fallback', device_id = null)
 * Tier 4: Fallback voice message (behind softphone.voicemail flag)
 *
 * Reads are open to any company user behind the crm.softphone flag so the
 * dock can resolve the ring list. Writes are admin-only.
 */
class TelephonySoftphoneCallPoolController extends AccountBaseController
{
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

    /**
     * Compute the next available priority for a pool/tier, defaulting to 100 or the lowest unused slot <= 100.
     */
    private function nextAvailablePriority(int $companyId, string $tier, ?int $deviceId, ?int $userId = null): int
    {
        $existing = SoftphoneCallPoolAgent::query()
            ->where('company_id', $companyId)
            ->where('tier', $tier)
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

    /**
     * Resolve tier from request scope and device_id.
     */
    private function resolveTier(Request $request): string
    {
        $scope = (string) $request->input('scope', '');
        $rawDeviceId = (string) $request->input('device_id', '');

        if ($scope === 'default_fallback' || $scope === 'default') {
            return SoftphoneCallPoolAgent::TIER_DEFAULT_FALLBACK;
        }

        if ($scope === 'admin_fallback' || $scope === 'fallback' || $rawDeviceId === 'fallback') {
            return SoftphoneCallPoolAgent::TIER_ADMIN_FALLBACK;
        }

        return SoftphoneCallPoolAgent::TIER_LINE;
    }

    /** Pool members for a line or one of the fallback tiers. */
    public function index(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();

        $companyId = (int) company()->id;
        $company = Company::query()->whereKey($companyId)->first();
        $fallbackSeconds = (int) ($company?->incoming_call_fallback_seconds ?? 20);

        $tier = $this->resolveTier($request);
        $isLine = $tier === SoftphoneCallPoolAgent::TIER_LINE;

        if ($isLine) {
            $deviceId = (int) $request->input('device_id', 0);
            $this->assertDeviceBelongsToCompany($deviceId);
        } else {
            $deviceId = null;
        }

        $userRelation = self::supportsCanReceiveCalls()
            ? 'user:id,name,email,can_receive_calls'
            : 'user:id,name,email';

        $agentsQuery = SoftphoneCallPoolAgent::query()
            ->where('company_id', $companyId)
            ->where('tier', $tier)
            ->when($isLine, fn ($q) => $q->where('device_id', $deviceId), fn ($q) => $q->whereNull('device_id'))
            ->with($userRelation)
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
                'active' => (bool) $agent->active,
                'tier' => $agent->tier,
                'can_receive_calls' => (bool) ($agent->user?->can_receive_calls ?? true),
                'has_permission' => isset($permissionUsers[$agent->user_id]),
            ])
            ->values();

        return response()->json([
            'status' => 'success',
            'data' => [
                'agents' => $agents,
                'tier' => $tier,
                'fallback_seconds' => $fallbackSeconds,
                'fallback_voice_message_enabled' => (bool) ($company?->fallback_voice_message_enabled ?? false),
                'fallback_voice_message_url' => $company?->fallback_voice_message_url,
                'fallback_voice_message_text' => $company?->fallback_voice_message_text ?? 'We are unable to take your call at this time. Please try again later.',
                'fallback_voice_message_repeat_count' => (int) ($company?->fallback_voice_message_repeat_count ?? 1),
                'voice_message_flag_enabled' => FeatureFlags::enabled('softphone.voicemail'),
            ],
        ]);
    }

    /** Users that may be added to a pool (holders of make_softphone_calls, or all active users for fallback). */
    public function eligibleAgents(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $companyId = (int) company()->id;
        $tier = $this->resolveTier($request);

        $users = match ($tier) {
            SoftphoneCallPoolAgent::TIER_ADMIN_FALLBACK => SoftphoneCallPoolAgent::eligibleAdminFallbackUsersForCompany($companyId),
            SoftphoneCallPoolAgent::TIER_DEFAULT_FALLBACK => SoftphoneCallPoolAgent::eligibleFallbackUsersForCompany($companyId),
            default => SoftphoneCallPoolAgent::eligibleUsersForCompany($companyId),
        };

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
                    'can_receive_calls' => (bool) ($user->can_receive_calls ?? true),
                    'has_permission' => isset($permissionUsers[$user->id]),
                ])->values(),
            ],
        ]);
    }

    /**
     * Add an agent to a line call pool or fallback tier, or update company telephony settings.
     */
    public function store(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $companyId = (int) company()->id;

        if ($this->isSettingsUpdateRequest($request)) {
            return $this->updateTelephonySettings($request, $companyId);
        }

        return $this->addAgentToPool($request, $companyId);
    }

    /**
     * Check if the incoming request is updating company-wide telephony rotation settings.
     */
    private function isSettingsUpdateRequest(Request $request): bool
    {
        $settingsKeys = [
            'incoming_call_fallback_seconds',
            'fallback_voice_message_enabled',
            'fallback_voice_message_repeat_count',
            'fallback_voice_message_text',
            'fallback_voice_message_url',
        ];

        return ! $request->has('user_id') && $request->hasAny($settingsKeys);
    }

    /**
     * Update company-level call rotation timing and voice message fallback settings.
     */
    private function updateTelephonySettings(Request $request, int $companyId): JsonResponse
    {
        $validated = $request->validate([
            'incoming_call_fallback_seconds' => 'nullable|integer|min:1|max:600',
            'fallback_voice_message_enabled' => 'nullable|boolean',
            'fallback_voice_message_repeat_count' => 'nullable|integer|min:1|max:10',
            'fallback_voice_message_text' => 'nullable|string|max:500',
            'fallback_voice_message_url' => 'nullable|string|max:500',
        ]);

        $updates = [];
        if (isset($validated['incoming_call_fallback_seconds'])) {
            $updates['incoming_call_fallback_seconds'] = (int) $validated['incoming_call_fallback_seconds'];
        }
        if (array_key_exists('fallback_voice_message_enabled', $validated)) {
            $updates['fallback_voice_message_enabled'] = (bool) $validated['fallback_voice_message_enabled'];
        }
        if (isset($validated['fallback_voice_message_repeat_count'])) {
            $updates['fallback_voice_message_repeat_count'] = (int) $validated['fallback_voice_message_repeat_count'];
        }
        if (array_key_exists('fallback_voice_message_text', $validated)) {
            $updates['fallback_voice_message_text'] = $validated['fallback_voice_message_text'];
        }
        if (array_key_exists('fallback_voice_message_url', $validated)) {
            $updates['fallback_voice_message_url'] = $validated['fallback_voice_message_url'];
        }

        if (! empty($updates)) {
            $existingColumns = Schema::getColumnListing('companies');
            $safeUpdates = array_intersect_key($updates, array_flip($existingColumns));

            if (! empty($safeUpdates)) {
                Company::query()->whereKey($companyId)->update($safeUpdates);
            }

            if (session()->has('company')) {
                $cached = session('company');
                foreach ($updates as $key => $val) {
                    $cached->{$key} = $val;
                }
                session(['company' => $cached]);
            }
        }

        $updatedCompany = Company::query()->whereKey($companyId)->first();

        return response()->json([
            'status' => 'success',
            'message' => 'Telephony settings updated.',
            'data' => [
                'fallback_seconds' => (int) ($updatedCompany?->incoming_call_fallback_seconds ?? 20),
                'fallback_voice_message_enabled' => (bool) ($updatedCompany?->fallback_voice_message_enabled ?? false),
                'fallback_voice_message_repeat_count' => (int) ($updatedCompany?->fallback_voice_message_repeat_count ?? 1),
                'fallback_voice_message_text' => $updatedCompany?->fallback_voice_message_text,
                'fallback_voice_message_url' => $updatedCompany?->fallback_voice_message_url,
            ],
        ]);
    }

    /**
     * Add a user to a specific call pool or fallback tier.
     */
    private function addAgentToPool(Request $request, int $companyId): JsonResponse
    {
        $tier = $this->resolveTier($request);
        $isLine = $tier === SoftphoneCallPoolAgent::TIER_LINE;

        $rules = [
            'user_id' => 'required|integer|min:1',
            'priority' => 'nullable|integer|min:1|max:100',
            'active' => 'sometimes|boolean',
        ];
        if ($isLine) {
            $rules['device_id'] = 'required|integer|min:1';
        }

        $validated = $request->validate($rules);
        $userId = (int) $validated['user_id'];
        $user = User::query()->where('company_id', $companyId)->find($userId);
        abort_unless($user !== null, 404);

        if ($tier === SoftphoneCallPoolAgent::TIER_ADMIN_FALLBACK) {
            abort_unless(
                $user->hasRole('admin'),
                422,
                'Only users with the admin role can be added to the admin fallback list.'
            );
        } elseif (! $isLine) {
            abort_unless(
                SoftphoneCallPoolAgent::eligibleFallbackUsersForCompany($companyId)->contains('id', $userId),
                422,
                'User is not eligible for this fallback tier.'
            );
        }

        $deviceId = $isLine ? (int) $validated['device_id'] : null;
        if ($isLine) {
            $this->assertDeviceBelongsToCompany($deviceId);
        }

        return DB::transaction(function () use ($companyId, $tier, $deviceId, $userId, $validated) {
            Company::query()->whereKey($companyId)->lockForUpdate()->first();

            $explicitPriority = isset($validated['priority']) && is_numeric($validated['priority'])
                ? (int) $validated['priority']
                : null;
            $priority = $explicitPriority ?? $this->nextAvailablePriority($companyId, $tier, $deviceId, $userId);

            $duplicate = SoftphoneCallPoolAgent::query()
                ->where('company_id', $companyId)
                ->where('tier', $tier)
                ->when($deviceId !== null, fn ($q) => $q->where('device_id', $deviceId), fn ($q) => $q->whereNull('device_id'))
                ->where('user_id', '!=', $userId)
                ->where('priority', $priority)
                ->exists();

            if ($duplicate) {
                return response()->json([
                    'status' => 'fail',
                    'message' => "Priority {$priority} is already assigned to another agent in this list. Each agent must have a unique priority from 1 to 100.",
                ], 422);
            }

            if ($tier === SoftphoneCallPoolAgent::TIER_LINE) {
                $this->ensureSoftphonePermission($userId);
            }

            $agent = SoftphoneCallPoolAgent::updateOrCreate(
                [
                    'company_id' => $companyId,
                    'tier' => $tier,
                    'device_id' => $deviceId,
                    'user_id' => $userId,
                ],
                [
                    'priority' => $priority,
                    'active' => $validated['active'] ?? true,
                    'last_updated_by' => (int) user()->id,
                ],
            );

            $tierName = match ($tier) {
                SoftphoneCallPoolAgent::TIER_DEFAULT_FALLBACK => 'default fallback tier',
                SoftphoneCallPoolAgent::TIER_ADMIN_FALLBACK => 'admin fallback tier',
                default => 'line pool',
            };

            return response()->json([
                'status' => 'success',
                'message' => "User added to {$tierName}.",
                'data' => ['id' => $agent->id],
            ]);
        });
    }

    /**
     * Update a pool agent's priority or active status (the 'Route calls to me' toggle).
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
                    ->where('tier', $agent->tier ?? SoftphoneCallPoolAgent::TIER_LINE)
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
                $agent->active = (bool) $validated['active'];
            }

            $agent->last_updated_by = (int) user()->id;
            $agent->save();

            return response()->json([
                'status' => 'success',
                'message' => 'Pool agent updated.',
                'data' => [
                    'id' => $agent->id,
                    'active' => (bool) $agent->active,
                    'priority' => $agent->priority,
                ],
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
     * Current user's personal availability toggle: "Yes I can receive calls".
     * Available to any authenticated softphone user.
     */
    public function toggleUserAvailability(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();

        $validated = $request->validate([
            'can_receive_calls' => 'required|boolean',
        ]);

        /** @var User $currentUser */
        $currentUser = user();
        abort_unless($currentUser !== null, 401);
        abort_unless(
            $currentUser->hasRole('admin')
            || in_array($currentUser->permission('make_softphone_calls'), ['all', 'added'], true)
            || $currentUser->permission('manage_calls') === 'all',
            403
        );

        $isOnCallList = SoftphoneCallPoolAgent::query()
            ->where('company_id', (int) company()->id)
            ->where('user_id', (int) $currentUser->id)
            ->where('active', true)
            ->exists();
        abort_unless($isOnCallList, 403, 'You are not assigned to any softphone call lists.');

        $canReceive = (bool) $validated['can_receive_calls'];
        if (self::supportsCanReceiveCalls()) {
            $currentUser->can_receive_calls = $canReceive;
            $currentUser->save();
        }

        return response()->json([
            'status' => 'success',
            'message' => $canReceive ? 'You are now available to receive calls.' : 'You will not receive incoming calls.',
            'data' => [
                'user_id' => $currentUser->id,
                'can_receive_calls' => $canReceive,
            ],
        ]);
    }

    /**
     * Upload an audio file for the company voicemail fallback greeting.
     * Note: This upload endpoint is not gated by softphone.voicemail flag.
     */
    public function uploadVoicemailFile(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $request->validate([
            'file' => 'required|file|mimes:mp3,wav,ogg,m4a,aac|max:10240',
        ]);

        $companyId = (int) company()?->id;
        abort_unless($companyId > 0, 400, 'No active company found.');

        $file = $request->file('file');
        $filename = Files::uploadLocalOrS3($file, 'voicemail');
        $fileUrl = asset_url_local_s3('voicemail/' . $filename);

        if (Schema::hasColumn('companies', 'fallback_voice_message_url')) {
            Company::query()->whereKey($companyId)->update([
                'fallback_voice_message_url' => $fileUrl,
            ]);
        }

        if (session()->has('company')) {
            $cached = session('company');
            $cached->fallback_voice_message_url = $fileUrl;
            session(['company' => $cached]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Voicemail audio file uploaded successfully.',
            'fallback_voice_message_url' => $fileUrl,
        ]);
    }

    /**
     * Remove the company voicemail audio file.
     */
    public function deleteVoicemailFile(): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $companyId = (int) company()?->id;
        abort_unless($companyId > 0, 400, 'No active company found.');

        $company = Company::query()->whereKey($companyId)->first();
        if ($company && $company->fallback_voice_message_url) {
            $url = $company->fallback_voice_message_url;
            $filename = basename(parse_url($url, PHP_URL_PATH) ?? '');
            $cleanFilename = preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $filename);
            if ($cleanFilename && ! str_contains($cleanFilename, '..')) {
                $otherCompanyUsesFile = Company::query()
                    ->where('id', '!=', $companyId)
                    ->where('fallback_voice_message_url', 'like', "%/{$cleanFilename}")
                    ->exists();

                if (! $otherCompanyUsesFile) {
                    try {
                        Files::deleteFile($cleanFilename, 'voicemail');
                    } catch (\Throwable $e) {
                        // Suppress if file cannot be unlinked or was external
                    }
                }
            }
        }

        if (Schema::hasColumn('companies', 'fallback_voice_message_url')) {
            Company::query()->whereKey($companyId)->update([
                'fallback_voice_message_url' => null,
            ]);
        }

        if (session()->has('company')) {
            $cached = session('company');
            $cached->fallback_voice_message_url = null;
            session(['company' => $cached]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Voicemail audio file removed.',
            'fallback_voice_message_url' => null,
        ]);
    }

    /**
     * Toggle the company voicemail fallback feature on or off.
     */
    public function toggleVoicemail(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $validated = $request->validate([
            'enabled' => 'required|boolean',
        ]);

        $companyId = (int) company()?->id;
        abort_unless($companyId > 0, 400, 'No active company found.');

        $enabled = (bool) $validated['enabled'];

        if (Schema::hasColumn('companies', 'fallback_voice_message_enabled')) {
            Company::query()->whereKey($companyId)->update([
                'fallback_voice_message_enabled' => $enabled,
            ]);
        }

        if (session()->has('company')) {
            $cached = session('company');
            $cached->fallback_voice_message_enabled = $enabled;
            session(['company' => $cached]);
        }

        return response()->json([
            'status' => 'success',
            'message' => $enabled ? 'Voicemail feature turned on.' : 'Voicemail feature turned off.',
            'fallback_voice_message_enabled' => $enabled,
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
            'device_id' => 'nullable|integer',
        ]);

        $userId = (int) $validated['user_id'];
        /** @var User $user */
        $user = User::query()->where('company_id', company()->id)->findOrFail($userId);
        $enabled = (bool) $validated['enabled'];
        $deviceId = $request->filled('device_id') ? (int) $request->input('device_id') : null;

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

        // If toggling access on a specific line, revoke or grant access for that line without deleting from pool
        if ($deviceId !== null) {
            SoftphoneCallPoolAgent::query()
                ->where('company_id', company()->id)
                ->where('user_id', $userId)
                ->where('device_id', $deviceId)
                ->update(['active' => $enabled]);

            if ($enabled) {
                UserPermission::withoutEvents(function () use ($user, $permission) {
                    UserPermission::query()->updateOrCreate(
                        [
                            'user_id' => $user->id,
                            'permission_id' => $permission->id,
                        ],
                        [
                            'permission_type_id' => PermissionType::ALL,
                        ]
                    );
                });
            }

            return response()->json([
                'status' => 'success',
                'message' => $enabled
                    ? "Softphone access granted to {$user->name} on this line."
                    : "Softphone access revoked for {$user->name} on this line.",
                'data' => [
                    'user_id' => $user->id,
                    'device_id' => $deviceId,
                    'active' => $enabled,
                    'has_permission' => $enabled,
                ],
            ]);
        }

        // Global toggle across lines for this user
        UserPermission::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'permission_id' => $permission->id,
            ],
            [
                'permission_type_id' => $enabled ? PermissionType::ALL : PermissionType::NONE,
            ]
        );

        SoftphoneCallPoolAgent::query()
            ->where('company_id', company()->id)
            ->where('user_id', $userId)
            ->update(['active' => $enabled]);

        return response()->json([
            'status' => 'success',
            'message' => $enabled
                ? "Softphone access granted to {$user->name}."
                : "Softphone access revoked for {$user->name}.",
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
