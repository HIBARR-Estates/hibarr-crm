/**
 * Mockup rule: `${base} ${count || ""}`.trim() — zero omits the suffix.
 */
export function formatTabLabel(base: string, count?: number): string {
    if (count === undefined) return base;
    return `${base} ${count || ""}`.trim();
}
