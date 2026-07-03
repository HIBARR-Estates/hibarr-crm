export { DEAL_REDESIGN_TOKENS as LEAD_REDESIGN_TOKENS } from "@/Pages/Deals/Redesign/tokens";
export { DEAL_REDESIGN_FONT_STACK as LEAD_REDESIGN_FONT_STACK } from "@/Pages/Deals/Redesign/tokens";

import type { LeadShowProps } from "../Show";

export type LeadDrawerTab =
    | "overview"
    | "profile"
    | "tasks"
    | "meetings"
    | "deals"
    | "notes"
    | "marketing"
    | "activity";

export type LeadMissionUrgency = "amber" | "blue" | "green";

export type LeadMissionCtaAction =
    | "logContact"
    | "startFlow"
    | "focusNote"
    | "scrollMeetings"
    | "completeTopTask";

export interface LeadMission {
    phase: string;
    headline: string;
    detail: string;
    cta: string | null;
    ctaAction?: LeadMissionCtaAction;
    urgency: LeadMissionUrgency;
}

export interface BantChecks {
    contactability: boolean;
    need: boolean;
    budget: boolean;
    timeline: boolean;
}

export interface BantCaptures {
    contactability?: string;
    need?: string;
    budget?: string;
    timeline?: string;
}

export interface LeadContextRailData {
    openTasksCount: number;
    upcomingMeetingsCount: number;
    dealsCount: number;
    nextMeeting: {
        id: number;
        title: string;
        startsAtLabel: string;
    } | null;
    topOpenTask: {
        id: number;
        title: string;
        dueDateLabel: string;
        priority: string;
    } | null;
}

export type LeadRedesignProps = LeadShowProps;
