/**
 * Shared shape for bulk-export field pickers. Each entity keeps its own field
 * list next to its bulk actions; keys must match the matching PHP allowlist
 * (App\Support\*ExportFields).
 */

export type BulkExportFormat = "csv" | "xlsx";

export interface BulkExportFieldDef {
    key: string;
    label: string;
    group: string;
    defaultSelected?: boolean;
}

export function defaultKeysOf(fields: BulkExportFieldDef[]): string[] {
    return fields.filter((field) => field.defaultSelected).map((f) => f.key);
}

export function groupExportFields(
    fields: BulkExportFieldDef[],
): Array<{ group: string; fields: BulkExportFieldDef[] }> {
    const order: string[] = [];
    const map = new Map<string, BulkExportFieldDef[]>();

    for (const field of fields) {
        if (!map.has(field.group)) {
            order.push(field.group);
            map.set(field.group, []);
        }
        map.get(field.group)!.push(field);
    }

    return order.map((group) => ({ group, fields: map.get(group)! }));
}
