import type { Lead } from "@/Types/api/leads";
import {
    LIFECYCLE_BANNER_CONFIG,
    LIFECYCLE_BANNER_MODE,
    LIFECYCLE_STATUS_TONE,
    type LifecycleBannerConfig,
} from "../config/lifecycleBanners";
import type { LeadBannerMode } from "../types";

export interface LeadLifecycleStatusOption {
    id: number;
    key: string;
    label: string;
    label_color?: string | null;
}

export interface ResolvedLifecycle {
    statusKey: string;
    statusLabel: string;
    tone: string;
    bannerMode: LeadBannerMode;
    banner: LifecycleBannerConfig;
}

function leadStatusKey(lead: Lead): string {
    const raw =
        (lead as { lead_lifecycle_status?: { key?: string; name?: string } })
            .lead_lifecycle_status?.key ||
        (lead as { lifecycle_status?: string }).lifecycle_status ||
        (lead as { status?: string }).status ||
        "new";
    return String(raw).toLowerCase().replace(/\s+/g, "_");
}

export function resolveLifecycle(
    lead: Lead,
    statuses?: LeadLifecycleStatusOption[] | null,
): ResolvedLifecycle {
    const statusKey = leadStatusKey(lead);
    const fromList = statuses?.find(
        (s) => s.key === statusKey || String(s.id) === statusKey,
    );
    const bannerMode: LeadBannerMode =
        LIFECYCLE_BANNER_MODE[statusKey] ??
        LIFECYCLE_BANNER_MODE[fromList?.key ?? ""] ??
        "qualify_start";

    return {
        statusKey: fromList?.key ?? statusKey,
        statusLabel: fromList?.label ?? statusKey.replace(/_/g, " "),
        tone: LIFECYCLE_STATUS_TONE[fromList?.key ?? statusKey] ?? "gray",
        bannerMode,
        banner: LIFECYCLE_BANNER_CONFIG[bannerMode],
    };
}
