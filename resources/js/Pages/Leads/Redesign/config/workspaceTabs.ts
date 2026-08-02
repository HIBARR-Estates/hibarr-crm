import type { LeadMetaTab, LeadRecordTab, WorkspaceTabId } from "../types";

export interface WorkspaceTabDef {
    id: WorkspaceTabId;
    label: string;
    countable?: boolean;
    /** Meta tabs sit after the divider (Deal info / Timeline pattern). */
    meta?: boolean;
}

/**
 * Order mirrors Deals/Redesign DealTabBar:
 * record tabs → divider → meta (Lead info, Timeline).
 * Lead-only: deals + marketing in the record strip.
 */
export const RECORD_TABS: WorkspaceTabDef[] = [
    { id: "overview", label: "Overview" },
    { id: "notes", label: "Notes", countable: true },
    { id: "tasks", label: "Tasks", countable: true },
    { id: "meetings", label: "Meetings", countable: true },
    { id: "files", label: "Files", countable: true },
    { id: "deals", label: "Deals", countable: true },
    { id: "itinerary", label: "Itinerary", countable: true },
    { id: "marketing", label: "Marketing" },
];

export const META_TABS: Array<WorkspaceTabDef & { id: LeadMetaTab }> = [
    { id: "leadinfo", label: "Lead info", meta: true },
    { id: "timeline", label: "Timeline", meta: true },
];

export const WORKSPACE_TABS: WorkspaceTabDef[] = [...RECORD_TABS, ...META_TABS];

export const RECORD_TAB_IDS: LeadRecordTab[] = RECORD_TABS.map(
    (t) => t.id as LeadRecordTab,
);
export const META_TAB_IDS: LeadMetaTab[] = META_TABS.map((t) => t.id);

/** Map legacy query values from the prior redesign. */
export function normalizeTabId(raw: string | null): WorkspaceTabId | null {
    if (!raw) return null;
    if (raw === "fields" || raw === "activities") {
        return raw === "fields" ? "leadinfo" : "timeline";
    }
    if (WORKSPACE_TABS.some((t) => t.id === raw)) {
        return raw as WorkspaceTabId;
    }
    return null;
}
