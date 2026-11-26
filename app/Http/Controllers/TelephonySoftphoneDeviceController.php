<?php

namespace App\Http\Controllers;

use App\Models\SoftphoneDevice;
use App\Services\CallBridge\LineConcurrencyManager;
use App\Support\FeatureFlags;
use App\Support\SipProviderRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * CRUD for the browser softphone's device lines (one per sipgate Neo channel,
 * e.g. German + Swedish). Reads (list/credentials) are open to any company
 * user behind the crm.softphone flag so the dock can list + register a
 * line; writes are admin-only. Credentials are encrypted at rest.
 */
class TelephonySoftphoneDeviceController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
    }

    /** Line list (labels only) for the dock picker + settings manager. */
    public function index(): JsonResponse
    {
        $this->assertSoftphoneEnabled();

        $devices = SoftphoneDevice::query()
            ->when(! user()->hasRole('admin'), function ($query): void {
                // Non-admins only see the lines they are assigned to under
                // Call routing (or every line when on the admin fallback list).
                $allowed = \App\Models\SoftphoneCallPoolAgent::allowedDeviceIdsForUser(
                    (int) company()->id,
                    (int) user()->id
                );
                if ($allowed !== null) {
                    $query->whereIn('id', $allowed);
                }
            })
            ->orderByDesc('is_default')
            ->orderBy('label')
            ->get(['id', 'label', 'is_default', 'is_active', 'max_concurrent_calls', 'provider']);

        return response()->json([
            'status' => 'success',
            'data' => [
                'devices' => $devices,
                // Locally supported platforms, so the settings form can still
                // offer the (required) provider field when the
                // callbridge.integrations endpoint is unavailable or off.
                'providers' => SipProviderRegistry::names(),
            ],
        ]);
    }

    /**
     * Connection settings for ONE line so the settings edit form can prefill.
     *
     * Admin-only and deliberately without `authorization_password`: the form
     * treats a blank password as "keep the stored one", so the secret never
     * needs to leave the server (unlike credentials(), which the dock uses).
     */
    public function show(int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $device = SoftphoneDevice::findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => [
                'id' => $device->id,
                'label' => $device->label,
                'provider' => $device->provider,
                'wss_url' => $device->wss_url,
                'uri' => $device->uri,
                'authorization_username' => $device->authorization_username,
                'display_name' => $device->display_name,
                'is_default' => $device->is_default,
                'is_active' => $device->is_active !== false,
                'max_concurrent_calls' => LineConcurrencyManager::maxConcurrentCalls($device),
                'has_password' => $device->authorization_password !== null
                    && $device->authorization_password !== '',
            ],
        ]);
    }

    /**
     * Connection config for ONE line so the browser can register it.
     *
     * Never returns `authorization_password` or `authorization_ha1`: the
     * browser authenticates SIP 401/407 Digest challenges via `signChallenge()`
     * so no reusable SIP secret ever leaves the server.
     */
    public function credentials(Request $request, int $id): JsonResponse
    {
        $device = $this->findCallableDevice($id);

        // A disabled line cannot register, place, or receive calls.
        abort_if($device->is_active === false, 423, 'This line is disabled.');

        // Audit trail for every config hand-out; never includes any secret.
        Log::info('softphone.credentials_issued', [
            'user_id' => user()->id,
            'company_id' => company()->id,
            'device_id' => $device->id,
            'ip' => $request->ip(),
            'mode' => 'challenge',
        ]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'id' => $device->id,
                'label' => $device->label,
                'provider' => $device->provider,
                'wss_url' => $device->wss_url,
                'uri' => $device->uri,
                'authorization_username' => $device->authorization_username,
                'display_name' => $device->display_name,
                'stun_url' => SipProviderRegistry::stunUrl($device->provider),
                'max_concurrent_calls' => LineConcurrencyManager::maxConcurrentCalls($device),
                'auth_mode' => 'challenge',
                // Per-provider behaviour and wording for the browser client.
                'provider_profile' => SipProviderRegistry::clientProfile($device->provider),
            ],
        ]);
    }

    /**
     * Sign a single SIP 401/407 Digest challenge on behalf of the browser.
     *
     * Returns only the single-use response bound to that specific nonce,
     * method, and request URI, in a Digest algorithm the line's provider
     * allows (SipProviderRegistry::digestAlgorithms). Neither the SIP password nor HA1 ever leaves
     * the server, and revoking a user or disabling a line stops signing
     * immediately.
     */
    public function signChallenge(Request $request, int $id): JsonResponse
    {
        $device = $this->findCallableDevice($id);

        abort_if($device->is_active === false, 423, 'This line is disabled.');

        $validated = $request->validate([
            'method' => ['required', 'string', Rule::in([
                'REGISTER', 'INVITE', 'BYE', 'CANCEL', 'ACK',
                'OPTIONS', 'PRACK', 'UPDATE', 'INFO', 'REFER',
                'SUBSCRIBE', 'NOTIFY', 'PUBLISH', 'MESSAGE',
            ])],
            'uri' => 'required|string|max:512',
            'realm' => 'required|string|max:255',
            'nonce' => 'required|string|max:512',
            'qop' => ['nullable', 'string', Rule::in(['auth', 'auth-int'])],
            'nc' => ['nullable', 'string', 'regex:/^[0-9a-fA-F]{8}$/', 'required_with:qop'],
            'cnonce' => ['nullable', 'string', 'max:128', 'required_with:qop'],
            'algorithm' => ['nullable', 'string', 'max:20'],
            // Kept for older clients; auth-int is only signed for empty bodies.
            'body_md5' => ['nullable', 'string', 'regex:/^[0-9a-fA-F]{32}$/'],
        ]);

        // RFC 2617: an absent algorithm means MD5.
        $algorithm = strtoupper((string) ($validated['algorithm'] ?? 'MD5'));
        if (! in_array($algorithm, SipProviderRegistry::digestAlgorithms($device->provider), true)) {
            throw ValidationException::withMessages([
                'algorithm' => 'This line\'s provider does not use the '.$algorithm.' Digest algorithm.',
            ]);
        }

        // Pin the digest realm to the provider's known realm (or the line's
        // configured SIP URI domain) so this endpoint cannot be abused as an
        // oracle for arbitrary unrelated realms.
        $expectedRealm = SipProviderRegistry::digestRealm($device->provider);
        $uriDomain = is_string($device->uri) ? self::sipUriHost($device->uri) : null;
        $wssHost = is_string($device->wss_url) ? parse_url($device->wss_url, PHP_URL_HOST) : null;
        $allowedRealms = array_values(array_filter(array_unique([$expectedRealm, $uriDomain, is_string($wssHost) ? $wssHost : null])));
        // Custom lines have no registry realm but are still pinned to their
        // own SIP URI domain or WSS host. A line with none of these cannot be
        // pinned, so it is refused rather than signing any realm.
        if ($allowedRealms === [] || ! collect($allowedRealms)->contains(fn (string $r) => strcasecmp($r, $validated['realm']) === 0)) {
            Log::warning('softphone.challenge_realm_mismatch', [
                'user_id' => user()->id,
                'company_id' => company()->id,
                'device_id' => $device->id,
                'received_realm' => $validated['realm'],
                'allowed_realms' => $allowedRealms,
            ]);
            throw ValidationException::withMessages([
                'realm' => 'Unexpected SIP authentication realm for this line.',
            ]);
        }

        $username = trim((string) ($device->authorization_username ?? ''));
        if ($username === '' && is_string($device->uri)) {
            $withoutScheme = preg_replace('/^sips?:/i', '', trim($device->uri)) ?? '';
            $atPos = strpos($withoutScheme, '@');
            $username = $atPos !== false ? trim(substr($withoutScheme, 0, $atPos)) : trim($withoutScheme);
        }
        $password = (string) ($device->authorization_password ?? '');

        if ($username === '' || $password === '') {
            abort(422, 'This line is missing SIP credentials.');
        }

        $qop = $validated['qop'] ?? null;
        $nc = $qop !== null ? strtolower((string) $validated['nc']) : null;
        $cnonce = $qop !== null ? (string) $validated['cnonce'] : null;

        $response = SipProviderRegistry::signDigestChallenge(
            username: $username,
            password: $password,
            realm: $validated['realm'],
            method: $validated['method'],
            uri: $validated['uri'],
            nonce: $validated['nonce'],
            qop: $qop,
            nc: $nc,
            cnonce: $cnonce,
            algorithm: $algorithm,
        );

        Log::info('softphone.challenge_signed', [
            'user_id' => user()->id,
            'company_id' => company()->id,
            'device_id' => $device->id,
            'method' => $validated['method'],
            'realm' => $validated['realm'],
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'username' => $username,
                'realm' => $validated['realm'],
                'nonce' => $validated['nonce'],
                'uri' => $validated['uri'],
                'response' => $response,
                'algorithm' => $algorithm,
                'qop' => $qop,
                'nc' => $nc,
                'cnonce' => $cnonce,
            ],
        ]);
    }

    /**
     * Take one of the line's concurrent-call slots for the caller before an
     * outbound call is dialled. `available` is false when the line is full.
     */
    public function reserveCapacity(int $id): JsonResponse
    {
        $device = $this->findCallableDevice($id);

        abort_if($device->is_active === false, 423, 'This line is disabled.');

        $reserved = LineConcurrencyManager::reserve($device, (int) user()->id);

        return response()->json([
            'status' => 'success',
            'data' => ['available' => $reserved] + LineConcurrencyManager::capacityInfo($device, (int) user()->id),
        ]);
    }

    /** Free the caller's slot on the line once their call is over. */
    public function releaseCapacity(int $id): JsonResponse
    {
        // Release only ever frees the caller's own slot, so it is not gated on
        // the call permissions: a user whose login is disabled, or who loses
        // the line, mid-call must still free the slot they hold instead of
        // blocking the line until the stale timeout. Reserving a slot and
        // signing challenges stay refused (findCallableDevice).
        $this->assertSoftphoneEnabled();
        abort_if(user() === null, 403);

        $device = SoftphoneDevice::findOrFail($id);

        LineConcurrencyManager::release((int) $device->id, (int) user()->id);

        return response()->json(['status' => 'success']);
    }

    /**
     * Host of a SIP URI (RFC 3261 §19.1.1) without user, port, URI
     * parameters or headers: `sip:alice@PBX.example:5061;transport=tls?x=y`
     * gives `PBX.example`. Null without a `user@host` part, so a bare
     * `sip:4711` never turns the user into an allowed realm.
     */
    public static function sipUriHost(string $uri): ?string
    {
        $rest = preg_replace('/^\s*<?\s*sips?:/i', '', trim($uri)) ?? '';
        // Parameters, headers and a closing angle bracket end the authority.
        $rest = preg_split('/[;?>]/', $rest)[0];
        $at = strrpos($rest, '@');
        if ($at === false) {
            return null;
        }
        $hostport = substr($rest, $at + 1);

        if (str_starts_with($hostport, '[')) {
            $end = strpos($hostport, ']');
            $host = $end === false ? '' : substr($hostport, 0, $end + 1);
        } else {
            $host = explode(':', $hostport)[0];
        }

        $host = trim($host);

        return $host !== '' ? $host : null;
    }

    /** A line of this company that the current user may call on. */
    private function findCallableDevice(int $id): SoftphoneDevice
    {
        $this->assertSoftphoneEnabled();

        $currentUser = user();
        abort_if(
            $currentUser === null
            || (($currentUser->status ?? 'active') !== 'active')
            || (($currentUser->login ?? 'enable') === 'disable'),
            403
        );

        abort_403(
            ! $currentUser->hasRole('admin')
            && ! in_array($currentUser->permission('make_softphone_calls'), ['all', 'added'], true)
        );

        if (! $currentUser->hasRole('admin')) {
            $allowedLines = \App\Models\SoftphoneCallPoolAgent::allowedDeviceIdsForUser(
                (int) company()->id,
                (int) $currentUser->id
            );
            abort_if($allowedLines !== null && ! in_array($id, $allowedLines, true), 403);
        }

        return SoftphoneDevice::findOrFail($id);
    }

    public function store(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $validated = $this->validateDevice($request);

        $device = new SoftphoneDevice;
        $device->company_id = (int) company()->id;
        $device->added_by = (int) user()->id;
        $this->fill($device, $validated);
        $device->save();

        // First line for the company becomes the default automatically.
        $hasDefault = SoftphoneDevice::query()
            ->where('id', '!=', $device->id)
            ->where('is_default', true)
            ->exists();
        if (! $hasDefault) {
            $this->makeDefault($device);
            $device->save();
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Device added.',
            'data' => $this->transform($device),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $device = $this->findManageableDevice($id);
        $validated = $this->validateDevice($request, $device);

        $device->last_updated_by = (int) user()->id;
        $this->fill($device, $validated);

        if ($validated['is_default'] ?? false) {
            $this->makeDefault($device);
        }

        $device->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Device updated.',
            'data' => $this->transform($device),
        ]);
    }

    /** Enable or disable a line (disabled: no outbound, no inbound). */
    public function setActive(Request $request, int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $device = $this->findManageableDevice($id);
        $validated = $request->validate(['active' => 'required|boolean']);

        $device->is_active = (bool) $validated['active'];
        $device->last_updated_by = (int) user()->id;
        $device->save();

        return response()->json([
            'status' => 'success',
            'message' => $device->is_active ? 'Line enabled.' : 'Line disabled.',
            'data' => $this->transform($device),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $device = $this->findManageableDevice($id);
        $wasDefault = (bool) $device->is_default;
        $device->delete();
        LineConcurrencyManager::clearDevice($id);

        // Promote another line if we just removed the default.
        if ($wasDefault) {
            $next = SoftphoneDevice::query()->orderBy('label')->first();
            if ($next) {
                $this->makeDefault($next);
                $next->save();
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Device removed.',
        ]);
    }

    private function validateDevice(Request $request, ?SoftphoneDevice $device = null): array
    {
        $passwordRule = $device === null
            ? 'required|string|max:255'
            : 'nullable|string|max:255';

        // On create the platform is required: it decides the connection
        // (wss_url + uri), which is resolved from the registry below when the
        // form leaves them blank. On update every connection field is
        // `sometimes` so an omitted field keeps its stored value — the settings
        // UI only ever has the summary, and an admin may edit only the label.
        $connectionRule = $device === null
            ? 'nullable|string|max:255'
            : 'sometimes|nullable|string|max:255';

        $validated = $request->validate([
            'label' => 'required|string|max:60',
            // The registry validates what the connection defaults can be
            // resolved for, so a platform OL lists but the CRM cannot yet
            // serve defaults for is refused here rather than stored without a
            // WSS endpoint / SIP URI.
            'provider' => [
                $device === null ? 'required' : 'sometimes',
                'nullable',
                'string',
                Rule::in(SipProviderRegistry::names()),
            ],
            'wss_url' => $connectionRule,
            'uri' => $connectionRule,
            'authorization_username' => 'sometimes|nullable|string|max:255',
            'authorization_password' => $passwordRule,
            'display_name' => 'sometimes|nullable|string|max:120',
            'is_default' => 'sometimes|boolean',
            'max_concurrent_calls' => 'sometimes|nullable|integer|min:1|max:100',
        ], [
            // OL may already list a platform this CRM build has no defaults
            // for; the registry is what the line's connection is resolved
            // from, so say so plainly instead of the generic rule message.
            'provider.in' => 'This CRM does not support the ":input" provider yet.',
        ]);

        $this->applyProviderDefaults($validated, $device);

        // An empty limit means "the platform's default" on create and
        // "unchanged" on update; the column itself is never null.
        if (($validated['max_concurrent_calls'] ?? null) === null) {
            if ($device === null) {
                $validated['max_concurrent_calls'] = SipProviderRegistry::defaultMaxConcurrentCalls($validated['provider'] ?? null);
            } else {
                unset($validated['max_concurrent_calls']);
            }
        }

        // On update an empty password means "keep the stored one".
        if ($device !== null && ($validated['authorization_password'] ?? null) === null) {
            $validated['authorization_password'] = $device->authorization_password;
        }

        return $validated;
    }

    /**
     * Resolve the connection details from the selected platform.
     *
     * The form only sends the platform + credentials; the registry owns the
     * endpoint and the URI format (`sipgate` serves German and Swedish lines
     * from the same endpoint and derives the URI from the channel username).
     * On create the connection always comes from the platform; on update it is
     * kept as stored unless the admin switched the platform or changed the
     * username the URI is built from.
     */
    private function applyProviderDefaults(array &$validated, ?SoftphoneDevice $device): void
    {
        $provider = array_key_exists('provider', $validated)
            ? $validated['provider']
            : $device?->provider;

        // No platform (legacy line, or the admin cleared it): keep whatever
        // the device already stores.
        if (! SipProviderRegistry::supports($provider)) {
            return;
        }

        $switched = $device === null
            || (array_key_exists('provider', $validated) && $validated['provider'] !== $device->provider);

        // Resolve the endpoint when the platform is new/switched or the caller
        // explicitly cleared it. An explicit value (custom endpoint) and an
        // untouched stored one are both kept.
        if (($switched || array_key_exists('wss_url', $validated)) && empty($validated['wss_url'])) {
            $validated['wss_url'] = SipProviderRegistry::wssUrl($provider);
        }

        $username = array_key_exists('authorization_username', $validated)
            ? $validated['authorization_username']
            : $device?->authorization_username;

        // A new channel username changes the SIP URI on platforms that embed
        // it (`sipgate`). Clearing the field keeps the stored URI instead.
        $usernameChanged = $device !== null
            && array_key_exists('authorization_username', $validated)
            && $validated['authorization_username'] !== $device->authorization_username
            && $username !== null
            && $username !== '';

        // Nothing to build: the stored URI stays when the platform and the
        // username did not change and no URI was sent.
        if (! $switched && ! $usernameChanged && ! array_key_exists('uri', $validated)) {
            return;
        }

        $uri = $validated['uri'] ?? null;

        if (empty($uri)) {
            $uri = SipProviderRegistry::sipUri($provider, $username);

            if ($uri === null) {
                throw ValidationException::withMessages([
                    'authorization_username' => "A username is required to build the SIP URI for {$provider}.",
                ]);
            }

            $validated['uri'] = $uri;
        }
    }

    private function fill(SoftphoneDevice $device, array $validated): void
    {
        $device->label = $validated['label'];

        // Only overwrite connection fields that were actually sent. On create
        // they are all present (explicitly or resolved from the platform); on
        // update an absent key means "unchanged" rather than "clear it".
        foreach (['provider', 'wss_url', 'uri', 'authorization_username', 'display_name', 'max_concurrent_calls'] as $field) {
            if (array_key_exists($field, $validated)) {
                $device->{$field} = $validated[$field];
            }
        }

        $device->authorization_password = $validated['authorization_password'];
    }

    private function makeDefault(SoftphoneDevice $device): void
    {
        SoftphoneDevice::query()
            ->where('id', '!=', $device->id)
            ->where('is_default', true)
            ->update(['is_default' => false]);

        $device->is_default = true;
    }

    private function transform(SoftphoneDevice $device): array
    {
        return [
            'id' => $device->id,
            'label' => $device->label,
            'is_default' => $device->is_default,
            'is_active' => $device->is_active !== false,
            'max_concurrent_calls' => LineConcurrencyManager::maxConcurrentCalls($device),
            'provider' => $device->provider,
        ];
    }

    private function assertSoftphoneEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('crm.softphone'), 404);
    }

    private function assertCanManage(): void
    {
        // Writing a device row provisions SIP credentials for a company line.
        // Gated on the same permission values as credentials(): admins bypass,
        // everyone else needs make_softphone_calls set to `all` or `added`
        // (`owned`/`both`/`none`, or an unset permission, are refused).
        abort_if(user() === null, 403);

        abort_unless(
            user()->hasRole('admin')
            || in_array(user()->permission('make_softphone_calls'), ['all', 'added'], true),
            403
        );
    }

    /**
     * Load a line the current user is allowed to change: admins and users with
     * the company-wide `all` permission may edit any line, while `added` users
     * may only touch the lines they created themselves.
     */
    private function findManageableDevice(int $id): SoftphoneDevice
    {
        $device = SoftphoneDevice::findOrFail($id);

        if (user()->hasRole('admin') || user()->permission('make_softphone_calls') === 'all') {
            return $device;
        }

        abort_unless((int) $device->added_by === (int) user()->id, 403);

        return $device;
    }
}
