import { useCallback } from "react";
import { usePage } from "@inertiajs/react";
import type { PermissionScope } from "@/Types/permission";

const SCOPES: Record<string, number> = {
    all: 4,
    both: 3,
    owned: 2,
    added: 1,
    none: 5,
};

type PermissionMap = Record<string, PermissionScope | undefined> | null | undefined;
type FlagMap = Record<string, boolean> | null | undefined;

function normalize(val: PermissionScope | false | null | undefined): number {
    if (val === undefined || val === null || val === false) {
        return 0;
    }
    if (typeof val === "number") {
        return val;
    }
    return SCOPES[val] ?? 0;
}

/**
 * Scope matrix shared with App\Support\Access (and permissionUtils hasAccess).
 * Unknown / missing values deny (fail closed).
 */
export function hasAccess(
    value: PermissionScope | false | null | undefined,
    requiredScope?: PermissionScope,
): boolean {
    if (value === undefined || value === null || value === false) {
        return false;
    }

    const userLevel = normalize(value);

    if (requiredScope === undefined) {
        return userLevel !== 5 && userLevel !== 0;
    }

    const requiredLevel = normalize(requiredScope);

    if (userLevel === 4) {
        return true;
    }

    if (userLevel === requiredLevel && userLevel !== 0) {
        return true;
    }

    if (userLevel === 3) {
        return requiredLevel === 1 || requiredLevel === 2;
    }

    return false;
}

/** Pure permission check — reusable outside React. Empty / unknown key → false. */
export function checkPermission(
    permissions: PermissionMap,
    key: string,
    scope?: PermissionScope,
): boolean {
    if (!key || !permissions) {
        return false;
    }

    return hasAccess(permissions[key], scope);
}

/** Pure flag check — reusable outside React. Empty / unknown name → false. */
export function checkFlag(featureFlags: FlagMap, name: string): boolean {
    if (!name) {
        return false;
    }

    return featureFlags?.[name] === true;
}

/**
 * Unified permission + feature-flag checker.
 *
 *   const { permission, flag } = useAccess();
 *   permission("edit_deals", "owned");
 *   flag("crm.lead-merge");
 *
 * Additive — does not replace usePermission() or the per-flag hooks.
 * Port this shape to OS (#5.1 / #7.2). See docs/ACCESS.md.
 */
export function useAccess() {
    const { props } = usePage();
    const permissions = props.auth?.permissions;
    const featureFlags = props.featureFlags ?? {};

    const permission = useCallback(
        (key: string, scope?: PermissionScope) =>
            checkPermission(permissions, key, scope),
        [permissions],
    );

    const flag = useCallback(
        (name: string) => checkFlag(featureFlags, name),
        [featureFlags],
    );

    return { permission, flag };
}
