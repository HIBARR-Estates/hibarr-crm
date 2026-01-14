import React, { ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import { AppProps } from "@/Types";
import {
    AppModule,
    AppPermission,
    PermissionKey,
    PermissionScope,
} from "@/Types/permission";

// Define types based on the application structure

export interface User {
    id: number;
    name: string;
    email: string;
    // roles?: any[];
    // [key: string]: any;
}

export interface PermissionCheckOptions {
    /**
     * A single permission or array of permissions to check.
     * If an array is provided, behavior depends on `requireAll`.
     */
    permissions?: PermissionKey | PermissionKey[];

    /**
     * A single module or array of modules to check.
     * If an array is provided, behavior depends on `requireAll`.
     */
    modules?: string | string[];

    /**
     * If true, all provided permissions/modules must be satisfied.
     * If false, at least one must be satisfied.
     * Default: true
     */
    requireAll?: boolean;

    /**
     * The specific scope/level required for the permission.
     * If not provided, checks if the permission is not 'none' (or 5).
     * Can be a specific value like 'all', 'added', or a number.
     */
    requiredScope?: PermissionScope;

    /**
     * Custom callback for complex logic.
     */
    callback?: (
        user: User,
        permissions: AppPermission,
        userModules: string[]
    ) => boolean;
}

/**
 * Checks if a permission value represents "access granted" (i.e., not 'none').
 */
const hasAccess = (
    value: PermissionScope,
    requiredScope?: PermissionScope
): boolean => {
    if (value === undefined || value === null) return false;

    // Normalize values to numbers for comparison
    const SCOPES = {
        all: 4,
        both: 3,
        owned: 2,
        added: 1,
        none: 5,
    };

    const normalize = (val: PermissionScope): number => {
        if (typeof val === "number") return val;
        return SCOPES[val as keyof typeof SCOPES] || 0;
    };

    const userLevel = normalize(value);

    // If no specific scope required, just check if not 'none' (5)
    if (requiredScope === undefined) {
        return userLevel !== 5 && userLevel !== 0;
    }

    const requiredLevel = normalize(requiredScope);

    // 'all' (4) grants access to everything
    if (userLevel === 4) return true;

    // Exact match
    if (userLevel === requiredLevel) return true;

    // Hierarchy checks
    // 'both' (3) grants access to 'added' (1) and 'owned' (2)
    if (userLevel === 3) {
        return requiredLevel === 1 || requiredLevel === 2;
    }

    return false;
};

/**
 * Core function to check permissions.
 */
export const checkPermission = (
    options: PermissionCheckOptions,
    context: {
        user: User;
        permissions: AppPermission;
        userModules: string[];
    }
): boolean => {
    const {
        permissions: requiredPermissions,
        modules: requiredModules,
        requireAll = true,
        requiredScope,
        callback,
    } = options;

    const { user, permissions, userModules } = context;

    // 1. Check Modules
    if (requiredModules) {
        const modulesList = Array.isArray(requiredModules)
            ? requiredModules
            : [requiredModules];
        if (modulesList.length > 0) {
            const hasModules = modulesList.map((m) => userModules.includes(m));
            const modulesSatisfied = requireAll
                ? hasModules.every(Boolean)
                : hasModules.some(Boolean);
            if (!modulesSatisfied) return false;
        }
    }

    // 2. Check Permissions
    if (requiredPermissions) {
        const permList = Array.isArray(requiredPermissions)
            ? requiredPermissions
            : [requiredPermissions];
        if (permList.length > 0) {
            const hasPerms = permList.map((p) =>
                hasAccess(permissions[p], requiredScope)
            );
            const permsSatisfied = requireAll
                ? hasPerms.every(Boolean)
                : hasPerms.some(Boolean);
            if (!permsSatisfied) return false;
        }
    }

    // 3. Check Callback
    if (callback) {
        if (!callback(user, permissions, userModules)) return false;
    }

    return true;
};

/**
 * Hook to check permissions within a component.
 */
export const usePermission = () => {
    const { props } = usePage<AppProps>();
    const { auth } = props;
    const user = auth.user;
    const permissions = auth.permissions;
    const userModules = auth.modules || [];

    const can = (options: PermissionCheckOptions): boolean => {
        // Allow passing a simple string as a shortcut for { permissions: string }
        const opts =
            typeof options === "string" ? { permissions: options } : options;

        return checkPermission(opts, { user, permissions, userModules });
    };

    /**
     * Helper to check if user has a specific module
     */
    const hasModule = (moduleName: AppModule): boolean => {
        return userModules.includes(moduleName);
    };

    // helper to check if user has a specific permission
    const hasPermission = (
        permissionKey: PermissionKey,
        requiredScope?: PermissionScope
    ): boolean => {
        return hasAccess(permissions[permissionKey], requiredScope);
    };

    return { can, hasModule, user, permissions, userModules, hasPermission };
};

interface PermissionGateProps extends PermissionCheckOptions {
    children: ReactNode;
    /**
     * Optional fallback content to render if permission is denied.
     */
    fallback?: ReactNode;
}

/**
 * Wrapper component to conditionally render children based on permissions.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
    children,
    fallback = null,
    ...options
}) => {
    const { can } = usePermission();

    if (can(options)) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
};
