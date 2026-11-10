<?php

namespace App\Support;

use App\Models\AgentWorkspaceAccessEntry;
use App\Models\LeadAgent;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Schema;

/**
 * Who may open the agent workspace at /agent.
 *
 * 1. The crm.agent-workspace flag is the master switch: off means nobody.
 * 2. Partner-only accounts never get in; the workspace is built on leads,
 *    deals and tasks, which partners are kept out of.
 * 3. An entry on the company's access list wins: "allow" lets the person in,
 *    "block" keeps them out.
 * 4. Otherwise every enabled lead agent who is not a partner gets in.
 *
 * The answer is kept on the request, so the sidebar prop and the route
 * middleware cost one lookup between them.
 */
final class AgentWorkspaceAccess
{
    public const FLAG = 'crm.agent-workspace';

    private const REQUEST_KEY = 'agent_workspace.allows';

    public static function enabled(): bool
    {
        return FeatureFlags::enabled(self::FLAG);
    }

    public static function allows(?User $user): bool
    {
        if ($user === null || $user->company_id === null || ! self::enabled()) {
            return false;
        }

        $request = app()->bound('request') ? request() : null;
        $cached = $request?->attributes->get(self::REQUEST_KEY);
        if (is_array($cached) && array_key_exists($user->id, $cached)) {
            return $cached[$user->id];
        }

        $allowed = self::resolve($user);

        // Plain assignment, not spread: spreading renumbers integer keys.
        $answers = is_array($cached) ? $cached : [];
        $answers[$user->id] = $allowed;
        $request?->attributes->set(self::REQUEST_KEY, $answers);

        return $allowed;
    }

    /** Admins manage the access list; the settings page and the sidebar link both ask here. */
    public static function canManage(): bool
    {
        return self::enabled() && in_array('admin', user_roles(), true);
    }

    /** True when the person gets the workspace without an entry on the list. */
    public static function isDefaultMember(User $user): bool
    {
        return LeadAgent::query()
            ->withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->where('user_id', $user->id)
            ->where('status', 'enabled')
            ->where('is_partner', false)
            ->exists();
    }

    private static function resolve(User $user): bool
    {
        if (PartnerRole::isPartnerOnly($user)) {
            return false;
        }

        $override = self::override($user);

        if ($override !== null) {
            return $override === AgentWorkspaceAccessEntry::ALLOW;
        }

        return self::isDefaultMember($user);
    }

    private static function override(User $user): ?string
    {
        try {
            $access = AgentWorkspaceAccessEntry::query()
                ->where('company_id', $user->company_id)
                ->where('user_id', $user->id)
                ->value('access');
        } catch (QueryException $e) {
            // Before the migration has run there is no list, so no overrides.
            if (! Schema::hasTable('agent_workspace_access')) {
                return null;
            }

            throw $e;
        }

        return is_string($access) ? $access : null;
    }
}
