import type { LeadBannerMode, LeadMissionCtaAction } from "../types";

/**
 * Maps seeded `lead_lifecycle_statuses.key` values onto banner modes.
 * Unknown/tenant-custom keys fall through to `qualify_start`.
 *
 * Labels are English source strings — wrap in `td()` at the render site.
 */
export const LIFECYCLE_BANNER_MODE: Record<string, LeadBannerMode> = {
    new: "qualify_start",
    contacted: "qualify_start",
    not_reached: "qualify_start",
    callback: "qualify_start",
    qualifying: "qualify_resume",
    qualified: "qualified",
    nurturing: "nurture",
    converted: "converted",
    lost: "closed",
    not_fit: "closed",
};

export const LIFECYCLE_STATUS_TONE: Record<string, string> = {
    new: "blue",
    contacted: "pink",
    not_reached: "gray",
    callback: "orange",
    qualified: "green",
    nurturing: "purple",
    converted: "teal",
    lost: "black",
    qualifying: "amber",
    not_fit: "red",
};

export interface LifecycleBannerConfig {
    mode: LeadBannerMode;
    primaryCta: { label: string; action: LeadMissionCtaAction };
    secondaryCta?: { label: string; action: LeadMissionCtaAction };
}

export const LIFECYCLE_BANNER_CONFIG: Record<LeadBannerMode, LifecycleBannerConfig> = {
    qualify_start: {
        mode: "qualify_start",
        primaryCta: { label: "Start qualification", action: "qualify_start" },
    },
    qualify_resume: {
        mode: "qualify_resume",
        primaryCta: { label: "Resume qualification", action: "qualify_resume" },
    },
    qualified: {
        mode: "qualified",
        primaryCta: { label: "Create deal", action: "create_deal" },
        secondaryCta: { label: "view answers", action: "view_answers" },
    },
    converted: {
        mode: "converted",
        primaryCta: { label: "Open deal", action: "open_deal" },
    },
    nurture: {
        mode: "nurture",
        primaryCta: { label: "Start qualification", action: "qualify_start" },
    },
    closed: {
        mode: "closed",
        primaryCta: { label: "Reactivate", action: "reactivate" },
        secondaryCta: { label: "view answers", action: "view_answers" },
    },
};
