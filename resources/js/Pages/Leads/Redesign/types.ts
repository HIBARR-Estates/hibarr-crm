import type { LeadShowProps } from "../Show";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_TOKENS,
} from "@/Components/Redesign";

export const LEAD_REDESIGN_TOKENS = REDESIGN_TOKENS;
export const LEAD_REDESIGN_FONT_STACK = REDESIGN_FONT_STACK;

/** Record tabs — same order as Deals, plus lead-only deals/marketing. */
export type LeadRecordTab =
    | "overview"
    | "notes"
    | "tasks"
    | "meetings"
    | "files"
    | "deals"
    | "itinerary"
    | "marketing";

/** Meta tabs — match Deals' dealinfo/timeline split (past the divider). */
export type LeadMetaTab = "leadinfo" | "timeline";

export type WorkspaceTabId = LeadRecordTab | LeadMetaTab;

/** Built-in Lead info sections (native lead fields). */
export type LeadInfoCoreSectionId = "personal" | "address";

/** Lead-info sidebar section — core panels + custom-field categories. */
export type LeadInfoSectionId =
    | LeadInfoCoreSectionId
    | `category-${number}`;

/** Dossier rail — glanceable overview + marketing engagement. */
export type DossierSectionId = "overview" | "engagement";

export type LeadBannerMode =
    | "qualify_start"
    | "qualify_resume"
    | "qualified"
    | "converted"
    | "nurture"
    | "closed";

export type LeadMissionCtaAction =
    | "qualify_start"
    | "qualify_resume"
    | "create_deal"
    | "open_deal"
    | "reactivate"
    | "view_answers"
    | null;

export type LeadRedesignProps = LeadShowProps;

export interface LeadTabCount {
    notes?: number;
    tasks?: number;
    meetings?: number;
    files?: number;
    deals?: number;
    itinerary?: number;
}
