<?php

namespace App\Http\Controllers;

use App\Models\SoftphoneDevice;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            ->orderByDesc('is_default')
            ->orderBy('label')
            ->get(['id', 'label', 'is_default']);

        return response()->json([
            'status' => 'success',
            'data' => ['devices' => $devices],
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
                'wss_url' => $device->wss_url,
                'uri' => $device->uri,
                'authorization_username' => $device->authorization_username,
                'display_name' => $device->display_name,
                'is_default' => $device->is_default,
                'has_password' => $device->authorization_password !== null
                    && $device->authorization_password !== '',
            ],
        ]);
    }

    /** Full credentials for ONE line so the browser can register it. */
    public function credentials(Request $request, int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();

        // This returns the SIP authorization_password in cleartext, so it is
        // gated on the softphone permission rather than the feature flag alone.
        abort_403(user()->permission('make_softphone_calls') !== 'all');

        $device = SoftphoneDevice::findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => [
                'id' => $device->id,
                'label' => $device->label,
                'wss_url' => $device->wss_url,
                'uri' => $device->uri,
                'authorization_username' => $device->authorization_username,
                'authorization_password' => $device->authorization_password,
                'display_name' => $device->display_name,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $validated = $this->validateDevice($request);

        $device = new SoftphoneDevice();
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

        $device = SoftphoneDevice::findOrFail($id);
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

    public function destroy(int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();
        $this->assertCanManage();

        $device = SoftphoneDevice::findOrFail($id);
        $wasDefault = (bool) $device->is_default;
        $device->delete();

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

        // On create every connection field is required. On update they are
        // `sometimes` so an omitted field keeps its stored value — the settings
        // UI only ever has the summary (label + is_default), never the
        // connection settings, so a full update payload would blank them.
        $connectionRule = $device === null
            ? 'required|string|max:255'
            : 'sometimes|string|max:255';

        $validated = $request->validate([
            'label' => 'required|string|max:60',
            'wss_url' => $connectionRule,
            'uri' => $connectionRule,
            'authorization_username' => 'sometimes|nullable|string|max:255',
            'authorization_password' => $passwordRule,
            'display_name' => 'sometimes|nullable|string|max:120',
            'is_default' => 'sometimes|boolean',
        ]);

        // On update an empty password means "keep the stored one".
        if ($device !== null && ($validated['authorization_password'] ?? null) === null) {
            $validated['authorization_password'] = $device->authorization_password;
        }

        return $validated;
    }

    private function fill(SoftphoneDevice $device, array $validated): void
    {
        $device->label = $validated['label'];

        // Only overwrite connection fields that were actually sent. On create
        // they are all required, so this is a straight assignment; on update an
        // absent key means "unchanged" rather than "clear it".
        foreach (['wss_url', 'uri', 'authorization_username', 'display_name'] as $field) {
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
        ];
    }

    private function assertSoftphoneEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('crm.softphone'), 404);
    }

    private function assertCanManage(): void
    {
        // Writing a device row provisions SIP credentials for a company line, so
        // this is admin-only. The previous check only asserted the user was
        // logged in, which left store/update/destroy open to any agent. Reads
        // (list) and credentials() have their own, deliberately looser gates.
        abort_unless(user() !== null && user()->hasRole('admin'), 403);
    }
}
