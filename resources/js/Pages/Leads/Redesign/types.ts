import type { LeadShowProps } from "../Show";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_TOKENS,
} from "@/Components/Redesign";

export const LEAD_REDESIGN_TOKENS = REDESIGN_TOKENS;
export const LEAD_REDESIGN_FONT_STACK = REDESIGN_FONT_STACK;

/** Workspace tab ids — 9 mockup tabs + marketing appended. */
export type WorkspaceTabId =
    | "overview"
    | "notes"
    | "tasks"
    | "meetings"
    | "deals"
    | "fields"
    | "itinerary"
    | "files"
    | "activities"
    | "marketing";

export type DossierSectionId =
    | "contact"
    | "engagement"
    | "personal"
    | "financial"
    | "attribution";

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
