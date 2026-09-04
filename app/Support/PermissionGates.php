<?php

namespace App\Support;

use App\Models\User;

/**
 * Named permission gates for features that must not share overloaded product-edit scopes.
 */
class PermissionGates
{
    public const MANAGE_PARTNER_NETWORK = 'manage_partner_network';

    public const MANAGE_PARTNERS = 'manage_partners';

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

    public static function canManagePartners(User $user): bool
    {
        return self::allows($user, self::MANAGE_PARTNERS);
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

    /**
     * The deal-wide commission picture: what every leg paid out in total, and
     * what the company kept. Reserved for partner-network managers and admins.
     *
     * Note there is no companion "can view my own commission" gate. Whether an
     * agent sees their own earnings on a deal is not a permission question —
     * it is answered by whether they actually have a commission leg on it, so
     * it is derived from the commission engine rather than granted here. That
     * is what lets an upline see their own cut without seeing the total, and
     * without needing a second hierarchy walk to authorise it.
     *
     * Deal-independent by design: selling a deal is not a reason to see the
     * house's margin on it, so this is a fact about the viewer alone.
     */
    public static function canViewFullDealCommission(User $user): bool
    {
        return self::canManagePartnerNetwork($user) || User::isAdmin($user->id);
    }
}
