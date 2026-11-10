import { dayKeyIn, hasDueTime, meetingTimeState, taskTimeState, type TimeState } from "@/Components/Redesign/agent";
import type { QueueTask, ScheduleEntry } from "@/Types/personal-work";
import { isTaskDone } from "../today/useTodayWork";
import type { AgendaData } from "./useAgendaData";

export interface AgendaDay {
    meetings: ScheduleEntry[];
    tasks: QueueTask[];
}

const EMPTY_DAY: AgendaDay = { meetings: [], tasks: [] };

/**
 * Files meetings and tasks under the day they fall on in the viewer's zone.
 * A task's due date is already a wall-clock time in that zone.
 */
export function groupByDay(data: AgendaData | undefined, timeZone: string): Map<string, AgendaDay> {
    const days = new Map<string, AgendaDay>();
    const dayOf = (key: string) => {
        let day = days.get(key);
        if (!day) {
            day = { meetings: [], tasks: [] };
            days.set(key, day);
        }
        return day;
    };
    for (const meeting of data?.meetings ?? []) {
        if (meeting.at) dayOf(dayKeyIn(Date.parse(meeting.at), timeZone)).meetings.push(meeting);
    }
    for (const task of data?.tasks ?? []) {
        if (task.due_date) dayOf(task.due_date.slice(0, 10)).tasks.push(task);
    }
    return days;
}

export function dayOrEmpty(days: Map<string, AgendaDay>, key: string): AgendaDay {
    return days.get(key) ?? EMPTY_DAY;
}

export function meetingState(meeting: ScheduleEntry, nowMs: number): TimeState {
    return meetingTimeState({ at: meeting.at, duration: meeting.duration, held: meeting.status === "completed" }, nowMs);
}

export function taskState(task: QueueTask, nowMs: number, timeZone: string): TimeState {
    return taskTimeState({ due_date: task.due_date, done: isTaskDone(task) }, nowMs, timeZone);
}

const minuteFormatters = new Map<string, Intl.DateTimeFormat>();

/** Minutes after midnight of an instant, in the viewer's zone. */
export function minuteOfDay(ms: number, timeZone: string): number {
    let format = minuteFormatters.get(timeZone);
    if (!format) {
        format = new Intl.DateTimeFormat("en-GB", {
            hour: "numeric",
            minute: "numeric",
            hourCycle: "h23",
            timeZone: timeZone || undefined,
        });
        minuteFormatters.set(timeZone, format);
    }
    const parts = format.formatToParts(new Date(ms));
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    return hour * 60 + minute;
}

/** Minutes after midnight of a task's wall-clock due time. */
export function taskMinute(dueDate: string): number {
    return Number(dueDate.slice(11, 13)) * 60 + Number(dueDate.slice(14, 16));
}

export function hasTime(task: QueueTask): boolean {
    return Boolean(task.due_date && hasDueTime(task.due_date));
}

export interface PlacedBlock<T> {
    item: T;
    start: number;
    end: number;
    /** Column inside its group of overlapping blocks, and how many columns that group has. */
    lane: number;
    lanes: number;
}

/**
 * Side-by-side columns for blocks that overlap in time, like any calendar:
 * each block takes the first free column, and every block in a group of
 * overlapping ones shares that group's column count.
 */
export function placeBlocks<T>(blocks: Array<{ item: T; start: number; end: number }>): Array<PlacedBlock<T>> {
    const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
    const placed: Array<PlacedBlock<T>> = [];
    let group: Array<PlacedBlock<T>> = [];
    let laneEnds: number[] = [];
    let groupEnd = -1;

    const closeGroup = () => {
        const lanes = Math.max(1, laneEnds.length);
        for (const block of group) block.lanes = lanes;
        group = [];
        laneEnds = [];
    };

    for (const block of sorted) {
        if (block.start >= groupEnd) closeGroup();
        let lane = laneEnds.findIndex((end) => end <= block.start);
        if (lane === -1) {
            lane = laneEnds.length;
            laneEnds.push(block.end);
        } else {
            laneEnds[lane] = block.end;
        }
        const entry = { ...block, lane, lanes: 1 };
        group.push(entry);
        placed.push(entry);
        groupEnd = Math.max(groupEnd, block.end);
    }
    closeGroup();
    return placed;
}
