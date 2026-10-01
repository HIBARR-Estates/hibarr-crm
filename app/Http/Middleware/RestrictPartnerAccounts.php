<?php

namespace App\Http\Middleware;

use App\Support\PartnerRole;
use Closure;
use Illuminate\Http\Request;

/**
 * Keeps partner accounts out of the internal workspace.
 *
 * Permissions alone do not do it: Properties, Projects (developer projects),
 * Reports and Meetings have no "none" check, and any agent can open their own
 * report. So partner-only accounts are refused at the door for the sections
 * below, whatever the permission rows say.
 *
 * This is a deny-list on the first path segment under /account, because the
 * allow-list it should be would need every endpoint the page chrome calls
 * enumerated. Anything that matters and is not matched here must still be
 * covered by the partner role holding "none" for it.
 */
class RestrictPartnerAccounts
{
    /** Matched against the first path segment after /account/. */
    private const BLOCKED = '/^(
        tasks?|task-.+|taskboards|taskComment|taskCategory|pendingTasks|sub-tasks?|sub-task-.+|recurring-task
        |projects?|projects-ajax|project-.+|duplicate-project|assignProjectAdmin|get-projects|milestones|gantt.*
        |properties|property-.+|publish-requests|edit-access-requests|availability-requests
        |developers?|developer-.+
        |reports?|.+-reports?|agent-metrics
        |meetings?|meeting-.+
        |leads?|lead-.+|leadboards|deals?|deal-.+
        |offers|payment-requests
    )$/x';

    public function handle(Request $request, Closure $next)
    {
        if (! PartnerRole::isPartnerOnly($request->user()) || ! $this->isBlocked($request)) {
            return $next($request);
        }

        // A page visit goes home; anything scripted gets a plain refusal.
        if ($request->isMethod('GET') && ! $request->expectsJson()) {
            return redirect()->route('dashboard.v2', ['view' => 'partner']);
        }

        abort(403);
    }

    private function isBlocked(Request $request): bool
    {
        return $request->segment(1) === 'account'
            && preg_match(self::BLOCKED, (string) $request->segment(2)) === 1;
    }
}
