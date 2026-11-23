import { useCallback, useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import { evaluateChannelBlock } from "./suppressionPolicy";
import type {
    BlockedChannelSummary,
    ChannelBlockEvaluation,
    SuppressionChannel,
    SuppressionEntityType,
    SuppressionPermissions,
    SuppressionRestriction,
    SuppressionRestrictionsResponse,
    SuppressionScope,
} from "./types";

function hasCrmPermission(
    permissionsProp: unknown,
    permissionKey: string,
): boolean {
    if (!permissionsProp) return false;

    if (Array.isArray(permissionsProp)) {
        return permissionsProp.includes(permissionKey);
    }

    if (typeof permissionsProp === "object") {
        const raw = (permissionsProp as Record<string, unknown>)[permissionKey];
        if (raw === undefined || raw === null || raw === false) {
            return false;
        }
        if (raw === "none" || raw === 5 || raw === "5") {
            return false;
        }
        return true;
    }

    return false;
}

export interface UseEntitySuppressionsResult {
    restrictions: SuppressionRestriction[];
    blockedChannels: BlockedChannelSummary[];
    unavailable: boolean;
    loading: boolean;
    permissions: SuppressionPermissions;
    refetch: () => Promise<void>;
    getChannelBlock: (
        channel: SuppressionChannel,
        scope?: SuppressionScope,
        handle?: string | null,
    ) => ChannelBlockEvaluation;
}

export default function useEntitySuppressions(
    entityType: SuppressionEntityType,
    entityId: number | null | undefined,
): UseEntitySuppressionsResult {
    const { props } = usePage();
    const rawPermissions = (props as { auth?: { permissions?: unknown } }).auth
        ?.permissions;

    const permissions: SuppressionPermissions = useMemo(
        () => ({
            canViewDetails: hasCrmPermission(
                rawPermissions,
                "view_suppression_restrictions",
            ),
            canBlock: hasCrmPermission(rawPermissions, "block_suppressions"),
            canLift: hasCrmPermission(rawPermissions, "lift_suppressions"),
            canLiftRestricted: hasCrmPermission(
                rawPermissions,
                "lift_restricted_suppressions",
            ),
            canViewFull: hasCrmPermission(
                rawPermissions,
                "view_full_suppression_details",
            ),
        }),
        [rawPermissions],
    );

    const [restrictions, setRestrictions] = useState<SuppressionRestriction[]>(
        [],
    );
    const [blockedChannels, setBlockedChannels] = useState<
        BlockedChannelSummary[]
    >([]);
    const [unavailable, setUnavailable] = useState(false);
    const [serverCanViewDetails, setServerCanViewDetails] = useState(
        permissions.canViewDetails,
    );
    const [loading, setLoading] = useState(false);

    const fetchRestrictions = useCallback(async () => {
        if (!entityId) {
            setRestrictions([]);
            setBlockedChannels([]);
            setUnavailable(false);
            return;
        }

        setLoading(true);
        try {
            const response = await axios.get<SuppressionRestrictionsResponse>(
                `/suppressions/restrictions/${entityType}/${entityId}`,
            );
            setRestrictions(
                Array.isArray(response.data?.restrictions)
                    ? response.data.restrictions
                    : [],
            );
            setBlockedChannels(
                Array.isArray(response.data?.blockedChannels)
                    ? response.data.blockedChannels
                    : [],
            );
            setUnavailable(Boolean(response.data?.unavailable));
            if (typeof response.data?.canViewDetails === "boolean") {
                setServerCanViewDetails(response.data.canViewDetails);
            }
        } catch {
            // Leave the page usable when suppression lookup fails (HIB-1901).
            setRestrictions([]);
            setBlockedChannels([]);
            setUnavailable(true);
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId]);

    useEffect(() => {
        void fetchRestrictions();
    }, [fetchRestrictions]);

    const effectivePermissions = useMemo(
        () => ({
            ...permissions,
            canViewDetails: serverCanViewDetails || permissions.canViewDetails,
        }),
        [permissions, serverCanViewDetails],
    );

    const getChannelBlock = useCallback(
        (
            channel: SuppressionChannel,
            scope: SuppressionScope = "transactional",
            handle?: string | null,
        ): ChannelBlockEvaluation =>
            evaluateChannelBlock({
                restrictions,
                blockedChannels,
                unavailable,
                canViewDetails: effectivePermissions.canViewDetails,
                channel,
                scope,
                handle,
            }),
        [
            restrictions,
            blockedChannels,
            unavailable,
            effectivePermissions.canViewDetails,
        ],
    );

    return {
        restrictions,
        blockedChannels,
        unavailable,
        loading,
        permissions: effectivePermissions,
        refetch: fetchRestrictions,
        getChannelBlock,
    };
}
