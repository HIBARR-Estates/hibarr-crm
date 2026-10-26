<?php

namespace App\Http\Controllers;

use App\Support\FeatureFlags;
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

        return Inertia::render('Settings/CallBridge', [
            'pageTitle' => 'Call Bridge',
        ]);
    }
}
