<?php

namespace App\Policies;

use App\Models\PropertyEditAccessRequest;
use App\Models\User;

class PropertyEditAccessRequestPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if (PropertyEditAccessRequest::isUserAdmin($user)) {
            return true;
        }

        return null;
    }

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, PropertyEditAccessRequest $request): bool
    {
        return $request->canBeViewedBy($user);
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function respond(User $user, PropertyEditAccessRequest $request): bool
    {
        return $request->canBeRespondedBy($user);
    }
}
