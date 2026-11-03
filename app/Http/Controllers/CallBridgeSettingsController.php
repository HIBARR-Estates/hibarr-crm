<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Host page for the Call Bridge settings area (channels, per-line call pool and
 * call recordings). All data is fetched client-side from the telephony
 * endpoints so the page stays light and the dock can reuse the same APIs.
 */
class CallBridgeSettingsController extends AccountBaseController
{
    public function page(): Response
    {
        abort_unless(FeatureFlags::enabled('crm.softphone'), 404);

        abort_403(! user()->hasRole('admin') && ! in_array(user()->permission('make_softphone_calls'), ['all', 'added']));

        $companyId = (int) company()->id;
        $fallbackSeconds = (int) (Company::query()->whereKey($companyId)->value('incoming_call_fallback_seconds') ?? company()->incoming_call_fallback_seconds ?? 20);

        return Inertia::render('Settings/CallBridge', [
            'pageTitle' => 'Call Bridge',
            'fallbackSeconds' => $fallbackSeconds,
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        abort_unless(FeatureFlags::enabled('crm.softphone'), 404);
        abort_403(user() === null || ! user()->hasRole('admin'));

        $validated = $request->validate([
            'incoming_call_fallback_seconds' => 'required|integer|min:1|max:600',
        ]);

        $seconds = (int) $validated['incoming_call_fallback_seconds'];
        $companyId = (int) company()->id;

        Company::query()
            ->whereKey($companyId)
            ->update(['incoming_call_fallback_seconds' => $seconds]);

        if (session()->has('company')) {
            $cached = session('company');
            $cached->incoming_call_fallback_seconds = $seconds;
            session(['company' => $cached]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Call rotation timing updated.',
            'data' => ['fallback_seconds' => $seconds],
        ]);
    }
}
