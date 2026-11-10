<?php

namespace App\Http\Middleware;

use App\Support\AgentWorkspaceAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * /agent/* exists only for people with agent workspace access. Everyone else,
 * including everyone while crm.agent-workspace is off, gets a 404. Runs after auth.
 */
class EnsureAgentWorkspaceAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(AgentWorkspaceAccess::allows($request->user()), 404);

        return $next($request);
    }
}
