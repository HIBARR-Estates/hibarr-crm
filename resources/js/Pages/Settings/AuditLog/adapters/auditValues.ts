import type { AuditLogEntry } from "../types";

export const REDACTED_VALUE = "[redacted]";

/** "client_name" → "Client name". */
export function humanizeField(key: string): string {
    const spaced = key
        .replace(/_id$/, " id")
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim()
        .toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface AuditFieldChange {
    key: string;
    before: unknown;
    after: unknown;
}

/** One row per field that appears on either side of the entry's diff. */
export function fieldChanges(entry: AuditLogEntry): AuditFieldChange[] {
    const before = entry.old_values ?? {};
    const after = entry.new_values ?? {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys.map((key) => ({ key, before: before[key], after: after[key] }));
}

/** Display string for a stored value; null/undefined handled by the caller. */
export function formatValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}
