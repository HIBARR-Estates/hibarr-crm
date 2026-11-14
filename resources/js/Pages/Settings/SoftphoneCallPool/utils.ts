import React from "react";

/**
 * Grid template styling for Call Bridge pool tables (Agent, Routing Order, Softphone Access, Actions).
 */
export const POOL_GRID_STYLE = {
    "--cols": "minmax(0, 1fr) 130px 140px 44px",
} as React.CSSProperties;

/**
 * Generate 1-2 letter uppercase initials for user avatar display.
 */
export function getInitials(name: string | null, userId: number): string {
    const source = name?.trim() || `User ${userId}`;
    return source
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

/**
 * Find the lowest unused priority between 1 and 100.
 */
export function findLowestAvailablePriority(usedPriorities: Set<number>): number {
    for (let candidate = 1; candidate <= 100; candidate++) {
        if (!usedPriorities.has(candidate)) {
            return candidate;
        }
    }
    return 1;
}
