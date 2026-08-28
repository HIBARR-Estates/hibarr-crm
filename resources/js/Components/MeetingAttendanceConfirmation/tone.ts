export interface Tone {
    c: string;
    bg: string;
    bd: string;
}

/** Shared outcome-color palette for the confirmation modal and the reminders dock. */
export const TONE: Record<"green" | "red" | "amber" | "gray" | "teal", Tone> = {
    green: { c: "#177a5b", bg: "#e1f5ee", bd: "#9fe1cb" },
    red: { c: "#b91c1c", bg: "#fef2f2", bd: "#fecaca" },
    amber: { c: "#92400e", bg: "#fef3c7", bd: "#fed7aa" },
    gray: { c: "#5b6472", bg: "#f5f6f8", bd: "#e8eaed" },
    teal: { c: "#0f766e", bg: "#e6f7f5", bd: "#99e2d8" },
};

/**
 * Neutral pill for a meeting-type label. Meeting types are freeform,
 * per-company text (see MeetingTypeSelector/AddMeetingType), not a fixed
 * enum, so — unlike per-outcome colors — there's no meaningful tone to key
 * off the label itself.
 */
export const MEETING_TYPE_TONE: Tone = { c: "#14538c", bg: "#e8f1fb", bd: "#b8d4f0" };
