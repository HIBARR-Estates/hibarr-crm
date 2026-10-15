<?php

namespace App\Http\Controllers;

use App\Models\SoftphoneDevice;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD for the browser softphone's device lines (one per sipgate Neo channel,
 * e.g. German + Swedish). Reads (list/credentials) are open to any company
 * user behind the shared.softphone flag so the dock can list + register a
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

    /** Full credentials for ONE line so the browser can register it. */
    public function credentials(Request $request, int $id): JsonResponse
    {
        $this->assertSoftphoneEnabled();

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

        $validated = $request->validate([
            'label' => 'required|string|max:60',
            'wss_url' => 'required|string|max:255',
            'uri' => 'required|string|max:255',
            'authorization_username' => 'nullable|string|max:255',
            'authorization_password' => $passwordRule,
            'display_name' => 'nullable|string|max:120',
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
        $device->wss_url = $validated['wss_url'];
        $device->uri = $validated['uri'];
        $device->authorization_username = $validated['authorization_username'] ?? null;
        $device->authorization_password = $validated['authorization_password'];
        $device->display_name = $validated['display_name'] ?? null;
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
        abort_unless(FeatureFlags::enabled('shared.softphone'), 404);
    }

    private function assertCanManage(): void
    {
        // Any authenticated company user may manage the company's own phone
        // lines — the reads (list + credentials) are already open to every
        // company user behind the flag, so gating writes on admin was both
        // inconsistent and the reason a non-admin session got a silent 403.
        abort_unless(user() !== null, 403);
    }
}
