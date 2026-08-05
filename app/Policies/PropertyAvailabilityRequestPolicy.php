<?php

namespace App\Policies;

use App\Models\PropertyAvailabilityRequest;
use App\Models\User;

class PropertyAvailabilityRequestPolicy
{
    /**
     * Admins can do everything.
     */
    public function before(User $user, string $ability): ?bool
    {
        if ($this->isPropertyAdmin($user)) {
            return true;
        }

        return null;
    }

    /**
     * Who can view the list of availability requests.
     * - Admins (via before)
     * - Sales managers, legal
     * - Any agent (sees only their own requests)
     */
    public function viewAny(User $user): bool
    {
        // All authenticated agents can view the list (filtered to their own in controller)
        return true;
    }

    /**
     * Who can view a single availability request.
     */
    public function view(User $user, PropertyAvailabilityRequest $request): bool
    {
        return $request->canBeViewedBy($user);
    }

    /**
     * Who can create an availability request.
     * Must not be the responsible agent or creator of the property.
     */
    public function create(User $user): bool
    {
        // Any authenticated agent can create requests (property-level checks in controller)
        return true;
    }

    /**
     * Who can respond (approve/deny) to an availability request.
     */
    public function respond(User $user, PropertyAvailabilityRequest $request): bool
    {
        return $request->canBeRespondedBy($user);
    }

    /**
     * Check if a user has admin-level property permissions.
     */
    private function isPropertyAdmin(User $user): bool
    {
        return \App\Support\PermissionGates::canManageProperties($user);
    }
}
