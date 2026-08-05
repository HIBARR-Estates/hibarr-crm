<?php

namespace App\Support;

use App\Models\User;

/**
 * Named permission gates for features that must not share overloaded product-edit scopes.
 */
class PermissionGates
{
    public const MANAGE_PARTNER_NETWORK = 'manage_partner_network';

    public const MANAGE_OFFERS = 'manage_offers';

    /** Privileged property inventory management (view/edit any listing). Not publish-request approval. */
    public const MANAGE_PROPERTIES = 'manage_properties';

    /** Approve / reject property publish requests only. */
    public const MANAGE_PROPERTY_PUBLISH_REQUESTS = 'manage_property_publish_requests';

    public const MANAGE_PROPERTY_CONFIGURATION = 'manage_property_configuration';

    /**
     * Whether the user has the given permission at the "all" scope
     * (Worksuite ALL_NONE permissions only expose all|none).
     */
    public static function allows(User $user, string $permission): bool
    {
        $scope = $user->permission($permission);

        return $scope === 'all' || $scope === 4;
    }

    public static function canManagePartnerNetwork(User $user): bool
    {
        return self::allows($user, self::MANAGE_PARTNER_NETWORK);
    }

    public static function canManageOffers(User $user): bool
    {
        return self::allows($user, self::MANAGE_OFFERS);
    }

    /**
     * Can manage properties company-wide (privileged inventory access).
     * Does not grant publish-request approval — use canManagePropertyPublishRequests().
     */
    public static function canManageProperties(User $user): bool
    {
        return self::allows($user, self::MANAGE_PROPERTIES);
    }

    public static function canManagePropertyPublishRequests(User $user): bool
    {
        return self::allows($user, self::MANAGE_PROPERTY_PUBLISH_REQUESTS);
    }

    public static function canManagePropertyConfiguration(User $user): bool
    {
        return self::allows($user, self::MANAGE_PROPERTY_CONFIGURATION);
    }
}
