<?php

namespace App\Email\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

/**
 * Account settings page for the signed-in agent's mailbox.
 * Flag and allowlist are enforced by middleware on the route.
 */
class MailboxSettingsController
{
    public function show(): Response
    {
        return Inertia::render('Settings/Mailbox', [
            'pageTitle' => __('pages.email.connect.title'),
        ]);
    }
}
