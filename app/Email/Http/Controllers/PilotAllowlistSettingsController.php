<?php

namespace App\Email\Http\Controllers;

use App\Email\Pilot\PilotAllowlist;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Account settings page for company admins to manage the Email pilot allowlist.
 * Flag + admin middleware sit on the route; not the pilot gate.
 */
class PilotAllowlistSettingsController
{
    public function __construct(private readonly PilotAllowlist $allowlist) {}

    public function show(Request $request): Response
    {
        return Inertia::render('Settings/EmailPilot', [
            'pageTitle' => __('pages.email.pilot.title'),
            'entries' => $this->allowlist->presentFor($request->user()),
            'mailboxSettingsUrl' => '/account/settings/mailbox',
        ]);
    }
}
