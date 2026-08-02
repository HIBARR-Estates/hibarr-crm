import type { WorkspaceTabId } from "../types";

export interface WorkspaceTabDef {
    id: WorkspaceTabId;
    /** Base label without count suffix. */
    label: string;
    /** When true, append ` ${count || ""}`.trim() — zero omits the suffix. */
    countable?: boolean;
}

/** Literal order: 9 mockup tabs + marketing appended. */
export const WORKSPACE_TABS: WorkspaceTabDef[] = [
    { id: "overview", label: "Overview" },
    { id: "notes", label: "Notes", countable: true },
    { id: "tasks", label: "Tasks", countable: true },
    { id: "meetings", label: "Meetings", countable: true },
    { id: "deals", label: "Deals", countable: true },
    { id: "fields", label: "Lead fields" },
    { id: "itinerary", label: "Itinerary", countable: true },
    { id: "files", label: "Files", countable: true },
    { id: "activities", label: "Activities" },
    { id: "marketing", label: "Marketing" },
];
