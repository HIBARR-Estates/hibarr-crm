import type {
    DealExpose,
    DealExposeStatus,
} from "@/Types/api/dealExposes";
import type { DealFile } from "@/Types/api/file";
import type { AppPermission } from "@/Types/permission";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { formatCurrencyWithSymbol } from "@/lib/utils";
import { formatDate } from "./dateFormat";

/** 1 GB — matches DealExposeController::MAX_UPLOAD_KB and FileUploadService. */
export const DEAL_EXPOSE_MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;

/** Coerce antd Select values (number or numeric string) into an id. */
export function parseOptionalSelectId(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}

/** Strip the extension for a human-readable title from an uploaded filename. */
export function titleFromFilename(filename: string): string {
    const trimmed = filename.trim();
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot <= 0) return trimmed;
    return trimmed.slice(0, lastDot);
}

/**
 * http(s)-only allowlist for anything that ends up in an <a>/window.open —
 * a javascript:/data: URI here would execute in the CRM's own origin.
 * Mirrors DealExposeController's `download_url` => `url:http,https` rule.
 */
export function isHttpUrl(value: string | null | undefined): value is string {
    if (!value) return false;
    try {
        return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
        return false;
    }
}

/** Register a manual expose from an uploaded deal file row. */
export function dealFileToExposeStoreBody(
    dealFile: DealFile,
): Record<string, unknown> {
    const rawDownloadUrl = dealFile.external_url || dealFile.file_url;
    const downloadUrl = isHttpUrl(rawDownloadUrl) ? rawDownloadUrl : null;
    const objectPath =
        dealFile.object_path ||
        (dealFile.hashname
            ? `lead-files/${dealFile.deal_id}/${dealFile.hashname}`
            : null);

    return {
        deal_file_id: dealFile.id,
        download_url: downloadUrl,
        object_path: objectPath,
        uploaded_filename: dealFile.filename,
        uploaded_size: Number(dealFile.size) || null,
    };
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
export function parseExposeAmount(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") {
        return Number.isNaN(value) ? null : value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    if (
        typeof value === "object" &&
        value !== null &&
        "amount" in (value as Record<string, unknown>)
    ) {
        const raw = (value as { amount?: unknown }).amount;
        if (raw === null || raw === undefined || raw === "") return null;
        const parsed = typeof raw === "number" ? raw : Number(raw);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
}

export function formatExposeAmount(
    amount: number | string | null,
    symbol: string,
): string {
    const parsed = parseExposeAmount(amount);
    if (parsed === null) return "—";
    return formatCurrencyWithSymbol(parsed, symbol);
}

/**
 * The design's secondary date line: when the status last moved, falling back
 * to when the expose was added if it has never been touched.
 */
export function formatExposeDate(expose: DealExpose): string {
    const stamp = expose.status_changed_at ?? expose.created_at;
    return stamp ? formatDate(stamp) : "";
}

/**
 * Opens the expose document in a new tab when a download URL is available.
 * Re-checks the scheme rather than trusting the stored value — it may
 * predate the backend's url:http,https validation.
 */
export function downloadDealExpose(
    expose: Pick<DealExpose, "download_url" | "filename">,
): void {
    if (!isHttpUrl(expose.download_url)) return;

    window.open(expose.download_url, "_blank", "noopener,noreferrer");
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
