import { REDESIGN_TOKENS as T } from "../tokens";

/**
 * Time states used across the agent workspace (tasks, meetings, next steps):
 * overdue, happening now, soon or today, later, no date, and done. Colours
 * come from the TIME_* tokens in design-tokens.json; screens never restate them.
 */
export type TimeState = "late" | "now" | "soon" | "later" | "none" | "done";

export interface TimeStateColors {
    bg: string;
    border: string;
    text: string;
    solid: string;
}

export const TIME_STATE_COLORS: Record<TimeState, TimeStateColors> = {
    late: { bg: T.TIME_LATE_BG, border: T.TIME_LATE_BORDER, text: T.TIME_LATE_TEXT, solid: T.TIME_LATE_SOLID },
    now: { bg: T.TIME_NOW_BG, border: T.TIME_NOW_BORDER, text: T.TIME_NOW_TEXT, solid: T.TIME_NOW_SOLID },
    soon: { bg: T.TIME_SOON_BG, border: T.TIME_SOON_BORDER, text: T.TIME_SOON_TEXT, solid: T.TIME_SOON_SOLID },
    later: { bg: T.TIME_LATER_BG, border: T.TIME_LATER_BORDER, text: T.TIME_LATER_TEXT, solid: T.TIME_LATER_SOLID },
    none: { bg: T.TIME_NONE_BG, border: T.TIME_NONE_BORDER, text: T.TIME_NONE_TEXT, solid: T.TIME_NONE_SOLID },
    done: { bg: T.TIME_DONE_BG, border: T.TIME_DONE_BORDER, text: T.TIME_DONE_TEXT, solid: T.TIME_DONE_SOLID },
};
