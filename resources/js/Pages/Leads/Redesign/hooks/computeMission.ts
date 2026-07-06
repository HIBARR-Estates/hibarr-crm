import type { QualificationOutcome } from "@/Types/qualification";
import type { BantCaptures, LeadMission } from "../types";
import type { LeadTaskPreview } from "../adapters/taskAdapter";
import type { LeadMeetingPreview } from "../adapters/meetingAdapter";

const OUTCOME_LABELS: Record<QualificationOutcome, string> = {
    bookMeeting: "Book consultation",
    inviteWebinar: "Invite to webinar",
    callback: "Schedule callback",
    noFit: "Not a fit",
};

interface ComputeMissionInput {
    leadName: string;
    leadPhone?: string | null;
    contactLogged: boolean;
    outcome: QualificationOutcome | null;
    flowActive: boolean;
    qualificationEnabled?: boolean;
    openTasks: LeadTaskPreview[];
    nextMeeting: LeadMeetingPreview | null;
    captures: BantCaptures;
}

export function outcomeToLabel(outcome: QualificationOutcome | null | undefined): string | null {
    if (!outcome) return null;
    return OUTCOME_LABELS[outcome] ?? outcome;
}

export function computeMission({
    leadName,
    leadPhone,
    contactLogged,
    outcome,
    flowActive,
    qualificationEnabled = true,
    openTasks,
    nextMeeting,
    captures,
}: ComputeMissionInput): LeadMission {
    const outcomeLabel = outcomeToLabel(outcome);
    const phone = leadPhone || "the lead";

    if (!contactLogged) {
        return {
            phase: "contact",
            headline: `Call ${leadName}`,
            detail: `No interaction logged. Dial ${phone} and log the contact before qualifying.`,
            cta: "Log contact & start call",
            ctaAction: "logContact",
            urgency: "amber",
        };
    }

    if (!outcome && !flowActive && qualificationEnabled) {
        const missing = ["need", "budget", "timeline"].filter(
            (k) => !captures[k as keyof BantCaptures],
        ).length;
        return {
            phase: "qualify",
            headline: "Run the qualification script",
            detail:
                missing > 0
                    ? `${missing} qualification field(s) still missing. Work through the script to capture them and choose an outcome.`
                    : "Script ready — start the call and pick an outcome at the end.",
            cta: "Start qualification script",
            ctaAction: "startFlow",
            urgency: "blue",
        };
    }

    if (flowActive) {
        return {
            phase: "in_call",
            headline: "Qualification in progress",
            detail: "Follow the script below. Tap answers as the lead responds.",
            cta: null,
            urgency: "blue",
        };
    }

    if (outcome === "bookMeeting" && nextMeeting) {
        return {
            phase: "followup",
            headline: `Prepare for ${nextMeeting.title}`,
            detail: `${nextMeeting.startsAtLabel}. Review notes and open deals before the meeting.`,
            cta: "View meeting",
            ctaAction: "scrollMeetings",
            urgency: "green",
        };
    }

    if (outcomeLabel && openTasks.length > 0) {
        const task = openTasks[0];
        return {
            phase: "followup",
            headline: `Complete: ${task.title}`,
            detail: task.dueDateLabel
                ? `Due ${task.dueDateLabel}${task.priority === "high" ? " · High priority" : ""}`
                : "Open follow-up task from last interaction.",
            cta: "Mark task done",
            ctaAction: "completeTopTask",
            urgency: "blue",
        };
    }

    if (outcomeLabel) {
        return {
            phase: "done",
            headline: `Last outcome: ${outcomeLabel}`,
            detail: "Qualification complete. Log a note or create a deal if the lead progresses.",
            cta: "Add note",
            ctaAction: "focusNote",
            urgency: "green",
        };
    }

    return {
        phase: "qualify",
        headline: "Qualify this lead",
        detail: qualificationEnabled
            ? "Start the script."
            : "Continue follow-up on this lead.",
        cta: qualificationEnabled ? "Start script" : null,
        ctaAction: qualificationEnabled ? "startFlow" : null,
        urgency: "blue",
    };
}
