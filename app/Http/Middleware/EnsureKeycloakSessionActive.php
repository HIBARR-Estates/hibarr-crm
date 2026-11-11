<?php

namespace App\Http\Middleware;

use App\Support\KeycloakBackchannelLogout;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * Ends the Laravel session of a user whose Keycloak session was ended elsewhere
 * (OIDC back-channel logout, see KeycloakBackchannelLogout).
 */
class EnsureKeycloakSessionActive
{
    public function handle(Request $request, Closure $next)
    {
        if (! Auth::check() || ! KeycloakBackchannelLogout::sessionRevoked($request->session())) {
            return $next($request);
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->header('X-Inertia')) {
            return Inertia::location(route('login'));
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => __('auth.sessionEnded')], 401);
        }

        return redirect()->route('login')->with(['message' => __('auth.sessionEnded')]);
    }
}
