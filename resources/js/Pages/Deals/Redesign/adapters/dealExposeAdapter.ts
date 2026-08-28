import type {
    DealExpose,
    DealExposeStatus,
} from "@/Types/api/dealExposes";
import type { AppPermission } from "@/Types/permission";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { formatCurrencyWithSymbol } from "@/lib/utils";
import { formatDate } from "./dateFormat";

/** 1 GB — matches DealExposeController::MAX_UPLOAD_KB and FileUploadService. */
export const DEAL_EXPOSE_MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;

/** Strip the extension for a human-readable title from an uploaded filename. */
export function titleFromFilename(filename: string): string {
    const trimmed = filename.trim();
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot <= 0) return trimmed;
    return trimmed.slice(0, lastDot);
}

/** Mirrors DealExposeController's add_lead_proposals gate for mutations. */
export function canManageDealExposes(
    permissions: Pick<AppPermission, "add_lead_proposals"> | undefined,
): boolean {
    const scope = permissions?.add_lead_proposals;
    return scope === "all" || scope === "added";
}

/**
 * Pure shaping for the Exposes tab — no hook access, per the adapters/ rule.
 * Labels stay English at source and are translated with td() at the render
 * site (see the two-tier translation rule in CLAUDE.md).
 */

export interface ExposeStatusMeta {
    /** English source label; wrap in td() where it is rendered. */
    label: string;
    background: string;
    border: string;
    text: string;
    dot: string;
}

/** Display order for the status picker, matching the design and the model. */
export const EXPOSE_STATUS_ORDER: DealExposeStatus[] = [
    "not_sent",
    "shown",
    "accepted",
    "not_accepted",
];

export const EXPOSE_STATUS_META: Record<DealExposeStatus, ExposeStatusMeta> = {
    not_sent: {
        label: "Not sent",
        background: T.SURFACE_2,
        border: T.BORDER,
        text: T.TEXT_MUTED,
        dot: T.TEXT_HINT,
    },
    shown: {
        label: "Shown",
        background: T.BLUE_LIGHT,
        border: T.BLUE_MID,
        text: T.BLUE_DARK,
        dot: T.BLUE,
    },
    accepted: {
        label: "Accepted",
        background: T.GREEN_LIGHT,
        border: T.GREEN_MID,
        text: T.GREEN,
        dot: T.GREEN,
    },
    not_accepted: {
        label: "Not accepted",
        background: T.RED_SOFT,
        border: T.RED_MID,
        text: T.RED,
        dot: T.RED,
    },
};

export function exposeStatusMeta(status: DealExposeStatus): ExposeStatusMeta {
    return EXPOSE_STATUS_META[status] ?? EXPOSE_STATUS_META.not_sent;
}

/** An em dash reads as "no amount recorded" without implying a zero price. */
export function formatExposeAmount(
    amount: number | null,
    symbol: string,
): string {
    if (amount === null || Number.isNaN(amount)) return "—";
    return formatCurrencyWithSymbol(amount, symbol);
}

/**
 * The design's secondary date line: when the status last moved, falling back
 * to when the expose was added if it has never been touched.
 */
export function formatExposeDate(expose: DealExpose): string {
    const stamp = expose.status_changed_at ?? expose.created_at;
    return stamp ? formatDate(stamp) : "";
}

export interface ExposeGroup {
    id: string;
    /** Empty on the deal view, where a single ungrouped list is rendered. */
    label: string;
    showHeader: boolean;
    count: number;
    exposes: DealExpose[];
}

/**
 * Deal view: one ungrouped list. Lead view: grouped by deal, preserving the
 * server's newest-first ordering for both the groups and their contents.
 */
export function groupExposes(
    exposes: DealExpose[],
    mode: "flat" | "by-deal",
): ExposeGroup[] {
    if (mode === "flat") {
        return [
            {
                id: "all",
                label: "",
                showHeader: false,
                count: exposes.length,
                exposes,
            },
        ];
    }

    const order: string[] = [];
    const byDeal = new Map<string, ExposeGroup>();

    exposes.forEach((expose) => {
        const key = String(expose.deal_id);
        if (!byDeal.has(key)) {
            byDeal.set(key, {
                id: key,
                label: expose.deal_name || `Deal #${expose.deal_id}`,
                showHeader: true,
                count: 0,
                exposes: [],
            });
            order.push(key);
        }
        const group = byDeal.get(key)!;
        group.exposes.push(expose);
        group.count += 1;
    });

    return order.map((key) => byDeal.get(key)!);
}
